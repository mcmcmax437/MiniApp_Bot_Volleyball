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
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SKILL_LEVELS } from '../shared/skill-levels';
import { EvaluationsService } from '../evaluations/evaluations.service';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly evaluations: EvaluationsService,
  ) {}

  /**
   * Serialize a Prisma user row into the JSON-safe shape the client expects.
   *
   * The raw Prisma object has `telegramId` as a BigInt, which breaks
   * `JSON.stringify` and would crash the response. The AuthController's
   * `toPublicUser` already does this conversion; we replicate it here so that
   * `/me` GET and PATCH responses match the `/auth/me` shape exactly.
   */
  private toPublicUser(u: User) {
    const configured = this.config.get<string>('TELEGRAM_SUPERADMIN_ID')?.trim();
    const isSuperAdmin =
      !!configured && String(u.telegramId) === configured;
    return {
      id: u.id,
      telegramId: u.telegramId.toString(),
      firstName: u.firstName,
      lastName: u.lastName,
      username: u.username,
      age: u.age,
      skillLevel: u.skillLevel,
      city: u.city,
      lat: u.lat,
      lng: u.lng,
      reminderOffsets: u.reminderOffsets,
      photoUrl: u.photoUrl ?? null,
      role: u.role ?? 'USER',
      isSuperAdmin,
      // v3 fields that aren't currently on User but the client expects:
      language: (u as any).language ?? null,
      evaluatedSkillLevel: (u as any).evaluatedSkillLevel ?? null,
      evaluatedAt: (u as any).evaluatedAt ?? null,
      isBanned: u.isBanned,
      bannedReason: u.bannedReason,
    };
  }

  @Get()
  async get(@CurrentUser() me: User | null) {
    return me ? this.toPublicUser(me) : null;
  }

  @Patch()
  async update(@CurrentUser() me: User | null, @Body() dto: UpdateMeDto) {
    if (!me) return null;

    // Cannot update a banned account. Banned users see only a banner so they
    // can't mutate anything. The guard does not enforce this because we want
    // /me to keep returning the user so the client can show the ban screen.
    if (me.isBanned) {
      return this.toPublicUser(me);
    }

    // The self-declared skill level takes part in the weighted average that
    // drives the user-facing badge. If the client is changing it (including
    // clearing it), kick a recompute so the cached `evaluatedSkillLevel`
    // reflects the new self-value against existing peer evaluations.
    const skillLevelChanged =
      dto.skillLevel !== undefined && dto.skillLevel !== me.skillLevel;

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

    if (skillLevelChanged) {
      try {
        await this.evaluations.recalibrateUserSkill(updated.id);
      } catch {
        // The self-level change still went through; an aggregation failure
        // should not 500 the entire PATCH. Worst case: the badge lags by
        // one render until the next evaluation.
      }
      // Re-read so the response includes the freshly cached
      // `evaluatedSkillLevel` (recalibrate writes it in a separate tx).
      const fresh = await this.prisma.user.findUnique({ where: { id: updated.id } });
      return this.toPublicUser(fresh ?? updated);
    }

    return this.toPublicUser(updated);
  }
}