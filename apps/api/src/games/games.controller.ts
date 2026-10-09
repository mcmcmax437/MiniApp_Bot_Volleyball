import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { Response } from 'express';
import { promises as fs } from 'node:fs';
import { GamesService } from './games.service';
import { GameCoverService } from './game-cover.service';
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
  @IsOptional() @IsString() @MaxLength(500) coverImageUrl2?: string | null;
  @IsOptional() @IsString() @MaxLength(280) addressHint?: string | null;
  @IsOptional() @IsIn(PLAY_TYPES as unknown as string[]) playType?: PlayType;
  @IsOptional() @IsString() venueId?: string;
  @IsOptional() @IsString() @MaxLength(120) venueName?: string;
  @IsOptional() @IsString() @MaxLength(240) venueAddress?: string;
}

class FinishGameDto {
  // Allow host to mark a game as FINISHED even if not full. v3 requirement.
  @IsOptional() @IsBoolean() force?: boolean;
}

class DecideJoinRequestDto {
  @IsBoolean() accept!: boolean;
}

class CoverImageDto {
  @IsString() base64!: string;
  @IsOptional() @IsString() mime?: string;
}

class UploadCoversDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => CoverImageDto)
  images!: CoverImageDto[];
}

class CreateReservationDto {
  @IsOptional() @IsString() @MaxLength(80) note?: string;
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

  @Get(':id/waitlist/me')
  @UseGuards(JwtAuthGuard, NotBannedGuard)
  waitlistMe(@CurrentUser() me: User | null, @Param('id') id: string) {
    if (!me) throw new UnauthorizedException('User not found');
    return this.games.getWaitlistMe(me, id);
  }

  /** Admin-only count of people who pressed Notify me. */
  @Get(':id/waitlist')
  @UseGuards(JwtAuthGuard, NotBannedGuard)
  listWaitlist(@CurrentUser() me: User | null, @Param('id') id: string) {
    if (!me) throw new UnauthorizedException('User not found');
    return this.games.listWaitlist(me, id);
  }

  @Post(':id/waitlist')
  @UseGuards(JwtAuthGuard, NotBannedGuard)
  joinWaitlist(@CurrentUser() me: User | null, @Param('id') id: string) {
    if (!me) throw new UnauthorizedException('User not found');
    return this.games.joinWaitlist(me, id);
  }

  @Post(':id/waitlist/leave')
  @UseGuards(JwtAuthGuard, NotBannedGuard)
  leaveWaitlist(@CurrentUser() me: User | null, @Param('id') id: string) {
    if (!me) throw new UnauthorizedException('User not found');
    return this.games.leaveWaitlist(me, id);
  }

  /** Admin-only join/leave timeline. */
  @Get(':id/activity')
  @UseGuards(JwtAuthGuard, NotBannedGuard)
  listActivity(@CurrentUser() me: User | null, @Param('id') id: string) {
    if (!me) throw new UnauthorizedException('User not found');
    return this.games.listActivity(me, id);
  }

  /** Host/admin: upload 1–2 custom field photos (base64). */
  @Post(':id/covers')
  @UseGuards(JwtAuthGuard, NotBannedGuard)
  setCovers(
    @CurrentUser() me: User | null,
    @Param('id') id: string,
    @Body() dto: UploadCoversDto,
  ) {
    if (!me) throw new UnauthorizedException('User not found');
    return this.games.setCovers(me, id, dto.images);
  }

  @Delete(':id/covers')
  @UseGuards(JwtAuthGuard, NotBannedGuard)
  clearCovers(@CurrentUser() me: User | null, @Param('id') id: string) {
    if (!me) throw new UnauthorizedException('User not found');
    return this.games.clearCovers(me, id);
  }

  /** Admin holds one incognito seat. */
  @Get(':id/reservations')
  @UseGuards(JwtAuthGuard, NotBannedGuard)
  listReservations(@CurrentUser() me: User | null, @Param('id') id: string) {
    if (!me) throw new UnauthorizedException('User not found');
    return this.games.listReservations(me, id);
  }

  @Post(':id/reservations')
  @UseGuards(JwtAuthGuard, NotBannedGuard)
  addReservation(
    @CurrentUser() me: User | null,
    @Param('id') id: string,
    @Body() dto: CreateReservationDto,
  ) {
    if (!me) throw new UnauthorizedException('User not found');
    return this.games.addReservation(me, id, dto.note);
  }

  @Delete(':id/reservations/:reservationId')
  @UseGuards(JwtAuthGuard, NotBannedGuard)
  removeReservation(
    @CurrentUser() me: User | null,
    @Param('id') id: string,
    @Param('reservationId') reservationId: string,
  ) {
    if (!me) throw new UnauthorizedException('User not found');
    return this.games.removeReservation(me, id, reservationId);
  }
}

/**
 * Public file server for custom game field photos.
 * Path: GET /api/v1/game-covers/:file
 */
@Controller('game-covers')
export class GameCoverController {
  constructor(private readonly covers: GameCoverService) {}

  @Get(':file')
  async serve(@Param('file') file: string, @Res() res: Response) {
    if (!this.covers.isSafeFileName(file)) {
      return res.status(404).end();
    }
    const fp = this.covers.absolutePath(file);
    try {
      await fs.access(fp);
    } catch {
      return res.status(404).end();
    }
    const lower = file.toLowerCase();
    const type = lower.endsWith('.png')
      ? 'image/png'
      : lower.endsWith('.webp')
        ? 'image/webp'
        : 'image/jpeg';
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(fp);
  }
}
