import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramSender } from '../bot/telegram-sender';
import type { User } from '@prisma/client';

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bot: TelegramSender,
  ) {}

  /** Host invites a player to their game. */
  async invite(me: User, gameId: string, inviteeId: string) {
    if (inviteeId === me.id) {
      throw new BadRequestException('Cannot invite yourself');
    }
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) throw new NotFoundException('Game not found');
    if (game.hostId !== me.id) {
      throw new ForbiddenException('Only the host can invite players');
    }
    if (game.status !== 'OPEN') {
      throw new BadRequestException(`Cannot invite to a ${game.status} game`);
    }
    const invitee = await this.prisma.user.findUnique({ where: { id: inviteeId } });
    if (!invitee) throw new NotFoundException('Invitee not found');

    // Don't double-add: if they're already a participant, just no-op.
    const already = await this.prisma.gameParticipant.findUnique({
      where: { gameId_userId: { gameId, userId: inviteeId } },
    });
    if (already) {
      throw new ConflictException('User already joined this game');
    }

    const invitation = await this.prisma.gameInvitation.upsert({
      where: { gameId_inviteeId: { gameId, inviteeId } },
      create: {
        gameId,
        inviteeId,
        inviterId: me.id,
        status: 'PENDING',
      },
      update: { status: 'PENDING' },
    });

    // Best-effort Telegram DM
    this.bot
      .sendToTelegramId(
        invitee.telegramId,
        `🎾 ${me.firstName} invited you to a volleyball game on ${new Date(game.startAt).toLocaleString()}. Open the bot to respond.`,
      )
      .catch(() => undefined);

    return invitation;
  }

  /** Host cancels an invite they've sent. */
  async cancelInvite(me: User, invitationId: string) {
    const inv = await this.prisma.gameInvitation.findUnique({ where: { id: invitationId } });
    if (!inv) throw new NotFoundException('Invitation not found');
    const game = await this.prisma.game.findUnique({ where: { id: inv.gameId } });
    if (!game || game.hostId !== me.id) {
      throw new ForbiddenException('Only the host can cancel an invite');
    }
    await this.prisma.gameInvitation.delete({ where: { id: invitationId } });
    return { ok: true };
  }

  /** Invitee responds to an invite. */
  async respond(me: User, invitationId: string, accept: boolean) {
    const inv = await this.prisma.gameInvitation.findUnique({
      where: { id: invitationId },
      include: { game: true },
    });
    if (!inv) throw new NotFoundException('Invitation not found');
    if (inv.inviteeId !== me.id) {
      throw new ForbiddenException('Not your invitation');
    }
    if (inv.status !== 'PENDING') return inv;

    await this.prisma.gameInvitation.update({
      where: { id: invitationId },
      data: {
        status: accept ? 'ACCEPTED' : 'DECLINED',
        respondedAt: new Date(),
      },
    });

    if (accept) {
      // Add the invitee as a participant if there's room and game is open.
      if (inv.game.status !== 'OPEN') return { ok: true };
      const count = await this.prisma.gameParticipant.count({ where: { gameId: inv.gameId } });
      if (count >= inv.game.spotsTotal) return { ok: true };

      await this.prisma.gameParticipant.upsert({
        where: { gameId_userId: { gameId: inv.gameId, userId: me.id } },
        create: { gameId: inv.gameId, userId: me.id },
        update: {},
      });
      // Re-mark as full if needed
      const after = await this.prisma.gameParticipant.count({ where: { gameId: inv.gameId } });
      if (after >= inv.game.spotsTotal) {
        await this.prisma.game.update({
          where: { id: inv.gameId },
          data: { status: 'FULL' },
        });
      }
    }

    return { ok: true };
  }

  /** Pending invites the current user has received. */
  async listMinePending(me: User) {
    return this.prisma.gameInvitation.findMany({
      where: { inviteeId: me.id, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: {
        game: {
          include: {
            venue: { select: { id: true, name: true, address: true } },
          },
        },
        inviter: {
          select: { id: true, firstName: true, lastName: true, username: true, photoUrl: true },
        },
      },
    });
  }
}