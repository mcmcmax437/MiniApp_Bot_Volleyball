import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export {
  SKILL_LEVELS,
  SKILL_LEVEL_LABELS,
  SKILL_LEVEL_DESCRIPTIONS,
  SKILL_BUCKETS,
} from '../shared/skill-levels';
export type { SkillLevel } from '../shared/skill-levels';
import { SKILL_LEVELS } from '../shared/skill-levels';

export class AdminUpdateUserDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string | null;

  @IsOptional()
  @IsString()
  username?: string | null;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(120)
  age?: number;

  @IsOptional()
  @IsIn([...SKILL_LEVELS, null])
  skillLevel?: (typeof SKILL_LEVELS)[number] | null;

  @IsOptional()
  @IsIn(['USER', 'ADMIN'])
  role?: 'USER' | 'ADMIN';
}

export class AdminUpdateGameDto {
  @IsOptional()
  @IsIn(['OPEN', 'FULL', 'CANCELLED', 'FINISHED'])
  status?: 'OPEN' | 'FULL' | 'CANCELLED' | 'FINISHED';

  @IsOptional()
  @IsInt()
  @Min(2)
  spotsTotal?: number;

  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class AdminUpdateVenueDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  hourlyPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(2)
  capacity?: number;

  @IsOptional()
  @IsIn(['PUBLISHED', 'HIDDEN'])
  status?: 'PUBLISHED' | 'HIDDEN';
}

export class AdminListQuery {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  take?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  skip?: number;

  @IsOptional()
  @IsString()
  q?: string; // free-text search (name, username, etc.)
}