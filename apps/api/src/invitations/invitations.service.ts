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
    if (game.status !== 'OPEN' && game.status !== 'FULL') {
      throw new BadRequestException(`Cannot invite to a ${game.status} game`);
    }
    if (game.endAt.getTime() <= Date.now()) {
      throw new BadRequestException('Game has already ended');
    }
    const invitee = await this.prisma.user.findUnique({ where: { id: inviteeId } });
    if (!invitee) throw new NotFoundException('Invitee not found');
    if (invitee.isBanned) {
      throw new BadRequestException('Cannot invite a banned user');
    }

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

  /**
   * Invitee responds to an invite. Accept seats the player (same payment /
   * capacity rules as open join). Failures throw so the invite stays PENDING
   * and the client can show the real error — never mark ACCEPTED without seating.
   */
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

    if (!accept) {
      await this.prisma.gameInvitation.update({
        where: { id: invitationId },
        data: {
          status: 'DECLINED',
          respondedAt: new Date(),
        },
      });
      return { ok: true };
    }

    // Host already invited this person — seat them even on closed lobbies.
    // Validate capacity / status before flipping the invite to ACCEPTED.
    if (inv.game.status !== 'OPEN' && inv.game.status !== 'FULL') {
      throw new BadRequestException(`Game is ${inv.game.status}`);
    }
    if (inv.game.endAt.getTime() <= Date.now()) {
      throw new BadRequestException('Game has already ended');
    }

    await this.prisma.$transaction(async (tx) => {
      const count = await tx.gameParticipant.count({ where: { gameId: inv.gameId } });
      if (count >= inv.game.spotsTotal) {
        throw new ConflictException('Game is full');
      }

      await tx.gameParticipant.upsert({
        where: { gameId_userId: { gameId: inv.gameId, userId: me.id } },
        create: { gameId: inv.gameId, userId: me.id },
        update: {},
      });

      const after = await tx.gameParticipant.count({ where: { gameId: inv.gameId } });
      if (after >= inv.game.spotsTotal) {
        await tx.game.update({
          where: { id: inv.gameId },
          data: { status: 'FULL' },
        });
      }

      if (inv.game.isPaid) {
        const amount =
          after > 0 ? Math.round(inv.game.totalCost / after) : inv.game.totalCost;
        await tx.gamePayment.upsert({
          where: { gameId_userId: { gameId: inv.gameId, userId: me.id } },
          create: {
            gameId: inv.gameId,
            userId: me.id,
            amount,
            currency: inv.game.currency,
          },
          update: { amount },
        });
      }

      // Drop any pending join-request the invitee may have filed earlier.
      await tx.gameJoinRequest.deleteMany({
        where: { gameId: inv.gameId, userId: me.id, status: 'PENDING' },
      });

      await tx.gameInvitation.update({
        where: { id: invitationId },
        data: {
          status: 'ACCEPTED',
          respondedAt: new Date(),
        },
      });
    });

    return { ok: true };
  }

  /** Pending invites the current user has received. */
  async listMinePending(me: User) {
    return this.prisma.gameInvitation.findMany({
      where: { inviteeId: me.id, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: {
        inviter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            photoUrl: true,
          },
        },
        game: {
          include: {
            venue: { select: { id: true, name: true, address: true, city: true } },
          },
        },
      },
    });
  }
}
