import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SchedulerService } from '../scheduler/scheduler.service';
import { CreateGameDto } from './dto';
import type { User } from '@prisma/client';

@Injectable()
export class GamesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduler: SchedulerService,
  ) {}

  /** Per-player cost for a game given the current number of participants. */
  perPlayerCost(totalCost: number, participantCount: number): number {
    if (participantCount <= 0) return totalCost;
    return Math.round(totalCost / participantCount);
  }

  async create(me: User, dto: CreateGameDto) {
    const venue = await this.prisma.venue.findUnique({ where: { id: dto.venueId } });
    if (!venue) throw new NotFoundException('Venue not found');

    const start = new Date(dto.startAt);
    const end = new Date(dto.endAt);
    if (!(start < end)) throw new BadRequestException('startAt must be before endAt');
    if (start < new Date()) throw new BadRequestException('startAt must be in the future');

    if (dto.spotsTotal > venue.capacity) {
      throw new BadRequestException(`spotsTotal exceeds venue capacity (${venue.capacity})`);
    }

    const game = await this.prisma.game.create({
      data: {
        venueId: dto.venueId,
        hostId: me.id,
        startAt: start,
        endAt: end,
        skillLevel: dto.skillLevel,
        spotsTotal: dto.spotsTotal,
        notes: dto.notes ?? null,
        totalCost: dto.totalCost,
        status: 'OPEN',
        participants: {
          create: { userId: me.id },
        },
      },
      include: { participants: true },
    });

    return this.findOne(game.id);
  }

  async findOne(id: string) {
    const game = await this.prisma.game.findUnique({
      where: { id },
      include: {
        venue: true,
        host: { select: { id: true, firstName: true, lastName: true, username: true, skillLevel: true } },
        participants: {
          include: { user: { select: { id: true, firstName: true, lastName: true, username: true } } },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });
    if (!game) throw new NotFoundException('Game not found');

    return {
      ...game,
      participantsCount: game.participants.length,
      perPlayerCost: this.perPlayerCost(game.totalCost, game.participants.length),
    };
  }

  async list(opts: { city?: string; from?: string; to?: string; skillLevel?: string }) {
    const where: any = { status: { in: ['OPEN', 'FULL'] } };
    if (opts.from || opts.to) {
      where.startAt = {};
      if (opts.from) where.startAt.gte = new Date(opts.from);
      if (opts.to) where.startAt.lte = new Date(opts.to);
    } else {
      where.startAt = { gte: new Date() };
    }
    if (opts.skillLevel) where.skillLevel = opts.skillLevel;

    const games = await this.prisma.game.findMany({
      where,
      orderBy: { startAt: 'asc' },
      include: {
        venue: { select: { id: true, name: true, address: true, lat: true, lng: true, indoor: true, city: true } },
        host: { select: { id: true, firstName: true, username: true, skillLevel: true } },
        participants: { select: { userId: true } },
      },
      take: 100,
    });

    const filtered = opts.city
      ? games.filter((g) => g.venue.city === opts.city)
      : games;

    return filtered.map((g) => ({
      ...g,
      participantsCount: g.participants.length,
      perPlayerCost: this.perPlayerCost(g.totalCost, g.participants.length),
    }));
  }

  async join(me: User, gameId: string) {
    return this.prisma.$transaction(async (tx) => {
      const game = await tx.game.findUnique({
        where: { id: gameId },
        include: { participants: true },
      });
      if (!game) throw new NotFoundException('Game not found');
      if (game.status !== 'OPEN') throw new BadRequestException(`Game is ${game.status}`);
      if (game.participants.length >= game.spotsTotal) throw new ConflictException('Game is full');

      const already = game.participants.find((p) => p.userId === me.id);
      if (already) return this.findOne(gameId);

      await tx.gameParticipant.create({ data: { gameId, userId: me.id } });

      const updated = await tx.game.findUnique({
        where: { id: gameId },
        include: { participants: true },
      });
      if (updated && updated.participants.length >= updated.spotsTotal) {
        await tx.game.update({ where: { id: gameId }, data: { status: 'FULL' } });
      }
      return this.findOne(gameId);
    });
  }

  async leave(me: User, gameId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const game = await tx.game.findUnique({
        where: { id: gameId },
        include: { participants: true },
      });
      if (!game) throw new NotFoundException('Game not found');

      const isHost = game.hostId === me.id;
      const isParticipant = game.participants.some((p) => p.userId === me.id);
      if (!isHost && !isParticipant) throw new ForbiddenException('Not a participant');

      await tx.gameParticipant.deleteMany({ where: { gameId, userId: me.id } });

      const updated = await tx.game.findUnique({
        where: { id: gameId },
        include: { participants: true },
      });
      if (updated && updated.status === 'FULL' && updated.participants.length < updated.spotsTotal) {
        await tx.game.update({ where: { id: gameId }, data: { status: 'OPEN' } });
      }
      if (isHost) {
        // Host leaving cancels the game for everyone.
        await tx.game.update({ where: { id: gameId }, data: { status: 'CANCELLED' } });
      }
      return { wasHost: isHost };
    });

    if (result.wasHost) {
      await this.scheduler.notifyCancelled(gameId).catch(() => undefined);
    }
    return this.findOne(gameId);
  }

  async cancel(me: User, gameId: string) {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) throw new NotFoundException('Game not found');
    if (game.hostId !== me.id) throw new ForbiddenException('Only host can cancel');
    await this.prisma.game.update({ where: { id: gameId }, data: { status: 'CANCELLED' } });
    await this.scheduler.notifyCancelled(gameId).catch(() => undefined);
    return this.findOne(gameId);
  }
}
