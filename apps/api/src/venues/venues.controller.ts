import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { NotBannedGuard } from '../auth/not-banned.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateVenueDto, ListVenuesQuery } from './dto';
import { ConfigService } from '@nestjs/config';
import { canonicalizeCity, expandCityFilter } from '../shared/city';
import { TelegramSender } from '../bot/telegram-sender';
import type { User } from '@prisma/client';

@Controller('venues')
export class VenuesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly bot: TelegramSender,
  ) {}

  @Get()
  list(@Query() q: ListVenuesQuery) {
    const where: any = { status: 'PUBLISHED' };
    if (q.city) {
      const defaultCity = this.config.get<string>('DEFAULT_CITY');
      where.city = { in: expandCityFilter(q.city, defaultCity) };
    }
    if (q.minLat !== undefined && q.maxLat !== undefined) {
      where.lat = { gte: q.minLat, lte: q.maxLat };
    }
    if (q.minLng !== undefined && q.maxLng !== undefined) {
      where.lng = { gte: q.minLng, lte: q.maxLng };
    }
    return this.prisma.venue.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  @Get('default-city')
  defaultCity() {
    // timeZone is shared with bot DMs (APP_TIMEZONE) so Mini App game
    // clocks match Telegram notifications regardless of the phone's TZ.
    const timeZone =
      this.config.get<string>('APP_TIMEZONE')?.trim() ||
      process.env.TZ?.trim() ||
      'Europe/Warsaw';
    return {
      city: this.config.get<string>('DEFAULT_CITY') ?? null,
      lat: Number(this.config.get<string>('DEFAULT_CITY_LAT') ?? 0) || null,
      lng: Number(this.config.get<string>('DEFAULT_CITY_LNG') ?? 0) || null,
      timeZone,
      /** Bot @username (no @) for t.me share / startapp deep links. */
      botUsername: this.bot.getUsername(),
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard, NotBannedGuard)
  async submit(@CurrentUser() me: User | null, @Body() dto: CreateVenueDto) {
    const defaultCity = this.config.get<string>('DEFAULT_CITY') ?? 'Unknown';
    const city = canonicalizeCity(
      dto.city ?? me?.city ?? defaultCity,
      defaultCity,
    );
    return this.prisma.venue.create({
      data: {
        name: dto.name,
        address: dto.address,
        lat: dto.lat,
        lng: dto.lng,
        indoor: dto.indoor ?? false,
        surface: dto.surface ?? null,
        hourlyPrice: dto.hourlyPrice,
        capacity: dto.capacity,
        city,
        status: 'PUBLISHED',
        submittedById: me?.id ?? null,
      },
    });
  }
}
