import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { GamesService } from './games.service';
import { CreateGameDto, ListGamesQuery, PLAY_TYPES, PlayType } from './dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { NotBannedGuard } from '../auth/not-banned.guard';
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
  @IsOptional() @IsBoolean() isPaid?: boolean;
  @IsOptional() @IsBoolean() isClosed?: boolean;
  @IsOptional() @IsString() @MaxLength(500) coverImageUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(280) addressHint?: string | null;
  @IsOptional() @IsIn(PLAY_TYPES as unknown as string[]) playType?: PlayType;
}

class FinishGameDto {
  // Allow host to mark a game as FINISHED even if not full. v3 requirement.
  @IsOptional() @IsBoolean() force?: boolean;
}

class DecideJoinRequestDto {
  @IsBoolean() accept!: boolean;
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
  @UseGuards(JwtAuthGuard, NotBannedGuard)
  create(@CurrentUser() me: User | null, @Body() dto: CreateGameDto) {
    if (!me) throw new UnauthorizedException('User not found');
    return this.games.create(me, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, NotBannedGuard)
  update(
    @CurrentUser() me: User | null,
    @Param('id') id: string,
    @Body() dto: UpdateGameDto,
  ) {
    if (!me) throw new UnauthorizedException('User not found');
    return this.games.update(me, id, dto);
  }

  @Post(':id/join')
  @UseGuards(JwtAuthGuard, NotBannedGuard)
  join(@CurrentUser() me: User | null, @Param('id') id: string) {
    if (!me) throw new UnauthorizedException('User not found');
    return this.games.join(me, id);
  }

  @Post(':id/leave')
  @UseGuards(JwtAuthGuard, NotBannedGuard)
  leave(@CurrentUser() me: User | null, @Param('id') id: string) {
    if (!me) throw new UnauthorizedException('User not found');
    return this.games.leave(me, id);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard, NotBannedGuard)
  cancel(@CurrentUser() me: User | null, @Param('id') id: string) {
    if (!me) throw new UnauthorizedException('User not found');
    return this.games.cancel(me, id);
  }

  // v3: organizer can finalize the game (mark as FINISHED) even when not full.
  @Post(':id/finish')
  @UseGuards(JwtAuthGuard, NotBannedGuard)
  async finish(
    @CurrentUser() me: User | null,
    @Param('id') id: string,
    @Body() _dto: FinishGameDto,
  ) {
    if (!me) throw new UnauthorizedException('User not found');
    return this.games.finish(me, id);
  }

  @Get(':id/join-requests')
  @UseGuards(JwtAuthGuard, NotBannedGuard)
  listJoinRequests(@CurrentUser() me: User | null, @Param('id') id: string) {
    if (!me) throw new UnauthorizedException('User not found');
    return this.games.listJoinRequests(me, id);
  }

  @Post(':id/join-requests/:requestId')
  @UseGuards(JwtAuthGuard, NotBannedGuard)
  decideJoinRequest(
    @CurrentUser() me: User | null,
    @Param('id') id: string,
    @Param('requestId') requestId: string,
    @Body() dto: DecideJoinRequestDto,
  ) {
    if (!me) throw new UnauthorizedException('User not found');
    return this.games.decideJoinRequest(me, id, requestId, dto.accept);
  }
}