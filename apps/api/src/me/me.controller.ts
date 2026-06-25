import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  IsArray,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SKILL_LEVELS } from '../shared/skill-levels';
import type { User } from '@prisma/client';

const SUPPORTED_LANGUAGES = ['uk', 'pl', 'en', 'ru'] as const;
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

class UpdateMeDto {
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(120)
  age?: number;

  @IsOptional()
  @IsIn([...SKILL_LEVELS, null] as string[])
  skillLevel?:
    | 'LEVEL_1'
    | 'LEVEL_2'
    | 'LEVEL_3'
    | 'LEVEL_4'
    | 'LEVEL_5'
    | 'LEVEL_6'
    | null;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  reminderOffsets?: number[];

  // ===== v3 =====

  @IsOptional()
  @IsIn(SUPPORTED_LANGUAGES as unknown as string[])
  language?: SupportedLanguage;

  @IsOptional()
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @IsLongitude()
  lng?: number;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  bio?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('me')
export class MeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async get(@CurrentUser() me: User | null) {
    return me;
  }

  @Patch()
  async update(@CurrentUser() me: User | null, @Body() dto: UpdateMeDto) {
    if (!me) return null;

    // Cannot update a banned account. Banned users see only a banner so they
    // can't mutate anything. The guard does not enforce this because we want
    // /me to keep returning the user so the client can show the ban screen.
    if (me.isBanned) {
      return me;
    }

    const updated = await this.prisma.user.update({
      where: { id: me.id },
      data: {
        age: dto.age ?? undefined,
        skillLevel: dto.skillLevel === undefined ? undefined : dto.skillLevel,
        city: dto.city ?? undefined,
        reminderOffsets: dto.reminderOffsets ?? undefined,
        language: dto.language ?? undefined,
        lat: dto.lat ?? undefined,
        lng: dto.lng ?? undefined,
      },
    });
    return updated;
  }
}