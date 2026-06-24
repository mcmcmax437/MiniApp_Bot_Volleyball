import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramSender } from '../bot/telegram-sender';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  // in-memory dedupe so we don't double-notify if the cron runs twice near the boundary
  private readonly sentKeys = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly sender: TelegramSender,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    if (!this.sender.isReady()) return; // bot not configured -> nothing to do

    const now = Date.now();
    // Look 6 hours ahead to cover all reasonable user reminder offsets.
    const horizon = new Date(now + 6 * 60 * 60 * 1000);

    const games = await this.prisma.game.findMany({
      where: {
        status: { in: ['OPEN', 'FULL'] },
        startAt: { gte: new Date(now - 60_000), lte: horizon },
      },
      include: {
        venue: true,
        participants: { include: { user: true } },
      },
      take: 200,
    });

    for (const g of games) {
      const start = g.startAt.getTime();
      const minutesUntil = (start - now) / 60_000;

      for (const p of g.participants) {
        const offsets = this.normalizeOffsets(p.user.reminderOffsets);
        if (!offsets.length) continue;

        for (const offset of offsets) {
          // Fire when we cross the offset boundary (within the last 60s of that point).
          if (minutesUntil > offset) continue;
          if (minutesUntil < offset - 1) continue;

          const key = `${g.id}:${p.userId}:${offset}`;
          if (this.sentKeys.has(key)) continue;
          this.sentKeys.add(key);

          const minutesText = offset >= 60 ? `${Math.round(offset / 60)}h` : `${offset}m`;
          const text = [
            `⏰ Volleyball reminder (${minutesText} before):`,
            ``,
            `📍 ${g.venue.name}`,
            `📅 ${g.startAt.toISOString().replace('T', ' ').slice(0, 16)}`,
            `Players: ${g.participants.length}/${g.spotsTotal}`,
          ].join('\n');

          await this.sender.sendToTelegramId(p.user.telegramId, text);
        }
      }
    }

    if (this.sentKeys.size > 5000) {
      const drop = Math.floor(this.sentKeys.size / 2);
      const it = this.sentKeys.values();
      for (let i = 0; i < drop; i++) {
        const v = it.next().value;
        if (v) this.sentKeys.delete(v);
      }
    }
  }

  /** Notify every participant that a game was cancelled. */
  async notifyCancelled(gameId: string) {
    if (!this.sender.isReady()) return;
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: { venue: true, participants: { include: { user: true } } },
    });
    if (!game) return;
    const text =
      `❌ Game cancelled\n\n📍 ${game.venue.name}\n📅 ${game.startAt
        .toISOString()
        .replace('T', ' ')
        .slice(0, 16)}`;
    for (const p of game.participants) {
      await this.sender.sendToTelegramId(p.user.telegramId, text);
    }
  }

  /** Coerce whatever shape the JSON column has into a sorted unique number array. */
  private normalizeOffsets(raw: unknown): number[] {
    if (!Array.isArray(raw)) return [];
    const set = new Set<number>();
    for (const v of raw) {
      const n = typeof v === 'number' ? v : Number(v);
      if (Number.isFinite(n) && n > 0 && n <= 7 * 24 * 60) set.add(Math.round(n));
    }
    return [...set].sort((a, b) => b - a);
  }
}
