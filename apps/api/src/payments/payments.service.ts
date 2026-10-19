import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GamesService } from '../games/games.service';
import { AnalyticsService } from '../analytics/analytics.service';
import type { PaymentMethod, User } from '@prisma/client';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly games: GamesService,
    private readonly analytics: AnalyticsService,
  ) {}

  /** List payments for a game (host view). */
  async listForGame(me: User, gameId: string) {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) throw new NotFoundException('Game not found');
    if (game.hostId !== me.id && me.role !== 'ADMIN') {
      throw new ForbiddenException('Only the host or admin can see payments');
    }

    const [payments, participants] = await Promise.all([
      this.prisma.gamePayment.findMany({
        where: { gameId },
        orderBy: { paidAt: 'desc' },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, username: true, photoUrl: true, role: true },
          },
        },
      }),
      this.prisma.gameParticipant.findMany({
        where: { gameId },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, username: true, photoUrl: true, role: true },
          },
        },
        orderBy: { joinedAt: 'asc' },
      }),
    ]);

    const byUser = new Map(payments.map((p) => [p.userId, p]));
    const perPlayer = this.games.perPlayerCost(game.totalCost, participants.length);
    return {
      currency: game.currency,
      totalCost: game.totalCost,
      perPlayer,
      participants: participants.map((p) => {
        const payment = byUser.get(p.userId);
        const method = payment?.method ?? null;
        const isPaid = !!(payment?.isPaid && method);
        return {
          userId: p.userId,
          user: p.user,
          joinedAt: p.joinedAt,
          amount: payment?.amount ?? perPlayer,
          // Unpaid by default: nothing selected (no method).
          isPaid,
          method: isPaid ? method : null,
          paidAt: isPaid ? payment?.paidAt ?? null : null,
          note: payment?.note ?? null,
        };
      }),
    };
  }

  /**
   * Set how a participant paid. `method = null` → unpaid (no checkmark).
   * `CASH` / `BANK` → paid with that method (mutually exclusive).
   */
  async setMethod(
    me: User,
    gameId: string,
    userId: string,
    method: PaymentMethod | null,
  ) {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) throw new NotFoundException('Game not found');
    if (game.hostId !== me.id && me.role !== 'ADMIN') {
      throw new ForbiddenException('Only the host or admin can mark paid');
    }
    if (!game.isPaid) {
      throw new BadRequestException('Game is not marked as paid');
    }

    const count = await this.prisma.gameParticipant.count({ where: { gameId } });
    const perPlayer = this.games.perPlayerCost(game.totalCost, count);
    const isPaid = method != null;

    return this.prisma.gamePayment.upsert({
      where: { gameId_userId: { gameId, userId } },
      create: {
        gameId,
        userId,
        amount: perPlayer,
        currency: game.currency,
        isPaid,
        method,
        paidAt: isPaid ? new Date() : null,
      },
      update: {
        isPaid,
        method,
        paidAt: isPaid ? new Date() : null,
      },
    }).then((row) => {
      void this.analytics.trackEvent(me.id, 'payment_mark', {
        screen: `/games/${gameId}`,
        target: userId,
        meta: { isPaid, method, gameId },
      });
      return row;
    });
  }

  /** My payments across all games. */
  async listMine(me: User) {
    return this.prisma.gamePayment.findMany({
      where: { userId: me.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        game: {
          include: {
            venue: { select: { id: true, name: true } },
            host: { select: { id: true, firstName: true, lastName: true, username: true } },
          },
        },
      },
    });
  }
}
