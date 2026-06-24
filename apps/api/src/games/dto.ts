import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { SKILL_LEVELS } from '../venues/dto';

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
  @Max(40)
  spotsTotal!: number;

  @IsInt()
  @Min(0)
  @Max(10_000_000)
  totalCost!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
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
}
