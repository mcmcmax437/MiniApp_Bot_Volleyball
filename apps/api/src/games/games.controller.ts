import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { GamesService } from './games.service';
import { CreateGameDto, ListGamesQuery } from './dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SKILL_LEVELS } from '../shared/skill-levels';
import type { User } from '@prisma/client';

class UpdateGameDto {
  @IsOptional() @IsString() startAt?: string;
  @IsOptional() @IsString() endAt?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string | null;
  @IsOptional() @IsIn(SKILL_LEVELS as unknown as string[]) skillLevel?: (typeof SKILL_LEVELS)[number];
  @IsOptional() @IsInt() @Min(2) @Max(1000) spotsTotal?: number;
  @IsOptional() @IsInt() @Min(0) @Max(10_000_000) totalCost?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() isPaid?: boolean;
  @IsOptional() isClosed?: boolean;
  @IsOptional() @IsString() @MaxLength(500) coverImageUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(280) addressHint?: string | null;
}

class FinishGameDto {
  // Allow host to mark a game as FINISHED even if not full. v3 requirement.
  @IsOptional() force?: boolean;
}

@Controller('games')
export class GamesController {
  constructor(private readonly games: GamesService) {}

  @Get()
  list(@Query() q: ListGamesQuery) {
    return this.games.list(q);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.games.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() me: User | null, @Body() dto: CreateGameDto) {
    if (!me) throw new UnauthorizedException('User not found');
    return this.games.create(me, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @CurrentUser() me: User | null,
    @Param('id') id: string,
    @Body() dto: UpdateGameDto,
  ) {
    if (!me) throw new UnauthorizedException('User not found');
    return this.games.update(me, id, dto);
  }

  @Post(':id/join')
  @UseGuards(JwtAuthGuard)
  join(@CurrentUser() me: User | null, @Param('id') id: string) {
    if (!me) throw new UnauthorizedException('User not found');
    return this.games.join(me, id);
  }

  @Post(':id/leave')
  @UseGuards(JwtAuthGuard)
  leave(@CurrentUser() me: User | null, @Param('id') id: string) {
    if (!me) throw new UnauthorizedException('User not found');
    return this.games.leave(me, id);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  cancel(@CurrentUser() me: User | null, @Param('id') id: string) {
    if (!me) throw new UnauthorizedException('User not found');
    return this.games.cancel(me, id);
  }

  // v3: organizer can finalize the game (mark as FINISHED) even when not full.
  @Post(':id/finish')
  @UseGuards(JwtAuthGuard)
  async finish(
    @CurrentUser() me: User | null,
    @Param('id') id: string,
    @Body() _dto: FinishGameDto,
  ) {
    if (!me) throw new UnauthorizedException('User not found');
    return this.games.finish(me, id);
  }
}