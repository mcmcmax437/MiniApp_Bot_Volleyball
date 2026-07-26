import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, Context, InlineKeyboard } from 'grammy';
import { welcomeMessage } from './notify-messages';

export type SendOptions = {
  /** Optional inline keyboard (e.g. Open App). */
  replyMarkup?: InlineKeyboard;
};

@Injectable()
export class TelegramSender implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramSender.name);
  private bot: Bot<Context> | null = null;
  private readonly token: string | undefined;
  /** @username without @ — from getMe() or BOT_USERNAME env. */
  private botUsername: string | null = null;

  constructor(private readonly config: ConfigService) {
    this.token = this.config.get<string>('BOT_TOKEN');
    const envUser = this.config.get<string>('BOT_USERNAME')?.trim().replace(/^@/, '');
    if (envUser) this.botUsername = envUser;
  }

  onModuleInit() {
    if (!this.token) {
      this.logger.warn('BOT_TOKEN not configured — bot will not start. API still works.');
      return;
    }
    this.bot = new Bot<Context>(this.token);

    this.bot.command('start', async (ctx) => {
      const webappUrl = this.config.get<string>('WEBAPP_URL')?.trim();
      const firstName = ctx.from?.first_name ?? 'friend';
      const text = welcomeMessage({ firstName, hasWebApp: !!webappUrl });
      if (webappUrl) {
        await ctx.reply(text, {
          parse_mode: 'HTML',
          reply_markup: this.openAppButton('Open VolleyBot'),
        });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML' });
      }
    });

    this.bot.api
      .getMe()
      .then((me) => {
        if (me.username) {
          this.botUsername = me.username;
          this.logger.log(`Bot username @${me.username}`);
        }
      })
      .catch((err) => this.logger.warn(`getMe failed: ${(err as Error).message}`));

    this.bot
      .start()
      .catch((err) => this.logger.error(`bot.start failed: ${err?.message ?? err}`));
  }

  /** Public bot username (no @) for t.me deep links / share sheets. */
  getUsername(): string | null {
    return this.botUsername;
  }

  async onModuleDestroy() {
    if (this.bot) await this.bot.stop();
  }

  /**
   * Shared “Open App” button used on invite / reminder / cancel messages.
   * Prefers a t.me deep link (opens the Mini App) when we know the bot
   * username; falls back to WEBAPP_URL.
   */
  openAppButton(label = 'Open app', startParam?: string): InlineKeyboard | undefined {
    const username = this.getUsername();
    if (username) {
      const q = startParam
        ? `?startapp=${encodeURIComponent(startParam)}`
        : '';
      return new InlineKeyboard().url(label, `https://t.me/${username}${q}`);
    }
    const webappUrl = this.config.get<string>('WEBAPP_URL')?.trim();
    if (!webappUrl) return undefined;
    return new InlineKeyboard().url(label, webappUrl);
  }

  /**
   * Best-effort: send a message to a Telegram user by their telegramId.
   * Returns true on success, false on any failure (e.g. user blocked bot).
   */
  async sendToTelegramId(
    telegramId: string | bigint,
    text: string,
    opts: SendOptions = {},
  ): Promise<boolean> {
    if (!this.bot) return false;
    try {
      await this.bot.api.sendMessage(telegramId.toString(), text, {
        parse_mode: 'HTML',
        reply_markup: opts.replyMarkup,
      });
      return true;
    } catch (err) {
      this.logger.warn(`sendToTelegramId(${telegramId}) failed: ${(err as Error).message}`);
      return false;
    }
  }

  isReady(): boolean {
    return this.bot !== null;
  }
}
