import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import {
  AdminUpdateGameDto,
  AdminUpdateUserDto,
  AdminUpdateVenueDto,
} from './dto';

/** Prisma returns `telegramId` as BigInt — JSON.stringify throws without this. */
function publicUser<T extends { telegramId: bigint }>(u: T) {
  return { ...u, telegramId: u.telegramId.toString() };
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
  ) {}

  // ---------- Stats ----------
  async getStats() {
    const [users, games, venues, todaySignups, bannedUsers, pendingReports, finishedGames] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.game.count(),
        this.prisma.venue.count(),
        this.prisma.user.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
            },
          },
        }),
        this.prisma.user.count({ where: { isBanned: true } }),
        this.prisma.report.count({ where: { status: 'OPEN' } }),
        this.prisma.game.count({ where: { status: 'FINISHED' } }),
      ]);
    return {
      users,
      games,
      venues,
      signupsLast24h: todaySignups,
      bannedUsers,
      pendingReports,
      finishedGames,
    };
  }

  // ---------- Users ----------
  async listUsers(params: {
    take: number;
    skip: number;
    q?: string;
    isBanned?: 'true' | 'false';
    role?: 'USER' | 'ADMIN';
    city?: string;
  }) {
    const where: any = {};
    if (params.q) {
      where.OR = [
        { firstName: { contains: params.q } },
        { lastName: { contains: params.q } },
        { username: { contains: params.q } },
      ];
    }
    if (params.isBanned === 'true') where.isBanned = true;
    if (params.isBanned === 'false') where.isBanned = false;
    if (params.role) where.role = params.role;
    if (params.city) where.city = params.city;

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params.take,
        skip: params.skip,
        select: {
          id: true,
          telegramId: true,
          firstName: true,
          lastName: true,
          username: true,
          city: true,
          skillLevel: true,
          evaluatedSkillLevel: true,
          role: true,
          isBanned: true,
          bannedReason: true,
          bannedAt: true,
          language: true,
          photoUrl: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items: items.map(publicUser),
      total,
      take: params.take,
      skip: params.skip,
    };
  }

  /**
   * Admin-only roster of every user with app-usage trackers
   * (entries day/week/month + avg time in app).
   */
  async listUserActivity(params: { take: number; skip: number; q?: string }) {
    const where: any = {};
    if (params.q) {
      where.OR = [
        { firstName: { contains: params.q } },
        { lastName: { contains: params.q } },
        { username: { contains: params.q } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params.take,
        skip: params.skip,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          photoUrl: true,
          city: true,
          role: true,
          isBanned: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const activityMap = await this.analytics.activitySummaryForUsers(
      items.map((u) => u.id),
    );

    const withStats = items.map((u) => {
      const a = activityMap.get(u.id);
      return {
        ...u,
        activity: {
          entriesDay: a?.entriesDay ?? 0,
          entriesWeek: a?.entriesWeek ?? 0,
          entriesMonth: a?.entriesMonth ?? 0,
          avgSessionMs: a?.avgSessionMs ?? 0,
          avgSessionsPerWeek: a?.avgSessionsPerWeek ?? 0,
          lastActiveAt: a?.lastActiveAt?.toISOString() ?? null,
        },
      };
    });

    // Most recently active users first.
    withStats.sort((a, b) => {
      const ta = a.activity.lastActiveAt
        ? new Date(a.activity.lastActiveAt).getTime()
        : 0;
      const tb = b.activity.lastActiveAt
        ? new Date(b.activity.lastActiveAt).getTime()
        : 0;
      if (tb !== ta) return tb - ta;
      return b.activity.entriesWeek - a.activity.entriesWeek;
    });

    return {
      items: withStats,
      total,
      take: params.take,
      skip: params.skip,
    };
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        participations: {
          include: { game: { select: { id: true, startAt: true, status: true, skillLevel: true } } },
        },
        hostedGames: {
          select: { id: true, startAt: true, status: true },
        },
      },
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);

    // v3 — aggregate counts for the admin user-detail panel
    const [gamesAttended, gamesCancelled, evaluationsGiven, evaluationsReceived, reportsAgainst, paymentsMade] =
      await Promise.all([
        this.prisma.gameParticipant.count({
          where: {
            userId: id,
            game: { status: { in: ['FULL', 'OPEN', 'FINISHED'] } },
          },
        }),
        this.prisma.gameParticipant.count({
          where: {
            userId: id,
            game: { status: 'CANCELLED' },
          },
        }),
        this.prisma.gameEvaluation.count({ where: { evaluatorId: id } }),
        this.prisma.gameEvaluation.count({ where: { evaluateeId: id } }),
        this.prisma.report.count({ where: { targetId: id } }),
        this.prisma.gamePayment.count({ where: { userId: id, isPaid: true } }),
      ]);

    const activity = await this.analytics.activitySummary(id);

    const { telegramId, ...rest } = user;
    return {
      ...rest,
      telegramId: telegramId.toString(),
      stats: {
        gamesAttended,
        gamesCancelled,
        gamesHosted: user.hostedGames.length,
        evaluationsGiven,
        evaluationsReceived,
        reportsAgainst,
        paymentsMade,
        avgSessionsPerWeek: activity.avgSessionsPerWeek,
        lastActiveAt: activity.lastActiveAt,
        entriesDay: activity.entriesDay,
        entriesWeek: activity.entriesWeek,
        entriesMonth: activity.entriesMonth,
        avgSessionMs: activity.avgSessionMs,
      },
    };
  }

  async updateUser(actorId: string, id: string, dto: AdminUpdateUserDto) {
    const before = await this.getUser(id);

    // ----- v3 ban handling -----
    let banFields: any = {};
    if (typeof dto.isBanned === 'boolean') {
      banFields.isBanned = dto.isBanned;
      if (dto.isBanned) {
        banFields.bannedAt = new Date();
        if (dto.bannedReason) banFields.bannedReason = dto.bannedReason;
      } else {
        banFields.bannedAt = null;
        banFields.bannedReason = null;
      }
    } else if (dto.bannedReason !== undefined) {
      banFields.bannedReason = dto.bannedReason;
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        firstName: dto.firstName ?? undefined,
        lastName: dto.lastName === undefined ? undefined : dto.lastName,
        username: dto.username === undefined ? undefined : dto.username,
        city: dto.city ?? undefined,
        age: dto.age ?? undefined,
        skillLevel: dto.skillLevel === undefined ? undefined : dto.skillLevel,
        role: dto.role ?? undefined,
        ...banFields,
      },
    });
    const after = publicUser(updated);
    await this.log(actorId, dto.isBanned ? (dto.isBanned ? 'user.ban' : 'user.unban') : 'user.update', 'user', id, {
      before,
      after,
      reason: dto.bannedReason,
    });
    return after;
  }

  async deleteUser(actorId: string, id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    await this.prisma.$transaction([
      // Detach venues they submitted so FK doesn't block the delete.
      this.prisma.venue.updateMany({ where: { submittedById: id }, data: { submittedById: null } }),
      this.prisma.gameParticipant.deleteMany({ where: { userId: id } }),
      this.prisma.gameInvitation.deleteMany({
        where: { OR: [{ inviteeId: id }, { inviterId: id }] },
      }),
      this.prisma.gameJoinRequest.deleteMany({
        where: { OR: [{ userId: id }, { decidedBy: id }] },
      }),
      this.prisma.gamePayment.deleteMany({ where: { userId: id } }),
      this.prisma.gameEvaluation.deleteMany({
        where: { OR: [{ evaluatorId: id }, { evaluateeId: id }] },
      }),
      this.prisma.blacklist.deleteMany({
        where: { OR: [{ ownerId: id }, { blockedId: id }] },
      }),
      this.prisma.report.deleteMany({
        where: { OR: [{ reporterId: id }, { targetId: id }] },
      }),
      this.prisma.report.updateMany({
        where: { reviewedBy: id },
        data: { reviewedBy: null },
      }),
      this.prisma.analyticsEvent.deleteMany({ where: { userId: id } }),
      this.prisma.appSession.deleteMany({ where: { userId: id } }),
      this.prisma.userActivityStats.deleteMany({ where: { userId: id } }),
      this.prisma.auditLog.deleteMany({ where: { actorId: id } }),
      this.prisma.game.deleteMany({ where: { hostId: id } }),
      this.prisma.user.delete({ where: { id } }),
    ]);
    await this.log(actorId, 'user.delete', 'user', id, { telegramId: user.telegramId.toString() });
    return { ok: true };
  }

  // ---------- Games ----------
  async listGames(params: { take: number; skip: number; q?: string }) {
    const where: any = params.q
      ? {
          OR: [
            { notes: { contains: params.q } },
            { venue: { name: { contains: params.q } } },
            { host: { firstName: { contains: params.q } } },
          ],
        }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.game.findMany({
        where,
        orderBy: { startAt: 'desc' },
        take: params.take,
        skip: params.skip,
        include: {
          venue: true,
          host: { select: { id: true, firstName: true, username: true } },
          _count: { select: { participants: true } },
        },
      }),
      this.prisma.game.count({ where }),
    ]);
    return { items, total, take: params.take, skip: params.skip };
  }

  async updateGame(actorId: string, id: string, dto: AdminUpdateGameDto) {
    const before = await this.prisma.game.findUnique({ where: { id } });
    if (!before) throw new NotFoundException(`Game ${id} not found`);

    const data: any = {};
    if (dto.status) data.status = dto.status;
    if (typeof dto.spotsTotal === 'number') data.spotsTotal = dto.spotsTotal;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (typeof dto.totalCost === 'number') data.totalCost = dto.totalCost;
    if (dto.currency) data.currency = dto.currency;
    if (typeof dto.isPaid === 'boolean') data.isPaid = dto.isPaid;
    if (typeof dto.isClosed === 'boolean') data.isClosed = dto.isClosed;
    if (dto.coverImageUrl !== undefined) data.coverImageUrl = dto.coverImageUrl;
    if (dto.addressHint !== undefined) data.addressHint = dto.addressHint;
    if (dto.startAt) data.startAt = new Date(dto.startAt);
    if (dto.endAt) data.endAt = new Date(dto.endAt);
    if (dto.skillLevel) data.skillLevel = dto.skillLevel;
    if (dto.playType) data.playType = dto.playType;

    const updated = await this.prisma.game.update({ where: { id }, data });

    if (
      (dto.status === 'CANCELLED' || dto.status === 'FINISHED') &&
      before.status !== dto.status
    ) {
      await this.prisma.gameInvitation.updateMany({
        where: { gameId: id, status: 'PENDING' },
        data: { status: 'IGNORED', respondedAt: new Date() },
      });
      this.logger.log(`Game ${id} set to ${dto.status} by admin ${actorId}`);
    }

    await this.log(actorId, 'game.update', 'game', id, {
      fields: Object.keys(dto),
      before,
      after: updated,
    });
    return updated;
  }

  async cancelGame(actorId: string, id: string) {
    const before = await this.prisma.game.findUnique({ where: { id } });
    if (!before) throw new NotFoundException(`Game ${id} not found`);
    const updated = await this.prisma.game.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
    await this.prisma.gameInvitation.updateMany({
      where: { gameId: id, status: 'PENDING' },
      data: { status: 'IGNORED', respondedAt: new Date() },
    });
    await this.log(actorId, 'game.cancel', 'game', id, { before, after: updated });
    return updated;
  }

  async deleteGame(actorId: string, id: string) {
    const game = await this.prisma.game.findUnique({ where: { id } });
    if (!game) throw new NotFoundException(`Game ${id} not found`);
    await this.prisma.game.delete({ where: { id } });
    await this.log(actorId, 'game.delete', 'game', id, null);
    return { ok: true };
  }

  // ---------- Venues ----------
  async listVenues(params: { take: number; skip: number; q?: string }) {
    const where: any = params.q
      ? {
          OR: [
            { name: { contains: params.q } },
            { address: { contains: params.q } },
            { city: { contains: params.q } },
          ],
        }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.venue.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params.take,
        skip: params.skip,
        include: { _count: { select: { games: true } } },
      }),
      this.prisma.venue.count({ where }),
    ]);
    return { items, total, take: params.take, skip: params.skip };
  }

  async updateVenue(actorId: string, id: string, dto: AdminUpdateVenueDto) {
    const before = await this.prisma.venue.findUnique({ where: { id } });
    if (!before) throw new NotFoundException(`Venue ${id} not found`);
    const updated = await this.prisma.venue.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        address: dto.address ?? undefined,
        hourlyPrice: dto.hourlyPrice ?? undefined,
        capacity: dto.capacity ?? undefined,
        status: dto.status ?? undefined,
      },
    });
    await this.log(actorId, 'venue.update', 'venue', id, {
      fields: Object.keys(dto),
      before,
      after: updated,
    });
    return updated;
  }

  async deleteVenue(actorId: string, id: string) {
    const venue = await this.prisma.venue.findUnique({ where: { id } });
    if (!venue) throw new NotFoundException(`Venue ${id} not found`);
    const gameCount = await this.prisma.game.count({ where: { venueId: id } });

    // Games hold a required FK to venue (no onDelete cascade). Admin delete
    // removes those games first — child rows (participants, payments, …)
    // already cascade from Game.
    try {
      await this.prisma.$transaction(async (tx) => {
        if (gameCount > 0) {
          await tx.game.deleteMany({ where: { venueId: id } });
        }
        await tx.venue.delete({ where: { id } });
      });
    } catch (err) {
      this.logger.error(`Failed to delete venue ${id}`, err as Error);
      throw new BadRequestException(
        `Could not delete venue${gameCount > 0 ? ` (${gameCount} linked game(s))` : ''}. Try hiding it instead.`,
      );
    }

    await this.log(actorId, 'venue.delete', 'venue', id, { gameCount });
    return { ok: true, deletedGames: gameCount };
  }

  // ---------- Audit log ----------
  async listAudit(params: { take: number; skip: number }) {
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: params.take,
        skip: params.skip,
        include: {
          actor: { select: { id: true, firstName: true, username: true } },
        },
      }),
      this.prisma.auditLog.count(),
    ]);
    return { items, total, take: params.take, skip: params.skip };
  }

  // ---------- Reports ----------
  async listReports(params: { take: number; skip: number; status?: 'OPEN' | 'REVIEWED' | 'DISMISSED' }) {
    const where: any = {};
    if (params.status) where.status = params.status;
    const [items, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params.take,
        skip: params.skip,
        include: {
          reporter: { select: { id: true, firstName: true, username: true } },
          target: { select: { id: true, firstName: true, username: true, isBanned: true } },
          game: { select: { id: true, startAt: true } },
        },
      }),
      this.prisma.report.count({ where }),
    ]);
    return { items, total, take: params.take, skip: params.skip };
  }

  async resolveReport(actorId: string, id: string, status: 'REVIEWED' | 'DISMISSED') {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException(`Report ${id} not found`);
    const updated = await this.prisma.report.update({
      where: { id },
      data: {
        status,
        reviewedBy: actorId,
        reviewedAt: new Date(),
      },
    });
    await this.log(actorId, `report.${status.toLowerCase()}`, 'report', id, {
      targetUserId: report.targetId,
      reporterId: report.reporterId,
    });
    return updated;
  }

  // ---------- Heatmap ----------
  async heatmap(params: { from?: string; to?: string; screen?: string }) {
    const where: any = { type: 'click' };
    if (params.from || params.to) {
      where.createdAt = {};
      if (params.from) where.createdAt.gte = new Date(params.from);
      if (params.to) where.createdAt.lte = new Date(params.to);
    }
    if (params.screen) where.screen = params.screen;

    const items = await this.prisma.analyticsEvent.findMany({
      where,
      select: { target: true, screen: true, meta: true },
    });

    // Aggregate by screen:target with count and average coords from meta
    const buckets: Record<string, { screen: string; target: string; count: number; xSum: number; ySum: number; n: number }> = {};
    for (const e of items) {
      const key = `${e.screen ?? '_'}|${e.target ?? '_'}`;
      const meta = (e.meta as any) ?? null;
      const x = typeof meta?.x === 'number' ? meta.x : null;
      const y = typeof meta?.y === 'number' ? meta.y : null;
      const b = (buckets[key] ||= {
        screen: e.screen ?? '_',
        target: e.target ?? '_',
        count: 0,
        xSum: 0,
        ySum: 0,
        n: 0,
      });
      b.count++;
      if (x !== null && y !== null) {
        b.xSum += x;
        b.ySum += y;
        b.n++;
      }
    }
    return Object.values(buckets)
      .sort((a, b) => b.count - a.count)
      .slice(0, 200);
  }

  private async log(
    actorId: string,
    action: string,
    targetType: string,
    targetId: string,
    meta: unknown,
  ) {
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action,
        targetType,
        targetId,
        meta: meta === null || meta === undefined ? undefined : (meta as any),
      },
    });
  }
}