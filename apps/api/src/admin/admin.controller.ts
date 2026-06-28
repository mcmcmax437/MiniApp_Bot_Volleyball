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
import { IsIn, IsOptional } from 'class-validator';
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

class ResolveReportDto {
  @IsIn(['REVIEWED', 'DISMISSED']) status!: 'REVIEWED' | 'DISMISSED';
  @IsOptional() ban?: boolean;
  @IsOptional() banReason?: string;
}

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
      isBanned: q.isBanned,
      role: q.role,
      city: q.city,
    });
  }

  @Get('users/:id')
  getUser(@Param('id') id: string) {
    return this.admin.getUser(id);
  }

  private requireMe(me: User | null): User {
    if (!me) throw new UnauthorizedException('User not found');
    return me;
  }

  @Patch('users/:id')
  updateUser(
    @CurrentUser() me: User | null,
    @Param('id') id: string,
    @Body() dto: AdminUpdateUserDto,
  ) {
    return this.admin.updateUser(this.requireMe(me).id, id, dto);
  }

  @Post('users/:id/ban')
  banUser(
    @CurrentUser() me: User | null,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.admin.updateUser(this.requireMe(me).id, id, {
      isBanned: true,
      bannedReason: body.reason,
    });
  }

  @Post('users/:id/unban')
  unbanUser(@CurrentUser() me: User | null, @Param('id') id: string) {
    return this.admin.updateUser(this.requireMe(me).id, id, { isBanned: false });
  }

  @Delete('users/:id')
  deleteUser(@CurrentUser() me: User | null, @Param('id') id: string) {
    return this.admin.deleteUser(this.requireMe(me).id, id);
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
    return this.admin.updateGame(this.requireMe(me).id, id, dto);
  }

  @Post('games/:id/cancel')
  cancelGame(@CurrentUser() me: User | null, @Param('id') id: string) {
    return this.admin.cancelGame(this.requireMe(me).id, id);
  }

  @Delete('games/:id')
  deleteGame(@CurrentUser() me: User | null, @Param('id') id: string) {
    return this.admin.deleteGame(this.requireMe(me).id, id);
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
    return this.admin.updateVenue(this.requireMe(me).id, id, dto);
  }

  @Delete('venues/:id')
  deleteVenue(@CurrentUser() me: User | null, @Param('id') id: string) {
    return this.admin.deleteVenue(this.requireMe(me).id, id);
  }

  // ---------- Audit ----------
  @Get('audit')
  audit(@Query() q: AdminListQuery) {
    return this.admin.listAudit({
      take: q.take ?? 50,
      skip: q.skip ?? 0,
    });
  }

  // ---------- Reports ----------
  @Get('reports')
  reports(
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('status') status?: 'OPEN' | 'REVIEWED' | 'DISMISSED',
  ) {
    return this.admin.listReports({
      take: take ? Number(take) : 50,
      skip: skip ? Number(skip) : 0,
      status,
    });
  }

  @Post('reports/:id/resolve')
  async resolveReport(
    @CurrentUser() me: User | null,
    @Param('id') id: string,
    @Body() dto: ResolveReportDto,
  ) {
    const actorId = this.requireMe(me).id;
    const resolved = await this.admin.resolveReport(actorId, id, dto.status);
    if (dto.ban) {
      const target = (resolved as any).targetId as string | undefined;
      // The report record has targetId. We re-fetch and ban.
      if (target) {
        await this.admin.updateUser(actorId, target, {
          isBanned: true,
          bannedReason: dto.banReason ?? 'Banned via report review',
        });
      }
    }
    return resolved;
  }

  // ---------- Analytics / heatmap ----------
  @Get('analytics/heatmap')
  heatmap(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('screen') screen?: string,
  ) {
    return this.admin.heatmap({ from, to, screen });
  }
}