import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

const MAX_BYTES = 2_000_000; // ~2 MB per image
const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

/**
 * Stores up to two custom field photos per game under
 * `storage/game-covers/{gameId}-{slot}.{ext}`. Public URLs are served by
 * GamesController at `GET /api/v1/game-covers/:file`.
 */
@Injectable()
export class GameCoverService {
  private readonly logger = new Logger(GameCoverService.name);
  private readonly dir: string;

  constructor() {
    this.dir =
      process.env.GAME_COVER_DIR ??
      path.join(process.cwd(), 'storage', 'game-covers');
  }

  absolutePath(fileName: string): string {
    const safe = path.basename(fileName);
    return path.join(this.dir, safe);
  }

  publicUrl(fileName: string): string {
    return `/api/v1/game-covers/${encodeURIComponent(path.basename(fileName))}`;
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

  async deleteSlotFiles(gameId: string, slot: 1 | 2): Promise<void> {
    for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
      const fp = this.absolutePath(`${gameId}-${slot}.${ext}`);
      try {
        await fs.unlink(fp);
      } catch {
        /* missing is fine */
      }
    }
  }

  /** Optional integrity check — reject path traversal. */
  isSafeFileName(fileName: string): boolean {
    if (!fileName || fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      return false;
    }
    // cuid-ish game id + slot + ext
    return /^[a-z0-9_-]+-[12]\.(jpe?g|png|webp)$/i.test(fileName);
  }

  /** Random suffix unused — kept for future signed names. */
  randomToken(): string {
    return crypto.randomBytes(4).toString('hex');
  }
}
