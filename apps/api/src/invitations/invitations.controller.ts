import { Body, Controller, Delete, Get, Param, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { IsBoolean, IsString } from 'class-validator';
import { InvitationsService } from './invitations.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
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
  constructor(private readonly inv: InvitationsService) {}

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
}