import { IsBoolean, IsIn, IsInt, IsLatitude, IsLongitude, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export { SKILL_LEVELS, SKILL_LEVEL_LABELS, SKILL_LEVEL_DESCRIPTIONS } from '../shared/skill-levels';
export type { SkillLevel } from '../shared/skill-levels';
import { SKILL_LEVELS } from '../shared/skill-levels';

export class CreateVenueDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(240)
  address!: string;

  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;

  @IsOptional()
  @IsBoolean()
  indoor?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  surface?: string;

  @IsInt()
  @Min(0)
  @Max(1_000_000)
  hourlyPrice!: number;

  @IsInt()
  @Min(2)
  @Max(40)
  capacity!: number;

  @IsOptional()
  @IsString()
  city?: string;
}

export class ListVenuesQuery {
  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsLatitude()
  minLat?: number;

  @IsOptional()
  @IsLatitude()
  maxLat?: number;

  @IsOptional()
  @IsLongitude()
  minLng?: number;

  @IsOptional()
  @IsLongitude()
  maxLng?: number;
}

export const SkillLevelParam = (): PropertyDecorator => IsIn(SKILL_LEVELS as unknown as string[]);
