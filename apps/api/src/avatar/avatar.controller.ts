import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { promises as fs } from 'node:fs';
import { AvatarService } from './avatar.service';

/**
 * Serves user avatars cached on disk by `AvatarService`.
 *
 * Public on purpose — these are 84x84px profile pictures, not secrets. The
 * `userId` is a cuid, not enumerable, so it's safe to expose.
 */
@Controller('avatars')
export class AvatarController {
  constructor(private readonly avatars: AvatarService) {}

  @Get(':userId')
  async serve(@Param('userId') userId: string, @Res() res: Response) {
    const fp = this.avatars.filePath(userId);
    if (!fp) return res.status(404).end();

    try {
      await fs.access(fp);
    } catch {
      return res.status(404).end();
    }

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(fp);
  }
}
