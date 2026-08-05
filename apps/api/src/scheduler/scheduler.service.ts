import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramSender } from '../bot/telegram-sender';
import {
  cancelledMessage,
  ratePlayersMessage,
  reminderMessage,
  spotOpenedMessage,
  timeChangedMessage,
} from '../bot/notify-messages';

/** Look far enough ahead to cover Profile's "24h + 2h + 30m" preset (1440m). */
const REMINDER_HORIZON_MS = 26 * 60 * 60 * 1000;

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sender: TelegramSender,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    // Auto-finish OPEN/FULL games five hours after kickoff. The games list
    // uses the same 5h horizon so lobbies stay visible until then.
    await this.autoFinishEndedGames();

    if (!this.sender.isReady()) return; // bot not configured -> nothing to do

    await this.sendDueReminders();
  }

  /**
   * Fire each participant's reminderOffsets once the fire time has passed
   * and the game has not started yet. Dedupe is durable (GameReminderSent)
   * so a missed cron minute or a deploy restart still delivers the ping
   * on the next tick — including the 24h reminder (previously broken
   * because the look-ahead window was only 6 hours).
   */
  private async sendDueReminders() {
    const now = Date.now();
    const horizon = new Date(now + REMINDER_HORIZON_MS);

    const games = await this.prisma.game.findMany({
      where: {
        status: { in: ['OPEN', 'FULL'] },
        startAt: { gt: new Date(now), lte: horizon },
      },
      include: {
        venue: true,
        participants: { include: { user: true } },
        remindersSent: {
          select: { userId: true, offsetMinutes: true },
        },
      },
      take: 300,
    });

    for (const g of games) {
      const start = g.startAt.getTime();
      const openBtn = this.sender.openAppButton('Open game', `g_${g.id}`);
      const already = new Set(
        g.remindersSent.map((r) => `${r.userId}:${r.offsetMinutes}`),
      );

      for (const p of g.participants) {
        if (p.user.isBanned) continue;
        const offsets = this.normalizeOffsets(p.user.reminderOffsets);
        if (!offsets.length) continue;

        for (const offset of offsets) {
          const fireAt = start - offset * 60_000;
          // Not due yet.
          if (now < fireAt) continue;
          // Game already started — skip (startAt filter usually excludes these).
          if (now >= start) continue;

          const key = `${p.userId}:${offset}`;
          if (already.has(key)) continue;

          // Claim the send slot first so parallel ticks don't double-send.
          try {
            await this.prisma.gameReminderSent.create({
              data: {
                gameId: g.id,
                userId: p.userId,
                offsetMinutes: offset,
              },
            });
          } catch {
            // Unique constraint → already claimed.
            continue;
          }
          already.add(key);

          const text = reminderMessage({
            venueName: g.venue.name,
            venueAddress: g.venue.address,
            startAt: g.startAt,
            minutesUntil: offset,
            players: g.participants.length,
            spotsTotal: g.spotsTotal,
            locale: p.user.language ?? 'en',
          });

          const ok = await this.sender.sendToTelegramId(p.user.telegramId, text, {
            replyMarkup: openBtn,
          });
          if (!ok) {
            this.logger.warn(
              `Reminder ${offset}m failed for user ${p.userId} game ${g.id}`,
            );
          }
        }
      }
    }
  }

  /**
   * Auto-finish OPEN/FULL games five hours after kickoff (startAt + 5h),
   * not at the configured endAt. Example: starts 18:00 → finished at 23:00.
   * Hosts can still finish earlier via the manual Finish action.
   */
  private async autoFinishEndedGames() {
    try {
      const fiveHoursAfterKickoff = new Date(Date.now() - 5 * 60 * 60 * 1000);
      const due = await this.prisma.game.findMany({
        where: {
          status: { in: ['OPEN', 'FULL'] },
          startAt: { lte: fiveHoursAfterKickoff },
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
      await this.prisma.gameWaitlist.deleteMany({ where: { gameId: { in: ids } } });
      if (result.count > 0) {
        this.logger.log(`Auto-finished ${result.count} ended game(s)`);
        // Nudge every participant to open the app and rate co-players.
        for (const id of ids) {
          await this.notifyRatePlayers(id).catch(() => undefined);
        }
      }
    } catch (e) {
      this.logger.warn(`autoFinishEndedGames failed: ${(e as Error).message}`);
    }
  }

  /**
   * After a game becomes FINISHED (host Finish or auto-finish), Telegram
   * every participant so the rating form can show when they open the app.
   */
  async notifyRatePlayers(gameId: string) {
    if (!this.sender.isReady()) return;
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        venue: true,
        participants: { include: { user: true } },
      },
    });
    if (!game || game.status !== 'FINISHED') return;
    if (game.participants.length < 2) return;

    for (const p of game.participants) {
      if (p.user.isBanned) continue;
      const text = ratePlayersMessage({
        venueName: game.venue.name,
        venueAddress: game.venue.address,
        startAt: game.startAt,
        locale: p.user.language ?? 'en',
      });
      const label =
        (p.user.language ?? 'en').startsWith('uk')
          ? 'Оцінити гравців'
          : (p.user.language ?? 'en').startsWith('ru')
            ? 'Оценить игроков'
            : (p.user.language ?? 'en').startsWith('pl')
              ? 'Oceń graczy'
              : 'Rate players';
      await this.sender.sendToTelegramId(p.user.telegramId, text, {
        replyMarkup: this.sender.openAppButton(label, `g_${game.id}`),
      });
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
    await this.prisma.gameWaitlist.deleteMany({ where: { gameId } });
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

  /**
   * Telegram only users who opted in via "Notify me" on this game
   * (`GameWaitlist` rows). Never broadcasts to all users.
   * Skips entries already notified for the current opening
   * (`lastNotifiedAt` set; cleared when the lobby fills again).
   */
  async notifyWaitlistSpotOpen(gameId: string) {
    if (!this.sender.isReady()) return;

    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        venue: true,
        participants: { select: { userId: true } },
        waitlist: {
          where: { lastNotifiedAt: null },
          include: { user: true },
        },
      },
    });
    if (!game) return;
    if (game.status === 'CANCELLED' || game.status === 'FINISHED') return;
    if (game.participants.length >= game.spotsTotal) return;

    const seated = new Set(game.participants.map((p) => p.userId));
    const openBtn = this.sender.openAppButton('Open game', `g_${game.id}`);
    const spotsLeft = game.spotsTotal - game.participants.length;

    for (const w of game.waitlist) {
      if (seated.has(w.userId) || w.user.isBanned) {
        await this.prisma.gameWaitlist.delete({ where: { id: w.id } }).catch(() => undefined);
        continue;
      }

      const text = spotOpenedMessage({
        venueName: game.venue.name,
        venueAddress: game.venue.address,
        startAt: game.startAt,
        spotsLeft,
        spotsTotal: game.spotsTotal,
        locale: w.user.language ?? 'en',
      });
      const ok = await this.sender.sendToTelegramId(w.user.telegramId, text, {
        replyMarkup: openBtn,
      });
      if (ok) {
        await this.prisma.gameWaitlist.update({
          where: { id: w.id },
          data: { lastNotifiedAt: new Date() },
        });
      }
    }
  }

  /**
   * Notify seated players that the host moved kickoff. Skips the actor
   * (they already know). Clears nothing — caller clears reminder sends.
   */
  async notifyTimeChanged(
    gameId: string,
    opts: { oldStartAt: Date; newStartAt: Date; actorId: string },
  ) {
    if (!this.sender.isReady()) return;
    if (opts.oldStartAt.getTime() === opts.newStartAt.getTime()) return;

    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        venue: true,
        participants: { include: { user: true } },
      },
    });
    if (!game) return;
    if (game.status === 'CANCELLED' || game.status === 'FINISHED') return;

    const openBtn = this.sender.openAppButton('Open game', `g_${game.id}`);
    for (const p of game.participants) {
      if (p.userId === opts.actorId) continue;
      if (p.user.isBanned) continue;
      const text = timeChangedMessage({
        venueName: game.venue.name,
        venueAddress: game.venue.address,
        oldStartAt: opts.oldStartAt,
        newStartAt: opts.newStartAt,
        locale: p.user.language ?? 'en',
      });
      await this.sender.sendToTelegramId(p.user.telegramId, text, {
        replyMarkup: openBtn,
      });
    }
  }

  /** Allow another notify cycle after the lobby fills again. */
  async resetWaitlistNotifyFlags(gameId: string) {
    await this.prisma.gameWaitlist.updateMany({
      where: { gameId, lastNotifiedAt: { not: null } },
      data: { lastNotifiedAt: null },
    });
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
