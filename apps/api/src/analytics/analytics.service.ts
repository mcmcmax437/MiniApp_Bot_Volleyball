import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { User } from '@prisma/client';

/** Cap one heartbeat tick so a backgrounded tab can't inflate time. */
const MAX_HEARTBEAT_DELTA_MS = 20_000;

const PRODUCT_EVENT_TYPES = [
  'game_create',
  'game_join',
  'game_join_request',
  'game_leave',
  'game_cancel',
  'game_finish',
  'invite_send',
  'invite_accept',
  'invite_decline',
  'evaluation_submit',
  'payment_mark',
  'game_share',
] as const;

export type ProductEventType = (typeof PRODUCT_EVENT_TYPES)[number];

export type GameStatField = 'gamesHosted' | 'gamesAttended' | 'gamesCancelled';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ingest a batch of analytics events from the client. Events are stored
   * raw and aggregated later by the admin heatmap / engagement endpoints.
   */
  async ingest(
    me: User | null,
    events: Array<{ type: string; screen?: string; target?: string; meta?: any }>,
  ) {
    if (!events.length) return { count: 0 };
    const rows = events
      .filter((e) => e.type && typeof e.type === 'string' && e.type.length <= 64)
      .slice(0, 200) // safety: cap per batch
      .map((e) => ({
        userId: me?.id ?? null,
        type: e.type,
        screen: e.screen ?? null,
        target: e.target ?? null,
        meta: e.meta ?? undefined,
      }));
    if (!rows.length) return { count: 0 };
    const res = await this.prisma.analyticsEvent.createMany({ data: rows });
    return { count: res.count };
  }

  /**
   * Best-effort product / feature event (server-side). Never throws to callers.
   */
  async trackEvent(
    userId: string | null,
    type: string,
    opts?: { screen?: string; target?: string; meta?: Record<string, unknown> },
  ) {
    try {
      await this.prisma.analyticsEvent.create({
        data: {
          userId,
          type: type.slice(0, 64),
          screen: opts?.screen?.slice(0, 64) ?? null,
          target: opts?.target?.slice(0, 64) ?? null,
          meta:
            opts?.meta === undefined
              ? undefined
              : (opts.meta as Prisma.InputJsonValue),
        },
      });
    } catch (err) {
      this.logger.warn(`trackEvent(${type}) failed: ${(err as Error).message}`);
    }
  }

  /** Increment cached game counters on UserActivityStats. */
  async bumpGameStat(userId: string, field: GameStatField, by = 1) {
    try {
      await this.prisma.userActivityStats.upsert({
        where: { userId },
        create: { userId, [field]: Math.max(0, by) },
        update: { [field]: { increment: by } },
      });
    } catch (err) {
      this.logger.warn(`bumpGameStat(${field}) failed: ${(err as Error).message}`);
    }
  }

  /** Open a new Mini App session (one "entry"), with optional device context. */
  async startSession(
    me: User,
    ctx?: { platform?: string; language?: string; city?: string },
  ) {
    const now = new Date();
    const session = await this.prisma.appSession.create({
      data: {
        userId: me.id,
        startedAt: now,
        lastSeenAt: now,
        durationMs: 0,
        platform: ctx?.platform?.slice(0, 64) || null,
        language: ctx?.language?.slice(0, 16) || me.language || null,
        city: ctx?.city?.slice(0, 64) || me.city || null,
      },
      select: { id: true },
    });
    await this.bumpLastActive(me.id, now);
    return { sessionId: session.id };
  }

  /**
   * Presence ping for an open session. Accumulates elapsed time since the
   * previous heartbeat (capped) so admins can see average time in app.
   */
  async heartbeat(me: User, sessionId?: string | null) {
    const now = new Date();

    if (sessionId) {
      const session = await this.prisma.appSession.findFirst({
        where: { id: sessionId, userId: me.id, endedAt: null },
      });
      if (session) {
        const rawDelta = now.getTime() - session.lastSeenAt.getTime();
        const delta =
          rawDelta > 0 ? Math.min(rawDelta, MAX_HEARTBEAT_DELTA_MS) : 0;
        await this.prisma.appSession.update({
          where: { id: session.id },
          data: {
            lastSeenAt: now,
            durationMs: session.durationMs + delta,
          },
        });
      }
    }

    await this.refreshRollingStats(me.id, now);
    return { ok: true };
  }

  /** Close a session when the Mini App hides / unloads. */
  async endSession(me: User, sessionId: string) {
    const session = await this.prisma.appSession.findFirst({
      where: { id: sessionId, userId: me.id },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.endedAt) return { ok: true };

    const now = new Date();
    const rawDelta = now.getTime() - session.lastSeenAt.getTime();
    const delta = rawDelta > 0 ? Math.min(rawDelta, MAX_HEARTBEAT_DELTA_MS) : 0;

    await this.prisma.appSession.update({
      where: { id: session.id },
      data: {
        endedAt: now,
        lastSeenAt: now,
        durationMs: session.durationMs + delta,
      },
    });
    await this.bumpLastActive(me.id, now);
    return { ok: true };
  }

  /**
   * Admin activity trackers for one user: entries (day / week / month) and
   * average time spent per session over the last 28 days.
   */
  async activitySummary(userId: string) {
    const map = await this.activitySummaryForUsers([userId]);
    return (
      map.get(userId) ?? {
        entriesDay: 0,
        entriesWeek: 0,
        entriesMonth: 0,
        avgSessionMs: 0,
        avgSessionsPerWeek: 0,
        lastActiveAt: null as Date | null,
      }
    );
  }

  /** Batch version for the admin activity list page. */
  async activitySummaryForUsers(userIds: string[]) {
    const result = new Map<
      string,
      {
        entriesDay: number;
        entriesWeek: number;
        entriesMonth: number;
        avgSessionMs: number;
        avgSessionsPerWeek: number;
        lastActiveAt: Date | null;
      }
    >();
    for (const id of userIds) {
      result.set(id, {
        entriesDay: 0,
        entriesWeek: 0,
        entriesMonth: 0,
        avgSessionMs: 0,
        avgSessionsPerWeek: 0,
        lastActiveAt: null,
      });
    }
    if (!userIds.length) return result;

    const now = Date.now();
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const rolling28 = new Date(now - 28 * 24 * 60 * 60 * 1000);

    const [sessions, activities] = await Promise.all([
      this.prisma.appSession.findMany({
        where: { userId: { in: userIds }, startedAt: { gte: monthAgo } },
        select: {
          userId: true,
          startedAt: true,
          durationMs: true,
          lastSeenAt: true,
        },
      }),
      this.prisma.userActivityStats.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, lastActiveAt: true, avgSessionsPerWeek: true },
      }),
    ]);

    for (const a of activities) {
      const row = result.get(a.userId);
      if (!row) continue;
      row.lastActiveAt = a.lastActiveAt;
      row.avgSessionsPerWeek = a.avgSessionsPerWeek;
    }

    const avgAcc = new Map<string, { totalMs: number; counted: number }>();

    for (const s of sessions) {
      const row = result.get(s.userId);
      if (!row) continue;
      if (s.startedAt >= dayAgo) row.entriesDay += 1;
      if (s.startedAt >= weekAgo) row.entriesWeek += 1;
      row.entriesMonth += 1;

      if (s.startedAt >= rolling28) {
        const ms =
          s.durationMs > 0
            ? s.durationMs
            : Math.max(0, s.lastSeenAt.getTime() - s.startedAt.getTime());
        if (ms < 2_000) continue;
        const acc = avgAcc.get(s.userId) ?? { totalMs: 0, counted: 0 };
        acc.totalMs += ms;
        acc.counted += 1;
        avgAcc.set(s.userId, acc);
      }
    }

    for (const [userId, acc] of avgAcc) {
      const row = result.get(userId);
      if (!row) continue;
      row.avgSessionMs = Math.round(acc.totalMs / acc.counted);
      if (!row.avgSessionsPerWeek) row.avgSessionsPerWeek = row.entriesWeek;
    }

    return result;
  }

  /**
   * Platform-wide engagement aggregates for the admin Stats page.
   * Distinct active users (DAU/WAU/MAU), avg session length, top screens /
   * product actions, and session context breakdowns.
   */
  async engagementOverview() {
    const now = Date.now();
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const rolling28 = new Date(now - 28 * 24 * 60 * 60 * 1000);

    const [
      dauRows,
      wauRows,
      mauRows,
      sessionsToday,
      recentSessions,
      screenEvents,
      actionEvents,
      clickEvents,
      platformSessions,
      languageSessions,
    ] = await Promise.all([
      this.prisma.appSession.groupBy({
        by: ['userId'],
        where: { startedAt: { gte: dayAgo } },
      }),
      this.prisma.appSession.groupBy({
        by: ['userId'],
        where: { startedAt: { gte: weekAgo } },
      }),
      this.prisma.appSession.groupBy({
        by: ['userId'],
        where: { startedAt: { gte: monthAgo } },
      }),
      this.prisma.appSession.count({ where: { startedAt: { gte: dayAgo } } }),
      this.prisma.appSession.findMany({
        where: { startedAt: { gte: rolling28 }, durationMs: { gte: 2000 } },
        select: { durationMs: true },
      }),
      this.prisma.analyticsEvent.groupBy({
        by: ['screen'],
        where: {
          type: 'screen_view',
          createdAt: { gte: weekAgo },
          screen: { not: null },
        },
        _count: { _all: true },
        orderBy: { _count: { screen: 'desc' } },
        take: 10,
      }),
      this.prisma.analyticsEvent.groupBy({
        by: ['type'],
        where: {
          type: { in: [...PRODUCT_EVENT_TYPES] },
          createdAt: { gte: weekAgo },
        },
        _count: { _all: true },
        orderBy: { _count: { type: 'desc' } },
        take: 15,
      }),
      this.prisma.analyticsEvent.groupBy({
        by: ['target'],
        where: {
          type: 'click',
          createdAt: { gte: weekAgo },
          target: { not: null },
        },
        _count: { _all: true },
        orderBy: { _count: { target: 'desc' } },
        take: 10,
      }),
      this.prisma.appSession.groupBy({
        by: ['platform'],
        where: { startedAt: { gte: weekAgo } },
        _count: { _all: true },
        orderBy: { _count: { platform: 'desc' } },
        take: 10,
      }),
      this.prisma.appSession.groupBy({
        by: ['language'],
        where: { startedAt: { gte: weekAgo } },
        _count: { _all: true },
        orderBy: { _count: { language: 'desc' } },
        take: 10,
      }),
    ]);

    const avgSessionMs = recentSessions.length
      ? Math.round(
          recentSessions.reduce((s, r) => s + r.durationMs, 0) /
            recentSessions.length,
        )
      : 0;

    return {
      dau: dauRows.length,
      wau: wauRows.length,
      mau: mauRows.length,
      sessionsToday,
      avgSessionMs,
      topScreens: screenEvents.map((r) => ({
        screen: r.screen ?? '/',
        count: r._count._all,
      })),
      topActions: actionEvents.map((r) => ({
        type: r.type,
        count: r._count._all,
      })),
      topClicks: clickEvents.map((r) => ({
        target: r.target ?? '_',
        count: r._count._all,
      })),
      platforms: platformSessions.map((r) => ({
        platform: r.platform ?? 'unknown',
        count: r._count._all,
      })),
      languages: languageSessions.map((r) => ({
        language: r.language ?? 'unknown',
        count: r._count._all,
      })),
    };
  }

  private async bumpLastActive(userId: string, now: Date) {
    await this.prisma.userActivityStats.upsert({
      where: { userId },
      create: { userId, lastActiveAt: now },
      update: { lastActiveAt: now },
    });
  }

  /** Rolling weekly entry rate from AppSession starts (last 7 days). */
  private async refreshRollingStats(userId: string, now: Date) {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const entriesWeek = await this.prisma.appSession.count({
      where: { userId, startedAt: { gte: weekAgo } },
    });
    const avg = entriesWeek; // entries in the last 7 days ≈ sessions/week
    await this.prisma.userActivityStats.upsert({
      where: { userId },
      create: {
        userId,
        lastActiveAt: now,
        avgSessionsPerWeek: avg,
      },
      update: {
        lastActiveAt: now,
        avgSessionsPerWeek: avg,
      },
    });
  }
}
