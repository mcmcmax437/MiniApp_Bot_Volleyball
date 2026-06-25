import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AdminService } from './admin.service';
import {
  AdminListQuery,
  AdminUpdateGameDto,
  AdminUpdateUserDto,
  AdminUpdateVenueDto,
} from './dto';
import type { User } from '@prisma/client';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats')
  stats() {
    return this.admin.getStats();
  }

  // ---------- Users ----------
  @Get('users')
  listUsers(@Query() q: AdminListQuery) {
    return this.admin.listUsers({
      take: q.take ?? 50,
      skip: q.skip ?? 0,
      q: q.q,
    });
  }

  @Get('users/:id')
  getUser(@Param('id') id: string) {
    return this.admin.getUser(id);
  }

  @Patch('users/:id')
  updateUser(
    @CurrentUser() me: User | null,
    @Param('id') id: string,
    @Body() dto: AdminUpdateUserDto,
  ) {
    return this.admin.updateUser(me!.id, id, dto);
  }

  @Delete('users/:id')
  deleteUser(@CurrentUser() me: User | null, @Param('id') id: string) {
    return this.admin.deleteUser(me!.id, id);
  }

  // ---------- Games ----------
  @Get('games')
  listGames(@Query() q: AdminListQuery) {
    return this.admin.listGames({
      take: q.take ?? 50,
      skip: q.skip ?? 0,
      q: q.q,
    });
  }

  @Patch('games/:id')
  updateGame(
    @CurrentUser() me: User | null,
    @Param('id') id: string,
    @Body() dto: AdminUpdateGameDto,
  ) {
    return this.admin.updateGame(me!.id, id, dto);
  }

  @Delete('games/:id')
  deleteGame(@CurrentUser() me: User | null, @Param('id') id: string) {
    return this.admin.deleteGame(me!.id, id);
  }

  // ---------- Venues ----------
  @Get('venues')
  listVenues(@Query() q: AdminListQuery) {
    return this.admin.listVenues({
      take: q.take ?? 50,
      skip: q.skip ?? 0,
      q: q.q,
    });
  }

  @Patch('venues/:id')
  updateVenue(
    @CurrentUser() me: User | null,
    @Param('id') id: string,
    @Body() dto: AdminUpdateVenueDto,
  ) {
    return this.admin.updateVenue(me!.id, id, dto);
  }

  @Delete('venues/:id')
  deleteVenue(@CurrentUser() me: User | null, @Param('id') id: string) {
    return this.admin.deleteVenue(me!.id, id);
  }

  // ---------- Audit ----------
  @Get('audit')
  audit(@Query() q: AdminListQuery) {
    return this.admin.listAudit({
      take: q.take ?? 50,
      skip: q.skip ?? 0,
    });
  }
}