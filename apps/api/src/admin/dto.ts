import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export {
  SKILL_LEVELS,
  SKILL_LEVEL_LABELS,
  SKILL_LEVEL_DESCRIPTIONS,
  SKILL_BUCKETS,
} from '../shared/skill-levels';
export type { SkillLevel } from '../shared/skill-levels';
import { SKILL_LEVELS } from '../shared/skill-levels';
import { PLAY_TYPES, PlayType } from '../games/dto';

export class AdminUpdateUserDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string | null;
  @IsOptional() @IsString() username?: string | null;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsInt() @Min(5) @Max(120) age?: number;
  @IsOptional() @IsIn([...SKILL_LEVELS, null]) skillLevel?: (typeof SKILL_LEVELS)[number] | null;
  @IsOptional() @IsIn(['USER', 'ADMIN']) role?: 'USER' | 'ADMIN';

  // ===== v3 =====
  @IsOptional() @IsBoolean() isBanned?: boolean;
  @IsOptional() @IsString() @MaxLength(280) bannedReason?: string | null;
}

export class AdminUpdateGameDto {
  @IsOptional()
  @IsIn(['OPEN', 'FULL', 'CANCELLED', 'FINISHED'])
  status?: 'OPEN' | 'FULL' | 'CANCELLED' | 'FINISHED';

  @IsOptional() @IsInt() @Min(2) spotsTotal?: number;
  @IsOptional() @IsString() notes?: string | null;

  // ===== v3 =====
  @IsOptional() @IsInt() @Min(0) totalCost?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsBoolean() isPaid?: boolean;
  @IsOptional() @IsBoolean() isClosed?: boolean;
  @IsOptional() @IsString() @MaxLength(500) coverImageUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(280) addressHint?: string | null;
  @IsOptional() @IsString() startAt?: string;
  @IsOptional() @IsString() endAt?: string;
  @IsOptional() @IsIn(SKILL_LEVELS as unknown as string[])
  skillLevel?: (typeof SKILL_LEVELS)[number];

  @IsOptional() @IsIn(PLAY_TYPES as unknown as string[]) playType?: PlayType;
}

export class AdminUpdateVenueDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsInt() @Min(0) hourlyPrice?: number;
  @IsOptional() @IsInt() @Min(2) capacity?: number;
  @IsOptional() @IsIn(['PUBLISHED', 'HIDDEN']) status?: 'PUBLISHED' | 'HIDDEN';
}

export class AdminListQuery {
  // Query-string values arrive as strings. Without `@Type(() => Number)`,
  // `@IsInt()` rejects `"100"` and the admin Users/Games/Venues pages
  // return "take must be an integer number".
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  take?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  @IsOptional() @IsString() q?: string;

  // ===== v3 =====
  @IsOptional() @IsIn(['true', 'false']) isBanned?: 'true' | 'false';
  @IsOptional() @IsIn(['USER', 'ADMIN']) role?: 'USER' | 'ADMIN';
  @IsOptional() @IsString() city?: string;
}
