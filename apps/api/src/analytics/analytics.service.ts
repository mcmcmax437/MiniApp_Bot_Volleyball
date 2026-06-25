import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { User } from '@prisma/client';

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

  /** Bump the user's last-active timestamp and update rolling average. */
  async heartbeat(me: User) {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      // 4-week rolling: count distinct days with events in the past 28 days.
      const days = await tx.analyticsEvent.findMany({
        where: {
          userId: me.id,
          createdAt: { gte: new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000) },
        },
        select: { createdAt: true },
      });
      const distinctDays = new Set(
        days.map((d) => d.createdAt.toISOString().slice(0, 10)),
      ).size;
      const avg = distinctDays / 4; // sessions per week
      await tx.userActivityStats.upsert({
        where: { userId: me.id },
        create: {
          userId: me.id,
          lastActiveAt: now,
          avgSessionsPerWeek: avg,
        },
        update: {
          lastActiveAt: now,
          avgSessionsPerWeek: avg,
        },
      });
    });
    return { ok: true };
  }
}