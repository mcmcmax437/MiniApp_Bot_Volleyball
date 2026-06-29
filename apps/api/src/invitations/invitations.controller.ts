import { Body, Controller, Delete, Get, Param, Post, Query, UnauthorizedException, UseGuards } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { InvitationsService } from './invitations.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import type { User } from '@prisma/client';

class InviteDto {
  @IsString() inviteeId!: string;
}

class RespondDto {
  @IsBoolean() accept!: boolean;
}

@UseGuards(JwtAuthGuard)
@Controller()
export class InvitationsController {
  constructor(
    private readonly inv: InvitationsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('games/:gameId/invitations')
  invite(
    @CurrentUser() me: User | null,
    @Param('gameId') gameId: string,
    @Body() dto: InviteDto,
  ) {
    if (!me) throw new UnauthorizedException('User not found');
    return this.inv.invite(me, gameId, dto.inviteeId);
  }

  @Delete('invitations/:id')
  cancelInvite(@CurrentUser() me: User | null, @Param('id') id: string) {
    if (!me) throw new UnauthorizedException('User not found');
    return this.inv.cancelInvite(me, id);
  }

  @Post('invitations/:id/respond')
  respond(
    @CurrentUser() me: User | null,
    @Param('id') id: string,
    @Body() dto: RespondDto,
  ) {
    if (!me) throw new UnauthorizedException('User not found');
    return this.inv.respond(me, id, dto.accept);
  }

  @Get('invitations/mine')
  listMine(@CurrentUser() me: User | null) {
    if (!me) throw new UnauthorizedException('User not found');
    return this.inv.listMinePending(me);
  }

  /**
   * Lightweight user search used by the host's "Invite players" UI. The client
   * passes `q` (free-text query against firstName/lastName/username) and
   * `exclude` (comma-separated user IDs already in the game or invited).
   *
   * Empty `q` returns the most recent users in the same city as the host so
   * the modal has something to show by default. We never expose telegramId,
   * phone, or any other private field — only the public profile shape.
   */
  @Get('users/search')
  async searchInvitees(
    @CurrentUser() me: User | null,
    @Query('q') q?: string,
    @Query('exclude') exclude?: string,
  ) {
    if (!me) throw new UnauthorizedException('User not found');

    const excludeIds = (exclude ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const term = (q ?? '').trim();

    const where: any = {
      isBanned: false,
      // Don't suggest the host themselves.
      NOT: { id: me.id },
    };
    if (excludeIds.length) where.id = { notIn: excludeIds };

    // Two strategies:
    //   - With a search term: case-insensitive contains on first/last/username.
    //   - Without a term:    show recent users in the host's city as a fallback.
    if (term) {
      where.OR = [
        { firstName: { contains: term } },
        { lastName: { contains: term } },
        { username: { contains: term } },
      ];
    } else if (me.city) {
      where.city = me.city;
    }

    const users = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        username: true,
        photoUrl: true,
        skillLevel: true,
      },
    });

    return { users };
  }
}