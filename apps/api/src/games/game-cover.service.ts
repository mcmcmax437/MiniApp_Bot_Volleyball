import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

const MAX_BYTES = 2_000_000; // ~2 MB per image
const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const EXTS = ['jpg', 'jpeg', 'png', 'webp'] as const;

/**
 * Stores custom field photos:
 * - Per game (one cover): `storage/game-covers/{gameId}-1.{ext}`
 *   (slot 2 kept for legacy games that already have a second photo)
 * - Per user (reusable library cover): `storage/user-covers/{userId}.{ext}`
 *
 * Public URLs:
 * - `GET /api/v1/game-covers/:file`
 * - `GET /api/v1/user-covers/:file`
 */
@Injectable()
export class GameCoverService {
  private readonly logger = new Logger(GameCoverService.name);
  private readonly dir: string;
  private readonly userDir: string;

  constructor() {
    this.dir =
      process.env.GAME_COVER_DIR ??
      path.join(process.cwd(), 'storage', 'game-covers');
    this.userDir =
      process.env.USER_COVER_DIR ??
      path.join(process.cwd(), 'storage', 'user-covers');
  }

  absolutePath(fileName: string): string {
    const safe = path.basename(fileName);
    return path.join(this.dir, safe);
  }

  userAbsolutePath(fileName: string): string {
    const safe = path.basename(fileName);
    return path.join(this.userDir, safe);
  }

  publicUrl(fileName: string): string {
    return `/api/v1/game-covers/${encodeURIComponent(path.basename(fileName))}`;
  }

  publicUserUrl(fileName: string): string {
    return `/api/v1/user-covers/${encodeURIComponent(path.basename(fileName))}`;
  }

  /**
   * Decode a data-URL or raw base64 payload into a Buffer + extension.
   */
  decodeImage(raw: string, mimeHint?: string): { buf: Buffer; ext: string; mime: string } {
    let mime = (mimeHint ?? '').toLowerCase().trim();
    let b64 = raw.trim();
    const dataUrl = /^data:([^;]+);base64,(.+)$/i.exec(b64);
    if (dataUrl) {
      mime = dataUrl[1].toLowerCase();
      b64 = dataUrl[2];
    }
    if (!mime) mime = 'image/jpeg';
    if (!ALLOWED_MIME.has(mime)) {
      throw new BadRequestException('Only JPEG, PNG, or WebP images are allowed');
    }
    const buf = Buffer.from(b64, 'base64');
    if (!buf.length) throw new BadRequestException('Empty image');
    if (buf.length > MAX_BYTES) {
      throw new BadRequestException('Image must be under 2 MB');
    }
    const ext =
      mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
    return { buf, ext, mime };
  }

  async saveSlot(gameId: string, slot: 1 | 2, raw: string, mimeHint?: string): Promise<string> {
    const { buf, ext } = this.decodeImage(raw, mimeHint);
    await fs.mkdir(this.dir, { recursive: true });
    // Wipe any previous extension for this slot.
    await this.deleteSlotFiles(gameId, slot);
    const fileName = `${gameId}-${slot}.${ext}`;
    const fp = this.absolutePath(fileName);
    await fs.writeFile(fp, buf);
    this.logger.log(`Saved cover ${fileName} (${buf.length} bytes)`);
    return this.publicUrl(fileName);
  }

  /** Persist the host's reusable cover (one photo per user). */
  async saveUserCover(userId: string, raw: string, mimeHint?: string): Promise<string> {
    const { buf, ext } = this.decodeImage(raw, mimeHint);
    await fs.mkdir(this.userDir, { recursive: true });
    await this.deleteUserCoverFiles(userId);
    const fileName = `${userId}.${ext}`;
    const fp = this.userAbsolutePath(fileName);
    await fs.writeFile(fp, buf);
    this.logger.log(`Saved user cover ${fileName} (${buf.length} bytes)`);
    return this.publicUserUrl(fileName);
  }

