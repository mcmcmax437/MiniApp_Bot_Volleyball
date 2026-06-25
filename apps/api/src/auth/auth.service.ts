import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { verifyTelegramInitData } from './telegram-auth.util';

export interface JwtPayload {
  sub: string; // user.id (cuid)
  tid: string; // telegramId as string
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async loginWithTelegram(initData: string) {
    const botToken = this.config.get<string>('BOT_TOKEN');
    if (!botToken) throw new UnauthorizedException('BOT_TOKEN not configured on server');

    let parsed;
    try {
      parsed = verifyTelegramInitData(initData, botToken);
    } catch (err) {
      throw new UnauthorizedException(`Invalid initData: ${(err as Error).message}`);
    }

    const tgUser = parsed.user;
    if (!tgUser?.id) throw new UnauthorizedException('initData has no user');

    const defaultCity = this.config.get<string>('DEFAULT_CITY') ?? 'Kyiv';
    const defaultLat = Number(this.config.get<string>('DEFAULT_CITY_LAT') ?? 0);
    const defaultLng = Number(this.config.get<string>('DEFAULT_CITY_LNG') ?? 0);

    // Admin elevation: if this Telegram user matches the configured superadmin
    // id, force their role to ADMIN on every login. This lets you reclaim admin
    // if you ever change the id, and also means a manual demotion in the DB
    // is overridden the next time the admin logs in (which is usually what you
    // want for the superadmin).
    const superadminId = this.config.get<string>('TELEGRAM_SUPERADMIN_ID');
    const isSuperadmin =
      !!superadminId && String(tgUser.id) === String(superadminId).trim();

    const user = await this.prisma.user.upsert({
      where: { telegramId: BigInt(tgUser.id) },
      update: {
        firstName: tgUser.first_name,
        lastName: tgUser.last_name ?? null,
        username: tgUser.username ?? null,
        // Refresh Telegram photo on every login — the URL is signed and may
        // expire, so re-fetching keeps avatars fresh without a separate job.
        photoUrl: tgUser.photo_url ?? null,
        ...(isSuperadmin ? { role: 'ADMIN' as const } : {}),
      },
      create: {
        telegramId: BigInt(tgUser.id),
        firstName: tgUser.first_name,
        lastName: tgUser.last_name ?? null,
        username: tgUser.username ?? null,
        photoUrl: tgUser.photo_url ?? null,
        city: defaultCity,
        lat: defaultLat || null,
        lng: defaultLng || null,
        reminderOffsets: [1440, 120, 30],
        ...(isSuperadmin ? { role: 'ADMIN' as const } : { role: 'USER' as const }),
      },
    });

    if (isSuperadmin && user.role !== 'ADMIN') {
      this.logger.warn(`Superadmin elevation failed for telegramId=${tgUser.id}`);
    }

    const token = await this.jwt.signAsync({
      sub: user.id,
      tid: user.telegramId.toString(),
    } as JwtPayload);

    return { user, token };
  }

  async verifyToken(token: string): Promise<JwtPayload> {
    try {
      return await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}