import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { GamesService } from './games.service';
import { CreateGameDto, ListGamesQuery } from './dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { User } from '@prisma/client';

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
    if (!me) throw new Error('unauthorized');
    return this.games.create(me, dto);
  }

  @Post(':id/join')
  @UseGuards(JwtAuthGuard)
  join(@CurrentUser() me: User | null, @Param('id') id: string) {
    if (!me) throw new Error('unauthorized');
    return this.games.join(me, id);
  }

  @Post(':id/leave')
  @UseGuards(JwtAuthGuard)
  leave(@CurrentUser() me: User | null, @Param('id') id: string) {
    if (!me) throw new Error('unauthorized');
    return this.games.leave(me, id);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  cancel(@CurrentUser() me: User | null, @Param('id') id: string) {
    if (!me) throw new Error('unauthorized');
    return this.games.cancel(me, id);
  }
}
