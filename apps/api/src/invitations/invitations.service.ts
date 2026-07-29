import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramSender } from '../bot/telegram-sender';
import { inviteMessage, inviteResponseMessage } from '../bot/notify-messages';
import { InvitationsRealtimeService } from './invitations-realtime.service';
import { AnalyticsService } from '../analytics/analytics.service';
import type { User } from '@prisma/client';

type InviteOutcome = 'accepted' | 'declined' | 'ignored';

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bot: TelegramSender,
    private readonly realtime: InvitationsRealtimeService,
    private readonly analytics: AnalyticsService,
  ) {}

  /** Host invites a player to their game. */
  async invite(me: User, gameId: string, inviteeId: string) {
    if (inviteeId === me.id) {
      throw new BadRequestException('Cannot invite yourself');
    }
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: { venue: { select: { name: true, address: true } } },
    });
    if (!game) throw new NotFoundException('Game not found');
    if (game.hostId !== me.id) {
      throw new ForbiddenException('Only the host can invite players');
    }
    if (game.status !== 'OPEN' && game.status !== 'FULL') {
      throw new BadRequestException(`Cannot invite to a ${game.status} game`);
    }
    if (game.status === 'FULL') {
      throw new BadRequestException('Game is full — invites are inactive');
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
      // Re-invite resets delivery / response state so ticks restart.
      update: {
        status: 'PENDING',
        inviterId: me.id,
        readAt: null,
        respondedAt: null,
      },
    });

    // Push to any open Mini App SSE stream for this invitee (near-instant icon).
    this.realtime.publishInvite(inviteeId, {
      invitationId: invitation.id,
      gameId,
    });

    // Best-effort Telegram DM (rich HTML + Open App button).
    const inviterName = me.lastName ? `${me.firstName} ${me.lastName}` : me.firstName;
    const locale = invitee.language ?? 'en';
    this.bot
      .sendToTelegramId(
        invitee.telegramId,
        inviteMessage({
          inviterName,
          venueName: game.venue.name,
          venueAddress: game.venue.address,
          startAt: game.startAt,
          locale,
        }),
        { replyMarkup: this.bot.openAppButton('Open invite', `g_${gameId}`) },
      )
      .catch(() => undefined);

    void this.analytics.trackEvent(me.id, 'invite_send', {
      screen: `/games/${gameId}`,
      target: inviteeId,
      meta: { gameId, invitationId: invitation.id },
    });

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
   * Invitee marks pending invites as read (opened the inbox). Hosts see a
   * double-check in the invite UI once `readAt` is set.
   */
  async markRead(me: User, invitationIds?: string[]) {
    const where: {
      inviteeId: string;
      status: 'PENDING';
      readAt: null;
      id?: { in: string[] };
    } = {
      inviteeId: me.id,
      status: 'PENDING',
      readAt: null,
    };
    if (invitationIds?.length) {
      where.id = { in: invitationIds };
    }

    const unread = await this.prisma.gameInvitation.findMany({
      where,
      select: { id: true, gameId: true, inviterId: true },
    });
    if (!unread.length) return { ok: true, count: 0 };

    const now = new Date();
    await this.prisma.gameInvitation.updateMany({
      where: { id: { in: unread.map((i) => i.id) } },
      data: { readAt: now },
    });

    for (const inv of unread) {
      this.realtime.publishInviteUpdate(inv.inviterId, {
        invitationId: inv.id,
        gameId: inv.gameId,
        status: 'PENDING',
        readAt: now.toISOString(),
        kind: 'read',
      });
    }

    return { ok: true, count: unread.length };
  }

  /** Invitee dismisses without accepting or declining. */
  async ignore(me: User, invitationId: string) {
    const inv = await this.prisma.gameInvitation.findUnique({
      where: { id: invitationId },
      include: {
        game: { include: { venue: { select: { name: true, address: true } } } },
        invitee: true,
      },
    });
    if (!inv) throw new NotFoundException('Invitation not found');
    if (inv.inviteeId !== me.id) {
      throw new ForbiddenException('Not your invitation');
    }
    if (inv.status !== 'PENDING') return { ok: true };

    const updated = await this.prisma.gameInvitation.update({
      where: { id: invitationId },
      data: {
        status: 'IGNORED',
        respondedAt: new Date(),
        readAt: inv.readAt ?? new Date(),
      },
    });

    await this.notifyInviterOfResponse(updated.inviterId, {
      invitationId: updated.id,
      gameId: updated.gameId,
      outcome: 'ignored',
      invitee: inv.invitee,
      venueName: inv.game.venue.name,
      venueAddress: inv.game.venue.address,
      startAt: inv.game.startAt,
    });

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
      include: {
        game: { include: { venue: { select: { name: true, address: true } } } },
        invitee: true,
      },
    });
    if (!inv) throw new NotFoundException('Invitation not found');
    if (inv.inviteeId !== me.id) {
      throw new ForbiddenException('Not your invitation');
    }
    if (inv.status !== 'PENDING') return inv;

    if (!accept) {
      const updated = await this.prisma.gameInvitation.update({
        where: { id: invitationId },
        data: {
          status: 'DECLINED',
          respondedAt: new Date(),
          readAt: inv.readAt ?? new Date(),
        },
      });
      await this.notifyInviterOfResponse(updated.inviterId, {
        invitationId: updated.id,
        gameId: updated.gameId,
        outcome: 'declined',
        invitee: inv.invitee,
        venueName: inv.game.venue.name,
        venueAddress: inv.game.venue.address,
        startAt: inv.game.startAt,
      });
      void this.analytics.trackEvent(me.id, 'invite_decline', {
        screen: `/games/${updated.gameId}`,
        target: updated.id,
      });
      return { ok: true };
    }

    // Host already invited this person — seat them even on closed lobbies.
    // Invites are inactive once the lobby is full, finished, or cancelled.
    if (inv.game.status !== 'OPEN') {
      throw new BadRequestException(
        inv.game.status === 'FULL'
          ? 'Game is full — this invite is inactive'
          : `Game is ${inv.game.status} — this invite is inactive`,
      );
    }
    if (inv.game.endAt.getTime() <= Date.now()) {
      throw new BadRequestException('Game has already ended — this invite is inactive');
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
          readAt: inv.readAt ?? new Date(),
        },
      });
    });

    await this.notifyInviterOfResponse(inv.inviterId, {
      invitationId: inv.id,
      gameId: inv.gameId,
      outcome: 'accepted',
      invitee: inv.invitee,
      venueName: inv.game.venue.name,
      venueAddress: inv.game.venue.address,
      startAt: inv.game.startAt,
    });

    void this.analytics.trackEvent(me.id, 'invite_accept', {
      screen: `/games/${inv.gameId}`,
      target: invitationId,
    });
    void this.analytics.bumpGameStat(me.id, 'gamesAttended');

    const after = await this.prisma.game.findUnique({
      where: { id: inv.gameId },
      select: { status: true },
    });
    if (after?.status === 'FULL') {
      await this.refreshPendingInvitees(inv.gameId).catch(() => undefined);
    }

    return { ok: true };
  }

  private async notifyInviterOfResponse(
    inviterId: string,
    opts: {
      invitationId: string;
      gameId: string;
      outcome: InviteOutcome;
      invitee: User;
      venueName: string;
      venueAddress?: string | null;
      startAt: Date;
    },
  ) {
    const status =
      opts.outcome === 'accepted'
        ? 'ACCEPTED'
        : opts.outcome === 'declined'
          ? 'DECLINED'
          : 'IGNORED';

    this.realtime.publishInviteUpdate(inviterId, {
      invitationId: opts.invitationId,
      gameId: opts.gameId,
      status,
      kind: 'response',
    });

    const inviter = await this.prisma.user.findUnique({ where: { id: inviterId } });
    if (!inviter) return;

    const inviteeName = opts.invitee.lastName
      ? `${opts.invitee.firstName} ${opts.invitee.lastName}`
      : opts.invitee.firstName;

    this.bot
      .sendToTelegramId(
        inviter.telegramId,
        inviteResponseMessage({
          inviteeName,
          outcome: opts.outcome,
          venueName: opts.venueName,
          venueAddress: opts.venueAddress,
          startAt: opts.startAt,
          locale: inviter.language ?? 'en',
        }),
        { replyMarkup: this.bot.openAppButton('Open game', `g_${opts.gameId}`) },
      )
      .catch(() => undefined);
  }

  /** Pending invites the current user has received (actionable only). */
  async listMinePending(me: User) {
    const rows = await this.prisma.gameInvitation.findMany({
      where: {
        inviteeId: me.id,
        status: 'PENDING',
        // Full / finished / cancelled games leave invites inactive.
        game: { status: 'OPEN' },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        inviter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            photoUrl: true,
            role: true,
          },
        },
        game: {
          include: {
            venue: { select: { id: true, name: true, address: true, city: true } },
            _count: { select: { participants: true } },
          },
        },
      },
    });

    // Hide invites for lobbies that are already at capacity.
    return rows
      .filter((inv) => inv.game._count.participants < inv.game.spotsTotal)
      .map(({ game, ...rest }) => {
        const { _count, ...gameRest } = game;
        return { ...rest, game: gameRest };
      });
  }

  /**
   * System-deactivate pending invites when a game is cancelled / finished
   * (or otherwise no longer joinable). No Telegram ping to the host —
   * this is not a player response.
   */
  async deactivatePendingForGame(gameId: string) {
    const pending = await this.prisma.gameInvitation.findMany({
      where: { gameId, status: 'PENDING' },
      select: { id: true, inviteeId: true, inviterId: true },
    });
    if (!pending.length) return { ok: true, count: 0 };

    const now = new Date();
    await this.prisma.gameInvitation.updateMany({
      where: { id: { in: pending.map((i) => i.id) } },
      data: {
        status: 'IGNORED',
        respondedAt: now,
      },
    });

    for (const inv of pending) {
      // Refresh invitee inbox (drops inactive cards / notify badge).
      this.realtime.publishInvite(inv.inviteeId, {
        invitationId: inv.id,
        gameId,
      });
      this.realtime.publishInviteUpdate(inv.inviterId, {
        invitationId: inv.id,
        gameId,
        status: 'IGNORED',
        kind: 'response',
      });
    }

    return { ok: true, count: pending.length };
  }

  /** Ping invitees so soft-inactive invites (e.g. game just went FULL) drop from inbox. */
  async refreshPendingInvitees(gameId: string) {
    const pending = await this.prisma.gameInvitation.findMany({
      where: { gameId, status: 'PENDING' },
      select: { id: true, inviteeId: true },
    });
    for (const inv of pending) {
      this.realtime.publishInvite(inv.inviteeId, {
        invitationId: inv.id,
        gameId,
      });
    }
  }
}
