import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramSender } from '../bot/telegram-sender';
import { cancelledMessage, reminderMessage } from '../bot/notify-messages';

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
    // Auto-finish games one hour after start so they drop out of
    // upcoming lists and can no longer be joined.
    await this.autoFinishEndedGames();

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
      const openBtn = this.sender.openAppButton('Open game', `g_${g.id}`);

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

          const text = reminderMessage({
            venueName: g.venue.name,
            venueAddress: g.venue.address,
            startAt: g.startAt,
            minutesUntil: offset,
            players: g.participants.length,
            spotsTotal: g.spotsTotal,
            locale: p.user.language ?? 'en',
          });

          await this.sender.sendToTelegramId(p.user.telegramId, text, {
            replyMarkup: openBtn,
          });
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

  /**
   * Auto-finish OPEN/FULL games one hour after kickoff (startAt + 1h),
   * not at the configured endAt. Example: starts 18:00 → finished at 19:00.
   * Hosts can still finish earlier via the manual Finish action.
   */
  private async autoFinishEndedGames() {
    try {
      const oneHourAfterKickoff = new Date(Date.now() - 60 * 60 * 1000);
      const due = await this.prisma.game.findMany({
        where: {
          status: { in: ['OPEN', 'FULL'] },
          startAt: { lte: oneHourAfterKickoff },
        },
        select: { id: true },
        take: 200,
      });
      if (!due.length) return;

      const ids = due.map((g) => g.id);
      const result = await this.prisma.game.updateMany({
        where: { id: { in: ids } },
        data: { status: 'FINISHED' },
      });
      // Pending invites become inactive once the game is finished.
      await this.prisma.gameInvitation.updateMany({
        where: { gameId: { in: ids }, status: 'PENDING' },
        data: { status: 'IGNORED', respondedAt: new Date() },
      });
      if (result.count > 0) {
        this.logger.log(`Auto-finished ${result.count} ended game(s)`);
      }
    } catch (e) {
      this.logger.warn(`autoFinishEndedGames failed: ${(e as Error).message}`);
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
    const openBtn = this.sender.openAppButton('Open app');
    for (const p of game.participants) {
      const text = cancelledMessage({
        venueName: game.venue.name,
        venueAddress: game.venue.address,
        startAt: game.startAt,
        locale: p.user.language ?? 'en',
      });
      await this.sender.sendToTelegramId(p.user.telegramId, text, {
        replyMarkup: openBtn,
      });
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
