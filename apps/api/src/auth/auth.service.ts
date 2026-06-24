import { Injectable, UnauthorizedException } from '@nestjs/common';
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

    const user = await this.prisma.user.upsert({
      where: { telegramId: BigInt(tgUser.id) },
      update: {
        firstName: tgUser.first_name,
        lastName: tgUser.last_name ?? null,
        username: tgUser.username ?? null,
      },
      create: {
        telegramId: BigInt(tgUser.id),
        firstName: tgUser.first_name,
        lastName: tgUser.last_name ?? null,
        username: tgUser.username ?? null,
        city: defaultCity,
        lat: defaultLat || null,
        lng: defaultLng || null,
        reminderOffsets: [1440, 120, 30],
      },
    });

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
