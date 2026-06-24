import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateVenueDto, ListVenuesQuery } from './dto';
import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';

@Controller('venues')
export class VenuesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  list(@Query() q: ListVenuesQuery) {
    const where: any = { status: 'PUBLISHED' };
    if (q.city) where.city = q.city;
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
    return {
      city: this.config.get<string>('DEFAULT_CITY') ?? null,
      lat: Number(this.config.get<string>('DEFAULT_CITY_LAT') ?? 0) || null,
      lng: Number(this.config.get<string>('DEFAULT_CITY_LNG') ?? 0) || null,
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async submit(@CurrentUser() me: User | null, @Body() dto: CreateVenueDto) {
    const city = dto.city ?? me?.city ?? this.config.get<string>('DEFAULT_CITY') ?? 'Unknown';
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
