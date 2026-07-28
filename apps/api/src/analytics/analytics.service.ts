import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { User } from '@prisma/client';

/** Cap one heartbeat tick so a backgrounded tab can't inflate time. */
const MAX_HEARTBEAT_DELTA_MS = 20_000;

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ingest a batch of analytics events from the client. Events are stored
   * raw and aggregated later by the admin heatmap endpoint.
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

  /** Open a new Mini App session (one "entry"). */
  async startSession(me: User) {
    const now = new Date();
    const session = await this.prisma.appSession.create({
      data: {
        userId: me.id,
        startedAt: now,
        lastSeenAt: now,
        durationMs: 0,
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
    const now = Date.now();
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const rolling28 = new Date(now - 28 * 24 * 60 * 60 * 1000);

    const [entriesDay, entriesWeek, entriesMonth, recentSessions, activity] =
      await Promise.all([
        this.prisma.appSession.count({
          where: { userId, startedAt: { gte: dayAgo } },
        }),
        this.prisma.appSession.count({
          where: { userId, startedAt: { gte: weekAgo } },
        }),
        this.prisma.appSession.count({
          where: { userId, startedAt: { gte: monthAgo } },
        }),
        this.prisma.appSession.findMany({
          where: { userId, startedAt: { gte: rolling28 } },
          select: { durationMs: true, startedAt: true, lastSeenAt: true, endedAt: true },
        }),
        this.prisma.userActivityStats.findUnique({ where: { userId } }),
      ]);

    let totalMs = 0;
    let counted = 0;
    for (const s of recentSessions) {
      const ms =
        s.durationMs > 0
          ? s.durationMs
          : Math.max(0, s.lastSeenAt.getTime() - s.startedAt.getTime());
      // Ignore empty blinks (< 2s) so avg isn't dragged down by failed opens.
      if (ms < 2_000) continue;
      totalMs += ms;
      counted += 1;
    }
    const avgSessionMs = counted > 0 ? Math.round(totalMs / counted) : 0;

    return {
      entriesDay,
      entriesWeek,
      entriesMonth,
      avgSessionMs,
      avgSessionsPerWeek: activity?.avgSessionsPerWeek ?? entriesWeek / 7,
      lastActiveAt: activity?.lastActiveAt ?? null,
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
