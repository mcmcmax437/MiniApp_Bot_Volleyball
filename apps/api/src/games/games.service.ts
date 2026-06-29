import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SchedulerService } from '../scheduler/scheduler.service';
import { CreateGameDto, ListGamesQuery } from './dto';
import { SKILL_BUCKETS, SKILL_LEVELS } from '../shared/skill-levels';
import type { User } from '@prisma/client';

const SUPPORTED_CURRENCIES = new Set(['UAH', 'PLN', 'EUR', 'USD']);

@Injectable()
export class GamesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduler: SchedulerService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Per-player cost for a game given the *current* number of participants.
   * This reflects what each existing participant is actually on the hook for
   * right now (used by the payments screen — e.g. a late joiner sees the
   * per-head price update as more people join). Do NOT use this for the
   * game card / detail summary, which should always show the planned split.
   */
  perPlayerCost(totalCost: number, participantCount: number): number {
    if (participantCount <= 0) return totalCost;
    return Math.round(totalCost / participantCount);
  }

  /**
   * Per-player cost for a game divided by the *capacity* of the game (planned
   * split assuming every spot fills). Used on the game card and detail view
   * so the displayed price doesn't shift around as players join or leave —
   * e.g. a 300 PLN game for 10 spots always shows 30 / player, even when only
   * 2 players are signed up.
   */
  plannedPerPlayerCost(totalCost: number, spotsTotal: number): number {
    if (!Number.isFinite(totalCost) || totalCost <= 0) return 0;
    if (!Number.isFinite(spotsTotal) || spotsTotal <= 0) return 0;
    return Math.round(totalCost / spotsTotal);
  }

  async create(me: User, dto: CreateGameDto) {
    const venue = await this.resolveVenue(me, dto);

    const start = new Date(dto.startAt);
    const end = new Date(dto.endAt);
    if (!(start < end)) throw new BadRequestException('startAt must be before endAt');
    if (start < new Date()) throw new BadRequestException('startAt must be in the future');

    if (dto.spotsTotal > venue.capacity) {
      throw new BadRequestException(`spotsTotal exceeds venue capacity (${venue.capacity})`);
    }

    const currency = dto.currency ?? 'UAH';
    if (!SUPPORTED_CURRENCIES.has(currency)) {
      throw new BadRequestException(`Unsupported currency: ${currency}`);
    }

    const game = await this.prisma.game.create({
      data: {
        venueId: venue.id,
        hostId: me.id,
        startAt: start,
        endAt: end,
        skillLevel: dto.skillLevel,
        spotsTotal: dto.spotsTotal,
        notes: dto.notes ?? null,
        totalCost: dto.totalCost,
        status: 'OPEN',
        currency,
        isPaid: !!dto.isPaid,
        isClosed: !!dto.isClosed,
        coverImageUrl: dto.coverImageUrl ?? null,
        addressHint: dto.addressHint ?? null,
        playType: dto.playType ?? 'OUTDOOR',
        participants: {
          create: { userId: me.id },
        },
      },
      include: { participants: true },
    });

    return this.findOne(game.id);
  }

  private async resolveVenue(me: User, dto: CreateGameDto) {
    if (dto.venueId) {
      const venue = await this.prisma.venue.findUnique({ where: { id: dto.venueId } });
      if (!venue) throw new NotFoundException('Venue not found');
      return venue;
    }

    const normalizedAddress = dto.venueAddress.trim();
    if (!normalizedAddress) {
      throw new BadRequestException('venueAddress is required');
    }

    const city = me.city || this.config.get<string>('DEFAULT_CITY') || 'Unknown';
    const existing = await this.prisma.venue.findFirst({
      where: {
        city,
        address: normalizedAddress,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return existing;

    const defaultLat = Number(this.config.get<string>('DEFAULT_CITY_LAT') ?? 0) || 0;
    const defaultLng = Number(this.config.get<string>('DEFAULT_CITY_LNG') ?? 0) || 0;
    const name =
      dto.venueName?.trim() ||
      normalizedAddress.split(',')[0]?.trim() ||
      normalizedAddress;

    return this.prisma.venue.create({
      data: {
        name: name.slice(0, 120),
        address: normalizedAddress,
        lat: me.lat ?? defaultLat,
        lng: me.lng ?? defaultLng,
        indoor: false,
        surface: null,
        hourlyPrice: 0,
        capacity: Math.max(2, Math.min(40, dto.spotsTotal)),
        city,
        status: 'PUBLISHED',
        submittedById: me.id,
      },
    });
  }

  async findOne(id: string) {
    const game = await this.prisma.game.findUnique({
      where: { id },
      include: {
        venue: true,
        host: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            skillLevel: true,
            photoUrl: true,
          },
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                photoUrl: true,
                skillLevel: true,
              },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
        joinRequests: {
          where: { status: 'PENDING' },
          select: { id: true, userId: true, createdAt: true },
        },
        invitations: {
          where: { status: 'PENDING' },
          select: { id: true, inviteeId: true, inviterId: true, createdAt: true },
        },
        payments: {
          select: {
            id: true,
            userId: true,
            amount: true,
            currency: true,
            isPaid: true,
            paidAt: true,
          },
        },
      },
    });
    if (!game) throw new NotFoundException('Game not found');

    return {
      ...game,
      participantsCount: game.participants.length,
      // Display the *planned* per-player price (total / spotsTotal) so the card
      // and detail view show the same number regardless of who's currently
      // signed up. The actual share each participant owes is computed in
      // PaymentsService and surfaced via `/payments/for-game`.
      perPlayerCost: this.plannedPerPlayerCost(game.totalCost, game.spotsTotal),
    };
  }

  async list(opts: ListGamesQuery) {
    const where: any = { status: { in: ['OPEN', 'FULL'] } };

    if (opts.from || opts.to) {
      where.startAt = {};
      if (opts.from) where.startAt.gte = new Date(opts.from);
      if (opts.to) where.startAt.lte = new Date(opts.to);
    } else {
      where.startAt = { gte: new Date() };
    }

    if (opts.skillLevel) where.skillLevel = opts.skillLevel;
    if (opts.venueId) where.venueId = opts.venueId;
    if (opts.hostId) where.hostId = opts.hostId;
    if (typeof opts.isPaid === 'boolean') where.isPaid = opts.isPaid;
    if (typeof opts.isClosed === 'boolean') where.isClosed = opts.isClosed;
    if (opts.q) where.notes = { contains: opts.q };
    if (opts.playType) where.playType = opts.playType;

    // Bucket quick filter (Beginner/Intermediate/Advanced)
    if (opts.bucket) {
      where.skillLevel = { in: SKILL_BUCKETS[opts.bucket] };
    }

    // Hide closed games by default unless explicitly requested
    const includeClosed = opts.includeClosed ?? false;
    if (!includeClosed && typeof opts.isClosed !== 'boolean') {
      where.isClosed = false;
    }

    // Pre-fetch to allow JS-side filtering on participants count
    const games = await this.prisma.game.findMany({
      where,
      orderBy: { startAt: 'asc' },
      include: {
        venue: {
          select: {
            id: true,
            name: true,
            address: true,
            lat: true,
            lng: true,
            indoor: true,
            city: true,
          },
        },
        host: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            skillLevel: true,
            photoUrl: true,
          },
        },
        participants: { select: { userId: true } },
      },
      take: 200,
    });

    let filtered = opts.city ? games.filter((g) => g.venue.city === opts.city) : games;

    if (typeof opts.hasSpots === 'boolean') {
      filtered = filtered.filter((g) =>
        opts.hasSpots ? g.participants.length < g.spotsTotal : g.participants.length >= g.spotsTotal,
      );
    }

    if (typeof opts.minSpots === 'number') {
      filtered = filtered.filter((g) => g.spotsTotal >= opts.minSpots!);
    }
    if (typeof opts.maxSpots === 'number') {
      filtered = filtered.filter((g) => g.spotsTotal <= opts.maxSpots!);
    }

    return filtered.map((g) => ({
      ...g,
      participantsCount: g.participants.length,
      // Planned split (total / spotsTotal) — see note in `getById`.
      perPlayerCost: this.plannedPerPlayerCost(g.totalCost, g.spotsTotal),
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

      const already = game.participants.find((p) => p.userId === me.id);
      if (already) return this.findOne(gameId);

      // Closed lobbies: host must approve. Re-route to GameJoinRequest.
      if (game.isClosed) {
        const existing = await tx.gameJoinRequest.findUnique({
          where: { gameId_userId: { gameId, userId: me.id } },
        });
        if (existing) {
          if (existing.status === 'REJECTED') {
            throw new ForbiddenException('Your join request was declined');
          }
          return this.findOne(gameId);
        }
        await tx.gameJoinRequest.create({
          data: { gameId, userId: me.id, status: 'PENDING' },
        });
        return this.findOne(gameId);
      }

      if (game.participants.length >= game.spotsTotal) {
        throw new ConflictException('Game is full');
      }

      await tx.gameParticipant.create({ data: { gameId, userId: me.id } });

      const updated = await tx.game.findUnique({
        where: { id: gameId },
        include: { participants: true },
      });
      if (updated && updated.participants.length >= updated.spotsTotal) {
        await tx.game.update({ where: { id: gameId }, data: { status: 'FULL' } });
      }

      // Auto-create a payment record when this is a paid game
      if (game.isPaid) {
        const amount = this.perPlayerCost(game.totalCost, updated!.participants.length);
        await tx.gamePayment.upsert({
          where: { gameId_userId: { gameId, userId: me.id } },
          create: { gameId, userId: me.id, amount, currency: game.currency },
          update: { amount },
        });
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
      // Drop the payment record so it doesn't pollute the host's tracker.
      await tx.gamePayment.deleteMany({ where: { gameId, userId: me.id } });
      // Drop any pending invitation
      await tx.gameInvitation.deleteMany({ where: { gameId, inviteeId: me.id } });

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

  async update(me: User, gameId: string, patch: {
    startAt?: string;
    endAt?: string;
    notes?: string | null;
    skillLevel?: (typeof SKILL_LEVELS)[number];
    spotsTotal?: number;
    totalCost?: number;
    currency?: string;
    isPaid?: boolean;
    isClosed?: boolean;
    coverImageUrl?: string | null;
    addressHint?: string | null;
    playType?: 'INDOOR' | 'OUTDOOR' | 'BEACH';
  }) {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) throw new NotFoundException('Game not found');
    if (game.hostId !== me.id && me.role !== 'ADMIN') {
      throw new ForbiddenException('Only the host or an admin can edit');
    }

    const data: any = {};
    if (patch.startAt) data.startAt = new Date(patch.startAt);
    if (patch.endAt) data.endAt = new Date(patch.endAt);
    if (patch.notes !== undefined) data.notes = patch.notes;
    if (patch.skillLevel) data.skillLevel = patch.skillLevel;
    if (typeof patch.spotsTotal === 'number') {
      if (patch.spotsTotal < game.spotsTotal && patch.spotsTotal < 2) {
        throw new BadRequestException('spotsTotal must be at least 2');
      }
      data.spotsTotal = patch.spotsTotal;
    }
    if (typeof patch.totalCost === 'number') data.totalCost = patch.totalCost;
    if (patch.currency && SUPPORTED_CURRENCIES.has(patch.currency)) data.currency = patch.currency;
    if (typeof patch.isPaid === 'boolean') data.isPaid = patch.isPaid;
    if (typeof patch.isClosed === 'boolean') data.isClosed = patch.isClosed;
    if (patch.coverImageUrl !== undefined) data.coverImageUrl = patch.coverImageUrl;
    if (patch.addressHint !== undefined) data.addressHint = patch.addressHint;
    if (patch.playType) data.playType = patch.playType;

    if (data.startAt && data.endAt && !(data.startAt < data.endAt)) {
      throw new BadRequestException('startAt must be before endAt');
    }

    await this.prisma.game.update({ where: { id: gameId }, data });
    return this.findOne(gameId);
  }

  /**
   * Host (or admin) marks a game as FINISHED. This unlocks the post-game
   * evaluation flow for everyone who attended, and moves the game out of
   * the active queue. Allowed even when the game is not "full" — organizers
   * may finalize a partial game if players didn't show up.
   */
  async finish(me: User, gameId: string) {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) throw new NotFoundException('Game not found');
    if (game.hostId !== me.id && me.role !== 'ADMIN') {
      throw new ForbiddenException('Only the host or an admin can finish the game');
    }
    await this.prisma.game.update({
      where: { id: gameId },
      data: { status: 'FINISHED' },
    });
    return this.findOne(gameId);
  }
}
