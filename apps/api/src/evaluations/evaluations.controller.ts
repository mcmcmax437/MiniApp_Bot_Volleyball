import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { EvaluationsService } from './evaluations.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SKILL_LEVELS } from '../shared/skill-levels';
import type { User } from '@prisma/client';

class EvalItem {
  @IsString() evaluateeId!: string;
  @IsIn(SKILL_LEVELS as unknown as string[])
  skillLevel!: (typeof SKILL_LEVELS)[number];
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

class SubmitDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => EvalItem)
  items!: EvalItem[];
}

@UseGuards(JwtAuthGuard)
@Controller()
export class EvaluationsController {
  constructor(private readonly evaluations: EvaluationsService) {}

  @Get('games/:gameId/evaluations')
  listMine(@CurrentUser() me: User | null, @Param('gameId') gameId: string) {
    return this.evaluations.listMine(me!, gameId);
  }

  @Get('games/:gameId/evaluations/candidates')
  candidates(@CurrentUser() me: User | null, @Param('gameId') gameId: string) {
    return this.evaluations.listEligibleEvaluators(me!, gameId);
  }

  @Post('games/:gameId/evaluations')
  submit(
    @CurrentUser() me: User | null,
    @Param('gameId') gameId: string,
    @Body() dto: SubmitDto,
  ) {
    return this.evaluations.submitMany(me!, gameId, dto.items);
  }
}