  /** Copy the user's saved cover onto a game's primary slot. */
  async copyUserCoverToGame(userId: string, gameId: string): Promise<string> {
    const found = await this.findUserCoverFile(userId);
    if (!found) {
      throw new BadRequestException('No saved cover photo on your profile');
    }
    await fs.mkdir(this.dir, { recursive: true });
    await this.deleteSlotFiles(gameId, 1);
    const fileName = `${gameId}-1.${found.ext}`;
    await fs.copyFile(found.path, this.absolutePath(fileName));
    this.logger.log(`Copied user cover ${userId} → ${fileName}`);
    return this.publicUrl(fileName);
  }

  /**
   * Copy a game cover slot into the user's reusable library.
   * Returns the public user-cover URL, or null if the game slot file is missing.
   */
  async copyGameSlotToUser(
    gameId: string,
    slot: 1 | 2,
    userId: string,
  ): Promise<string | null> {
    const found = await this.findGameSlotFile(gameId, slot);
    if (!found) return null;
    await fs.mkdir(this.userDir, { recursive: true });
    await this.deleteUserCoverFiles(userId);
    const fileName = `${userId}.${found.ext}`;
    await fs.copyFile(found.path, this.userAbsolutePath(fileName));
    this.logger.log(`Promoted game cover ${gameId}-${slot} → user ${userId}`);
    return this.publicUserUrl(fileName);
  }

  /** Copy cover slot from one game to another (same host reuse path). */
  async copyGameSlotToGame(
    fromGameId: string,
    fromSlot: 1 | 2,
    toGameId: string,
  ): Promise<string> {
    const found = await this.findGameSlotFile(fromGameId, fromSlot);
    if (!found) {
      throw new BadRequestException('Source game has no cover photo on disk');
    }
    await fs.mkdir(this.dir, { recursive: true });
    await this.deleteSlotFiles(toGameId, 1);
    const fileName = `${toGameId}-1.${found.ext}`;
    await fs.copyFile(found.path, this.absolutePath(fileName));
    this.logger.log(`Copied game cover ${fromGameId}-${fromSlot} → ${fileName}`);
    return this.publicUrl(fileName);
  }

  async deleteSlotFiles(gameId: string, slot: 1 | 2): Promise<void> {
    for (const ext of EXTS) {
      const fp = this.absolutePath(`${gameId}-${slot}.${ext}`);
      try {
        await fs.unlink(fp);
      } catch {
        /* missing is fine */
      }
    }
  }

  async deleteUserCoverFiles(userId: string): Promise<void> {
    for (const ext of EXTS) {
      const fp = this.userAbsolutePath(`${userId}.${ext}`);
      try {
        await fs.unlink(fp);
      } catch {
        /* missing is fine */
      }
    }
  }

  private async findGameSlotFile(
    gameId: string,
    slot: 1 | 2,
  ): Promise<{ path: string; ext: string } | null> {
    for (const ext of EXTS) {
      const fp = this.absolutePath(`${gameId}-${slot}.${ext}`);
      try {
        await fs.access(fp);
        return { path: fp, ext };
      } catch {
        /* try next */
      }
    }
    return null;
  }

  private async findUserCoverFile(
    userId: string,
  ): Promise<{ path: string; ext: string } | null> {
    for (const ext of EXTS) {
      const fp = this.userAbsolutePath(`${userId}.${ext}`);
      try {
        await fs.access(fp);
        return { path: fp, ext };
      } catch {
        /* try next */
      }
    }
    return null;
  }

  /** Optional integrity check — reject path traversal. */
  isSafeFileName(fileName: string): boolean {
    if (!fileName || fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      return false;
    }
    // cuid-ish game id + slot + ext
    return /^[a-z0-9_-]+-[12]\.(jpe?g|png|webp)$/i.test(fileName);
  }

  isSafeUserCoverFileName(fileName: string): boolean {
    if (!fileName || fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      return false;
    }
    return /^[a-z0-9_-]+\.(jpe?g|png|webp)$/i.test(fileName);
  }

  /** Random suffix unused — kept for future signed names. */
  randomToken(): string {
    return crypto.randomBytes(4).toString('hex');
  }
}
