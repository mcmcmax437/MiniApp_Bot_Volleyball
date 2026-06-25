import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GamesService } from '../games/games.service';
import type { User } from '@prisma/client';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly games: GamesService,
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
            select: { id: true, firstName: true, lastName: true, username: true, photoUrl: true },
          },
        },
      }),
      this.prisma.gameParticipant.findMany({
        where: { gameId },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, username: true, photoUrl: true },
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
        return {
          userId: p.userId,
          user: p.user,
          joinedAt: p.joinedAt,
          amount: payment?.amount ?? perPlayer,
          isPaid: payment?.isPaid ?? false,
          paidAt: payment?.paidAt ?? null,
          note: payment?.note ?? null,
        };
      }),
    };
  }

  /** Toggle "paid" for a single participant. Host-only. */
  async setPaid(me: User, gameId: string, userId: string, isPaid: boolean) {
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

    return this.prisma.gamePayment.upsert({
      where: { gameId_userId: { gameId, userId } },
      create: {
        gameId,
        userId,
        amount: perPlayer,
        currency: game.currency,
        isPaid,
        paidAt: isPaid ? new Date() : null,
      },
      update: {
        isPaid,
        paidAt: isPaid ? new Date() : null,
      },
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