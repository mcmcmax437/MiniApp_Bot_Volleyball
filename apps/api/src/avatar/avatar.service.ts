import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

/**
 * Downloads Telegram profile photos to disk so the URL we store in the DB is
 * stable and never expires (the raw `tgUser.photo_url` is signed and may
 * expire within an hour).
 *
 * Cached avatars are served by `AvatarController` at
 * `GET /api/v1/avatars/:userId`.
 */
@Injectable()
export class AvatarService {
  private readonly logger = new Logger(AvatarService.name);
  private readonly cacheDir: string;

  constructor() {
    // Co-locate the cache with the app's working dir so PM2 + the container
    // both find it without any extra volume setup. Override via env for tests.
    this.cacheDir =
      process.env.AVATAR_CACHE_DIR ??
      path.join(process.cwd(), 'storage', 'avatars');
  }

  /**
   * Download `remoteUrl` to `cacheDir/<userId>.jpg` if we don't already have a
   * cached copy. Returns the public URL the client should use, or `null` if
   * the download failed (e.g. Telegram's signed URL had already expired).
   */
  async refresh(
    userId: string,
    remoteUrl: string | null,
  ): Promise<string | null> {
    if (!remoteUrl) return null;

    await fs.mkdir(this.cacheDir, { recursive: true });
    const filePath = path.join(this.cacheDir, `${userId}.jpg`);
    const publicUrl = `/api/v1/avatars/${userId}`;

    // If we already have a recent file, skip the download.
    try {
      const stat = await fs.stat(filePath);
      // Re-fetch at most once a day, so profile photo changes are picked up
      // eventually without us hammering Telegram.
      if (Date.now() - stat.mtimeMs < 24 * 60 * 60 * 1000) {
        return publicUrl;
      }
    } catch {
      // file doesn't exist yet — fall through to download
    }

    try {
      const res = await fetch(remoteUrl, {
        // Telegram CDN requires a normal browser-y UA.
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; VolleyBot/1.0; +https://volleyball.tereshkovych.com.ua)',
        },
      });
      if (!res.ok) {
        this.logger.warn(
          `Avatar download failed for ${userId}: HTTP ${res.status}`,
        );
        return null;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0) return null;
      await fs.writeFile(filePath, buf);
      return publicUrl;
    } catch (err) {
      this.logger.warn(
        `Avatar download threw for ${userId}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  /** Absolute path to the cached avatar file, or null if not cached. */
  filePath(userId: string): string | null {
    return path.join(this.cacheDir, `${userId}.jpg`);
  }
}
