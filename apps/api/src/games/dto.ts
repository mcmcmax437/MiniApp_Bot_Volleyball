import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SKILL_LEVELS } from '../shared/skill-levels';

const SUPPORTED_CURRENCIES = ['UAH', 'PLN', 'EUR', 'USD'] as const;
type Currency = (typeof SUPPORTED_CURRENCIES)[number];

function toInt(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function toBool(v: unknown): boolean | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'boolean') return v;
  return v === 'true' || v === '1';
}

export class CreateGameDto {
  @IsString()
  venueId!: string;

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsIn(SKILL_LEVELS as unknown as string[])
  skillLevel!: (typeof SKILL_LEVELS)[number];

  @IsInt()
  @Min(2)
  @Max(1000)
  spotsTotal!: number;

  @IsInt()
  @Min(0)
  @Max(10_000_000)
  totalCost!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  // ===== v3 =====

  @IsOptional()
  @IsIn(SUPPORTED_CURRENCIES as unknown as string[])
  currency?: Currency;

  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;

  @IsOptional()
  @IsBoolean()
  isClosed?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverImageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  addressHint?: string;
}

export class ListGamesQuery {
  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsIn(SKILL_LEVELS as unknown as string[])
  skillLevel?: (typeof SKILL_LEVELS)[number];

  @IsOptional()
  @IsString()
  venueId?: string;

  @IsOptional()
  @IsString()
  hostId?: string;

  // Skill bucket quick-filter: "BEGINNER", "INTERMEDIATE", "ADVANCED"
  @IsOptional()
  @IsIn(['BEGINNER', 'INTERMEDIATE', 'ADVANCED'])
  bucket?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

  // Free-text note search
  @IsOptional()
  @IsString()
  q?: string;

  // ===== v3 filters =====

  // Show only games that still have open spots (participants < spotsTotal)
  @IsOptional()
  @Transform(({ value }) => toBool(value))
  hasSpots?: boolean;

  // Exact skill level, may be combined with date range / city
  @IsOptional()
  @IsInt()
  @Transform(({ value }) => toInt(value))
  minSpots?: number;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => toInt(value))
  maxSpots?: number;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => toBool(value))
  isPaid?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => toBool(value))
  isClosed?: boolean;

  // When false, exclude closed (private) games from results.
  @IsOptional()
  @Transform(({ value }) => toBool(value))
  includeClosed?: boolean;
}