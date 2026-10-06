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
import { InvitationsService } from '../invitations/invitations.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { CreateGameDto, ListGamesQuery } from './dto';
import { SKILL_BUCKETS, SKILL_LEVELS } from '../shared/skill-levels';
import { canonicalizeCity, expandCityFilter, foldCity } from '../shared/city';
import type { User, Prisma } from '@prisma/client';
import { GameCoverService } from './game-cover.service';

const SUPPORTED_CURRENCIES = new Set(['UAH', 'PLN', 'EUR', 'USD']);

/** Must match `SchedulerService.autoFinishEndedGames` (startAt + 5h). */
const AUTO_FINISH_MS = 5 * 60 * 60 * 1000;

@Injectable()
export class GamesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduler: SchedulerService,
    private readonly config: ConfigService,
    private readonly invitations: InvitationsService,
    private readonly analytics: AnalyticsService,
    private readonly covers: GameCoverService,
  ) {}

  private async recordActivity(
    db: Prisma.TransactionClient | PrismaService,
    gameId: string,
    userId: string,
    kind: 'JOINED' | 'LEFT',
  ) {
    await db.gameActivity.create({
      data: { gameId, userId, kind },
    });
  }

  /** Real roster + admin-held incognito seats. */
  private async occupiedCounts(
    db: Prisma.TransactionClient | PrismaService,
    gameId: string,
  ) {
    const [players, reserved] = await Promise.all([
      db.gameParticipant.count({ where: { gameId } }),
      db.gameReservation.count({ where: { gameId } }),
    ]);
    return { players, reserved, occupied: players + reserved };
  }

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

    // spotsTotal is the lobby size the host wants — not capped by venue.capacity.
    // Venue capacity is catalog metadata only; hosts often overbook or run
    // multi-court sessions (e.g. 14–20 players at a "12" court listing).
    const spotsTotal = dto.spotsTotal;

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
        spotsTotal,
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

    void this.analytics.trackEvent(me.id, 'game_create', {
      screen: `/games/${game.id}`,
      target: game.id,
      meta: { playType: game.playType, spotsTotal: game.spotsTotal },
    });
    void this.analytics.bumpGameStat(me.id, 'gamesHosted');
    await this.recordActivity(this.prisma, game.id, me.id, 'JOINED').catch(() => undefined);

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

    const defaultCity = this.config.get<string>('DEFAULT_CITY') || 'Unknown';
    const city = canonicalizeCity(me.city || defaultCity, defaultCity);
    const cityAliases = expandCityFilter(city, defaultCity);
    const existing = await this.prisma.venue.findFirst({
      where: {
        city: { in: cityAliases },
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
            // Weighted (peer-corrected) level — the client badge prefers
            // this over the self-declared one. See skill-aggregator.ts.
            evaluatedSkillLevel: true,
            photoUrl: true,
            role: true,
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
                role: true,
                skillLevel: true,
                evaluatedSkillLevel: true,
              },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
        reservations: {
          select: { id: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
        joinRequests: {
          where: { status: 'PENDING' },
          select: {
            id: true,
            userId: true,
            createdAt: true,
            status: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                photoUrl: true,
                role: true,
                skillLevel: true,
                evaluatedSkillLevel: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        invitations: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            inviteeId: true,
            inviterId: true,
            createdAt: true,
            status: true,
            readAt: true,
            respondedAt: true,
            invitee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                photoUrl: true,
              },
            },
          },
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
      // Client historically used `userId` for the invitee on invitation rows.
      invitations: game.invitations.map((inv) => ({
        id: inv.id,
        userId: inv.inviteeId,
        inviteeId: inv.inviteeId,
        inviterId: inv.inviterId,
        createdAt: inv.createdAt,
        status: inv.status,
        readAt: inv.readAt,
        respondedAt: inv.respondedAt,
        invitee: inv.invitee,
      })),
      participantsCount: game.participants.length,
      reservedCount: game.reservations.length,
      reservations: game.reservations.map((r) => ({
        id: r.id,
        createdAt: r.createdAt.toISOString(),
      })),
      // Display the *planned* per-player price (total / spotsTotal) so the card
      // and detail view show the same number regardless of who's currently
      // signed up. The actual share each participant owes is computed in
      // PaymentsService and surfaced via `/payments/for-game`.
      perPlayerCost: this.plannedPerPlayerCost(game.totalCost, game.spotsTotal),
    };
  }

  async list(opts: ListGamesQuery) {
    const now = new Date();
    // Keep games on the feed through the auto-finish window. Filtering with
    // `startAt >= now` hid lobbies the moment kickoff passed — so a game
    // "disappeared after ~20 min" while players were still on court, long
    // before the 5h auto-finish, and they couldn't reopen it to rate.
    const autoFinishHorizon = new Date(now.getTime() - AUTO_FINISH_MS);

    const where: any = {};

    if (opts.from || opts.to) {
      where.status = opts.status ? opts.status : { in: ['OPEN', 'FULL'] };
      where.startAt = {};
      if (opts.from) where.startAt.gte = new Date(opts.from);
      if (opts.to) where.startAt.lte = new Date(opts.to);
    } else if (opts.status) {
      where.status = opts.status;
      where.startAt = { gte: autoFinishHorizon };
    } else {
      // Default Home/Games feed: upcoming + in-progress OPEN/FULL games.
      // Keep lobbies visible from kickoff through the 5h auto-finish window
      // (so a game doesn't vanish mid-match). Finished games are NOT listed
      // here — rating uses `/evaluations/pending` + the Home "Rate players"
      // section instead of polluting "Upcoming".
      where.status = { in: ['OPEN', 'FULL'] };
      where.startAt = { gte: autoFinishHorizon };
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

    // City scope must be in the SQL WHERE (not post-filtered after take:200),
    // otherwise other cities fill the page and local games disappear.
    if (opts.city) {
      const aliases = expandCityFilter(
        opts.city,
        this.config.get<string>('DEFAULT_CITY'),
      ).map((c) => c.trim());
      where.venue = { city: { in: aliases } };
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
            // `evaluatedSkillLevel` is the weighted (peer-corrected) level
            // that the client badge prefers over the self-declared one.
            // See apps/api/src/evaluations/skill-aggregator.ts.
            evaluatedSkillLevel: true,
            photoUrl: true,
            role: true,
          },
        },
        // Public profile for each participant so the home feed can render
        // a row of avatars with skill badges. `user` is the joined User
        // record — we explicitly select the safe public fields and skip
        // anything sensitive (phone, telegramId, etc).
        participants: {
          select: {
            userId: true,
            joinedAt: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                photoUrl: true,
                role: true,
                skillLevel: true,
                evaluatedSkillLevel: true,
              },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
        _count: { select: { reservations: true } },
      },
      take: 200,
    });

    // Extra fold pass for diacritic / casing variants not listed as aliases.
    let filtered = games;
    if (opts.city) {
      const aliases = new Set(
        expandCityFilter(opts.city, this.config.get<string>('DEFAULT_CITY')).map((c) => c.trim()),
      );
      const folded = new Set([...aliases].map((c) => foldCity(c)));
      filtered = games.filter((g) => {
        const vc = g.venue.city?.trim() ?? '';
        return aliases.has(vc) || folded.has(foldCity(vc));
      });
    }

    if (typeof opts.hasSpots === 'boolean') {
      filtered = filtered.filter((g) => {
        const occupied = g.participants.length + g._count.reservations;
        return opts.hasSpots ? occupied < g.spotsTotal : occupied >= g.spotsTotal;
      });
    }

    if (typeof opts.minSpots === 'number') {
      filtered = filtered.filter((g) => g.spotsTotal >= opts.minSpots!);
    }
    if (typeof opts.maxSpots === 'number') {
      filtered = filtered.filter((g) => g.spotsTotal <= opts.maxSpots!);
    }

    return filtered.map((g) => {
      const { _count, ...rest } = g;
      return {
        ...rest,
        participantsCount: g.participants.length,
        reservedCount: _count.reservations,
        // Planned split (total / spotsTotal) — see note in `getById`.
        perPlayerCost: this.plannedPerPlayerCost(g.totalCost, g.spotsTotal),
      };
    });
  }

  async join(me: User, gameId: string) {
    let tracked: 'join' | 'join_request' | null = null;

    const joined = await this.prisma.$transaction(async (tx) => {
      const game = await tx.game.findUnique({
        where: { id: gameId },
        include: { participants: true },
      });
      if (!game) throw new NotFoundException('Game not found');
      if (game.status !== 'OPEN') throw new BadRequestException(`Game is ${game.status}`);
      if (game.endAt.getTime() <= Date.now()) {
        throw new BadRequestException('Game has already ended');
      }

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
        tracked = 'join_request';
        return this.findOne(gameId);
      }

      if (game.participants.length + (await tx.gameReservation.count({ where: { gameId } })) >= game.spotsTotal) {
        throw new ConflictException('Game is full');
      }

      await tx.gameParticipant.create({ data: { gameId, userId: me.id } });
      await tx.gameActivity.create({
        data: { gameId, userId: me.id, kind: 'JOINED' },
      });
      tracked = 'join';

      const updated = await tx.game.findUnique({
        where: { id: gameId },
        include: { participants: true, _count: { select: { reservations: true } } },
      });
      if (updated && updated.participants.length + updated._count.reservations >= updated.spotsTotal) {
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

    if (tracked === 'join') {
      void this.analytics.trackEvent(me.id, 'game_join', {
        screen: `/games/${gameId}`,
        target: gameId,
      });
      void this.analytics.bumpGameStat(me.id, 'gamesAttended');
      await this.prisma.gameWaitlist
        .deleteMany({ where: { gameId, userId: me.id } })
        .catch(() => undefined);
    } else if (tracked === 'join_request') {
      void this.analytics.trackEvent(me.id, 'game_join_request', {
        screen: `/games/${gameId}`,
        target: gameId,
      });
    }

    if (joined.status === 'FULL') {
      await this.invitations.refreshPendingInvitees(gameId).catch(() => undefined);
      await this.scheduler.resetWaitlistNotifyFlags(gameId).catch(() => undefined);
    }
    return joined;
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

      if (isParticipant) {
        await tx.gameActivity.create({
          data: { gameId, userId: me.id, kind: 'LEFT' },
        });
      }

      await tx.gameParticipant.deleteMany({ where: { gameId, userId: me.id } });
      // Drop the payment record so it doesn't pollute the host's tracker.
      await tx.gamePayment.deleteMany({ where: { gameId, userId: me.id } });
      // Drop any pending invitation
      await tx.gameInvitation.deleteMany({ where: { gameId, inviteeId: me.id } });

      const updated = await tx.game.findUnique({
        where: { id: gameId },
        include: { participants: true, _count: { select: { reservations: true } } },
      });
      if (
        updated &&
        updated.status === 'FULL' &&
        updated.participants.length + updated._count.reservations < updated.spotsTotal
      ) {
        await tx.game.update({ where: { id: gameId }, data: { status: 'OPEN' } });
      }
      if (isHost) {
        // Host leaving cancels the game for everyone.
        await tx.game.update({ where: { id: gameId }, data: { status: 'CANCELLED' } });
      }
      return { wasHost: isHost };
    });

    if (result.wasHost) {
      await this.invitations.deactivatePendingForGame(gameId).catch(() => undefined);
      await this.scheduler.notifyCancelled(gameId).catch(() => undefined);
      void this.analytics.trackEvent(me.id, 'game_cancel', {
        screen: `/games/${gameId}`,
        target: gameId,
        meta: { via: 'host_leave' },
      });
      void this.analytics.bumpGameStat(me.id, 'gamesCancelled');
    } else {
      void this.analytics.trackEvent(me.id, 'game_leave', {
        screen: `/games/${gameId}`,
        target: gameId,
      });
      await this.scheduler.notifyWaitlistSpotOpen(gameId).catch(() => undefined);
    }
    return this.findOne(gameId);
  }

  async cancel(me: User, gameId: string) {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) throw new NotFoundException('Game not found');
    if (game.hostId !== me.id) throw new ForbiddenException('Only host can cancel');
    await this.prisma.game.update({ where: { id: gameId }, data: { status: 'CANCELLED' } });
    await this.invitations.deactivatePendingForGame(gameId).catch(() => undefined);
    await this.scheduler.notifyCancelled(gameId).catch(() => undefined);
    void this.analytics.trackEvent(me.id, 'game_cancel', {
      screen: `/games/${gameId}`,
      target: gameId,
    });
    void this.analytics.bumpGameStat(me.id, 'gamesCancelled');
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
    coverImageUrl2?: string | null;
    addressHint?: string | null;
    playType?: 'INDOOR' | 'OUTDOOR' | 'BEACH';
    venueId?: string;
    venueName?: string;
    venueAddress?: string;
  }) {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) throw new NotFoundException('Game not found');
    if (game.hostId !== me.id && me.role !== 'ADMIN') {
      throw new ForbiddenException('Only the host or an admin can edit');
    }
    if (game.status === 'CANCELLED' || game.status === 'FINISHED') {
      throw new BadRequestException(`Cannot edit a ${game.status.toLowerCase()} game`);
    }

    const data: any = {};
    if (patch.startAt) data.startAt = new Date(patch.startAt);
    if (patch.endAt) data.endAt = new Date(patch.endAt);
    if (patch.notes !== undefined) data.notes = patch.notes;
    if (patch.skillLevel) data.skillLevel = patch.skillLevel;
    if (typeof patch.spotsTotal === 'number') {
      const seated = await this.prisma.gameParticipant.count({ where: { gameId } });
      const reserved = await this.prisma.gameReservation.count({ where: { gameId } });
      if (patch.spotsTotal < 2) {
        throw new BadRequestException('spotsTotal must be at least 2');
      }
      if (patch.spotsTotal < seated + reserved) {
        throw new BadRequestException(
          `spotsTotal cannot be below current players (${seated + reserved})`,
        );
      }
      data.spotsTotal = patch.spotsTotal;
    }
    if (typeof patch.totalCost === 'number') data.totalCost = patch.totalCost;
    if (patch.currency && SUPPORTED_CURRENCIES.has(patch.currency)) data.currency = patch.currency;
    if (typeof patch.isPaid === 'boolean') data.isPaid = patch.isPaid;
    if (typeof patch.isClosed === 'boolean') data.isClosed = patch.isClosed;
    if (patch.coverImageUrl !== undefined) data.coverImageUrl = patch.coverImageUrl;
    if (patch.coverImageUrl2 !== undefined) data.coverImageUrl2 = patch.coverImageUrl2;
    if (patch.addressHint !== undefined) data.addressHint = patch.addressHint;
    if (patch.playType) data.playType = patch.playType;

    if (patch.venueId || (patch.venueAddress && patch.venueAddress.trim())) {
      const venue = await this.resolveVenue(me, {
        venueId: patch.venueId,
        venueName: patch.venueName,
        venueAddress: patch.venueAddress?.trim() || '',
        spotsTotal: typeof patch.spotsTotal === 'number' ? patch.spotsTotal : game.spotsTotal,
      } as any);
      data.venueId = venue.id;
    }

    // Host typically only sends a new start — keep the same duration.
    if (data.startAt && !data.endAt) {
      const durationMs = game.endAt.getTime() - game.startAt.getTime();
      data.endAt = new Date(data.startAt.getTime() + Math.max(durationMs, 60 * 60 * 1000));
    }

    const newStart: Date = data.startAt ?? game.startAt;
    const newEnd: Date = data.endAt ?? game.endAt;
    if (!(newStart < newEnd)) {
      throw new BadRequestException('startAt must be before endAt');
    }
    if (data.startAt && data.startAt.getTime() < Date.now() - 60_000) {
      throw new BadRequestException('startAt must be in the future');
    }

    const timeChanged =
      !!data.startAt && data.startAt.getTime() !== game.startAt.getTime();
    const oldStartAt = game.startAt;

    await this.prisma.game.update({ where: { id: gameId }, data });

    // If capacity grew past current roster while FULL, reopen.
    if (typeof data.spotsTotal === 'number' || data.venueId) {
      const { occupied } = await this.occupiedCounts(this.prisma, gameId);
      const spots =
        typeof data.spotsTotal === 'number' ? data.spotsTotal : game.spotsTotal;
      if (game.status === 'FULL' && occupied < spots) {
        await this.prisma.game.update({
          where: { id: gameId },
          data: { status: 'OPEN' },
        });
        await this.scheduler.notifyWaitlistSpotOpen(gameId).catch(() => undefined);
      } else if (game.status === 'OPEN' && occupied >= spots) {
        await this.prisma.game.update({
          where: { id: gameId },
          data: { status: 'FULL' },
        });
        await this.scheduler.resetWaitlistNotifyFlags(gameId).catch(() => undefined);
      }
    }

    if (timeChanged) {
      // Old reminder offsets no longer apply — let the cron fire again for the new kickoff.
      await this.prisma.gameReminderSent
        .deleteMany({ where: { gameId } })
        .catch(() => undefined);
      await this.scheduler
        .notifyTimeChanged(gameId, {
          oldStartAt,
          newStartAt: data.startAt,
          actorId: me.id,
        })
        .catch(() => undefined);
      void this.analytics.trackEvent(me.id, 'game_reschedule', {
        screen: `/games/${gameId}`,
        target: gameId,
        meta: {
          oldStartAt: oldStartAt.toISOString(),
          newStartAt: (data.startAt as Date).toISOString(),
        },
      });
    } else if (Object.keys(data).length > 0) {
      void this.analytics.trackEvent(me.id, 'game_edit', {
        screen: `/games/${gameId}`,
        target: gameId,
        meta: { fields: Object.keys(data) },
      });
    }

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
    await this.invitations.deactivatePendingForGame(gameId).catch(() => undefined);
    await this.prisma.gameWaitlist.deleteMany({ where: { gameId } }).catch(() => undefined);
    // Telegram every participant so the rating form appears when they open the app.
    await this.scheduler.notifyRatePlayers(gameId).catch(() => undefined);
    void this.analytics.trackEvent(me.id, 'game_finish', {
      screen: `/games/${gameId}`,
      target: gameId,
    });
    return this.findOne(gameId);
  }

  /** Pending join requests for a closed lobby — host/admin only. */
  async listJoinRequests(me: User, gameId: string) {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) throw new NotFoundException('Game not found');
    if (game.hostId !== me.id && me.role !== 'ADMIN') {
      throw new ForbiddenException('Only the host can view join requests');
    }
    return this.prisma.gameJoinRequest.findMany({
      where: { gameId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            photoUrl: true,
            role: true,
            skillLevel: true,
            evaluatedSkillLevel: true,
          },
        },
      },
    });
  }

  /**
   * Host approves or rejects a pending join request. Approve seats the player
   * (and creates a payment row for paid games) the same way open-lobby join does.
   */
  async decideJoinRequest(me: User, gameId: string, requestId: string, accept: boolean) {
    return this.prisma.$transaction(async (tx) => {
      const game = await tx.game.findUnique({
        where: { id: gameId },
        include: { participants: true },
      });
      if (!game) throw new NotFoundException('Game not found');
      if (game.hostId !== me.id && me.role !== 'ADMIN') {
        throw new ForbiddenException('Only the host can decide join requests');
      }

      const req = await tx.gameJoinRequest.findUnique({ where: { id: requestId } });
      if (!req || req.gameId !== gameId) throw new NotFoundException('Join request not found');
      if (req.status !== 'PENDING') {
        return { ok: true, status: req.status };
      }

      if (!accept) {
        await tx.gameJoinRequest.update({
          where: { id: requestId },
          data: {
            status: 'REJECTED',
            decidedBy: me.id,
            decidedAt: new Date(),
          },
        });
        return { ok: true, status: 'REJECTED' };
      }

      if (game.status !== 'OPEN' && game.status !== 'FULL') {
        throw new BadRequestException(`Game is ${game.status}`);
      }
      if (game.endAt.getTime() <= Date.now()) {
        throw new BadRequestException('Game has already ended');
      }
      if (
        game.participants.length + (await tx.gameReservation.count({ where: { gameId } })) >=
        game.spotsTotal
      ) {
        throw new ConflictException('Game is full');
      }

      const already = game.participants.some((p) => p.userId === req.userId);
      if (!already) {
        await tx.gameParticipant.create({
          data: { gameId, userId: req.userId },
        });
        await tx.gameActivity.create({
          data: { gameId, userId: req.userId, kind: 'JOINED' },
        });
      }

      const updated = await tx.game.findUnique({
        where: { id: gameId },
        include: { participants: true, _count: { select: { reservations: true } } },
      });
      if (updated && updated.participants.length + updated._count.reservations >= updated.spotsTotal) {
        await tx.game.update({ where: { id: gameId }, data: { status: 'FULL' } });
      }

      if (game.isPaid) {
        const amount = this.perPlayerCost(game.totalCost, updated!.participants.length);
        await tx.gamePayment.upsert({
          where: { gameId_userId: { gameId, userId: req.userId } },
          create: {
            gameId,
            userId: req.userId,
            amount,
            currency: game.currency,
          },
          update: { amount },
        });
      }

      await tx.gameJoinRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          decidedBy: me.id,
          decidedAt: new Date(),
        },
      });

      return { ok: true, status: 'APPROVED' };
    }).then(async (result) => {
      if (result.status === 'APPROVED') {
        const req = await this.prisma.gameJoinRequest.findUnique({
          where: { id: requestId },
          select: { userId: true },
        });
        if (req) {
          void this.analytics.trackEvent(req.userId, 'game_join', {
            screen: `/games/${gameId}`,
            target: gameId,
            meta: { via: 'join_request' },
          });
          void this.analytics.bumpGameStat(req.userId, 'gamesAttended');
          await this.prisma.gameWaitlist
            .deleteMany({ where: { gameId, userId: req.userId } })
            .catch(() => undefined);
        }
      }
      // Refresh so the host client sees the new roster.
      const game = await this.findOne(gameId);
      if (game.status === 'FULL') {
        await this.invitations.refreshPendingInvitees(gameId).catch(() => undefined);
        await this.scheduler.resetWaitlistNotifyFlags(gameId).catch(() => undefined);
      }
      return result;
    });
  }

  /** Subscribe for a Telegram ping when a FULL game has a free spot. */
  async joinWaitlist(me: User, gameId: string) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: { participants: { select: { userId: true } } },
    });
    if (!game) throw new NotFoundException('Game not found');
    if (game.status === 'CANCELLED' || game.status === 'FINISHED') {
      throw new BadRequestException('Game is no longer joinable');
    }
    if (game.participants.some((p) => p.userId === me.id)) {
      throw new BadRequestException('You are already in this game');
    }
    const reserved = await this.prisma.gameReservation.count({ where: { gameId } });
    if (game.participants.length + reserved < game.spotsTotal && game.status === 'OPEN') {
      throw new BadRequestException('Game already has free spots — join directly');
    }

    await this.prisma.gameWaitlist.upsert({
      where: { gameId_userId: { gameId, userId: me.id } },
      create: { gameId, userId: me.id },
      update: {},
    });
    void this.analytics.trackEvent(me.id, 'waitlist_join', {
      screen: `/games/${gameId}`,
      target: gameId,
    });
    return { onWaitlist: true };
  }

  async leaveWaitlist(me: User, gameId: string) {
    await this.prisma.gameWaitlist.deleteMany({
      where: { gameId, userId: me.id },
    });
    void this.analytics.trackEvent(me.id, 'waitlist_leave', {
      screen: `/games/${gameId}`,
      target: gameId,
    });
    return { onWaitlist: false };
  }

  async getWaitlistMe(me: User, gameId: string) {
    const row = await this.prisma.gameWaitlist.findUnique({
      where: { gameId_userId: { gameId, userId: me.id } },
      select: { id: true },
    });
    return { onWaitlist: !!row };
  }

  /** Admin-only join/leave timeline for a game. */
  async listActivity(me: User, gameId: string) {
    if (me.role !== 'ADMIN') {
      throw new ForbiddenException('Admin only');
    }
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true },
    });
    if (!game) throw new NotFoundException('Game not found');

    const rows = await this.prisma.gameActivity.findMany({
      where: { gameId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            photoUrl: true,
          },
        },
      },
      take: 200,
    });

    return {
      items: rows.map((r) => ({
        id: r.id,
        kind: r.kind as 'JOINED' | 'LEFT',
        createdAt: r.createdAt.toISOString(),
        user: r.user,
      })),
    };
  }

  /**
   * Host/admin sets the single field photo: upload bytes, reuse the host's
   * saved library cover, or copy from another game they hosted.
   * Also refreshes `User.savedCoverImageUrl` so the next create can reuse it.
   */
  async setCovers(
    me: User,
    gameId: string,
    opts: {
      images?: Array<{ base64: string; mime?: string }>;
      reuseSaved?: boolean;
      reuseFromGameId?: string;
    },
  ) {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) throw new NotFoundException('Game not found');
    if (game.hostId !== me.id && me.role !== 'ADMIN') {
      throw new ForbiddenException('Only the host or an admin can set covers');
    }
    if (game.status === 'CANCELLED' || game.status === 'FINISHED') {
      throw new BadRequestException(`Cannot edit a ${game.status.toLowerCase()} game`);
    }

    const images = opts.images ?? [];
    const reuseSaved = !!opts.reuseSaved;
    const reuseFromGameId = opts.reuseFromGameId?.trim() || '';
    const modes = [images.length > 0, reuseSaved, !!reuseFromGameId].filter(Boolean).length;
    if (modes !== 1) {
      throw new BadRequestException(
        'Provide exactly one of: images, reuseSaved, or reuseFromGameId',
      );
    }
    if (images.length > 1) {
      throw new BadRequestException('Only one cover photo is allowed per game');
    }

    let url1: string;
    let source: 'upload' | 'saved' | 'game' = 'upload';

    if (images.length) {
      url1 = await this.covers.saveSlot(gameId, 1, images[0].base64, images[0].mime);
      source = 'upload';
    } else if (reuseSaved) {
      url1 = await this.covers.copyUserCoverToGame(me.id, gameId);
      source = 'saved';
    } else {
      const sourceGame = await this.prisma.game.findUnique({
        where: { id: reuseFromGameId },
      });
      if (!sourceGame) throw new NotFoundException('Source game not found');
      if (sourceGame.hostId !== me.id && me.role !== 'ADMIN') {
        throw new ForbiddenException('You can only reuse covers from games you hosted');
      }
      if (!sourceGame.coverImageUrl) {
        throw new BadRequestException('Source game has no cover photo');
      }
      url1 = await this.covers.copyGameSlotToGame(reuseFromGameId, 1, gameId);
      source = 'game';
    }

    // One cover per game going forward — drop a legacy second slot if present.
    await this.covers.deleteSlotFiles(gameId, 2);

    await this.prisma.game.update({
      where: { id: gameId },
      data: {
        coverImageUrl: url1,
        coverImageUrl2: null,
      },
    });

    // Keep the host's reusable library cover in sync (upload or promote).
    let savedUrl: string | null = null;
    if (source === 'upload' && images[0]) {
      savedUrl = await this.covers.saveUserCover(me.id, images[0].base64, images[0].mime);
    } else {
      savedUrl = await this.covers.copyGameSlotToUser(gameId, 1, me.id);
    }
    if (savedUrl) {
      await this.prisma.user.update({
        where: { id: me.id },
        data: { savedCoverImageUrl: savedUrl },
      });
    }

    void this.analytics.trackEvent(me.id, 'game_covers_set', {
      screen: `/games/${gameId}`,
      target: gameId,
      meta: { count: 1, source },
    });

    return this.findOne(gameId);
  }

  async clearCovers(me: User, gameId: string) {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) throw new NotFoundException('Game not found');
    if (game.hostId !== me.id && me.role !== 'ADMIN') {
      throw new ForbiddenException('Only the host or an admin can clear covers');
    }
    await this.covers.deleteSlotFiles(gameId, 1);
    await this.covers.deleteSlotFiles(gameId, 2);
    await this.prisma.game.update({
      where: { id: gameId },
      data: { coverImageUrl: null, coverImageUrl2: null },
    });
    return this.findOne(gameId);
  }

  /** Admin holds one anonymous seat. Other players only see “Incognito”. */
  async addReservation(me: User, gameId: string, note?: string | null) {
    if (me.role !== 'ADMIN') throw new ForbiddenException('Admin only');
    const trimmed = note?.trim() ? note.trim().slice(0, 80) : null;

    const becameFull = await this.prisma.$transaction(async (tx) => {
      const game = await tx.game.findUnique({ where: { id: gameId } });
      if (!game) throw new NotFoundException('Game not found');
      if (game.status === 'CANCELLED' || game.status === 'FINISHED') {
        throw new BadRequestException(`Cannot reserve on a ${game.status.toLowerCase()} game`);
      }
      const { occupied } = await this.occupiedCounts(tx, gameId);
      if (occupied >= game.spotsTotal) {
        throw new ConflictException('Game is full');
      }
      await tx.gameReservation.create({
        data: { gameId, createdById: me.id, note: trimmed },
      });
      await tx.auditLog.create({
        data: {
          actorId: me.id,
          action: 'game.reserve',
          targetType: 'game',
          targetId: gameId,
          meta: { note: trimmed },
        },
      });
      const full = occupied + 1 >= game.spotsTotal;
      if (full && game.status === 'OPEN') {
        await tx.game.update({ where: { id: gameId }, data: { status: 'FULL' } });
      }
      return full;
    });

    if (becameFull) {
      await this.invitations.refreshPendingInvitees(gameId).catch(() => undefined);
      await this.scheduler.resetWaitlistNotifyFlags(gameId).catch(() => undefined);
    }
    return this.findOne(gameId);
  }

  async removeReservation(me: User, gameId: string, reservationId: string) {
    if (me.role !== 'ADMIN') throw new ForbiddenException('Admin only');

    const reopened = await this.prisma.$transaction(async (tx) => {
      const game = await tx.game.findUnique({ where: { id: gameId } });
      if (!game) throw new NotFoundException('Game not found');
      const row = await tx.gameReservation.findUnique({ where: { id: reservationId } });
      if (!row || row.gameId !== gameId) throw new NotFoundException('Reservation not found');
      await tx.gameReservation.delete({ where: { id: reservationId } });
      await tx.auditLog.create({
        data: {
          actorId: me.id,
          action: 'game.unreserve',
          targetType: 'game',
          targetId: gameId,
          meta: { reservationId },
        },
      });
      const { occupied } = await this.occupiedCounts(tx, gameId);
      const openAgain =
        (game.status === 'FULL' || game.status === 'OPEN') && occupied < game.spotsTotal;
      if (game.status === 'FULL' && occupied < game.spotsTotal) {
        await tx.game.update({ where: { id: gameId }, data: { status: 'OPEN' } });
      }
      return openAgain && game.status === 'FULL';
    });

    if (reopened) {
      await this.scheduler.notifyWaitlistSpotOpen(gameId).catch(() => undefined);
    }
    return this.findOne(gameId);
  }

  /** Notes stay admin-only. The public game payload has ids without notes. */
  async listReservations(me: User, gameId: string) {
    if (me.role !== 'ADMIN') throw new ForbiddenException('Admin only');
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true },
    });
    if (!game) throw new NotFoundException('Game not found');
    const rows = await this.prisma.gameReservation.findMany({
      where: { gameId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, note: true, createdAt: true },
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        note: r.note,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }
}
