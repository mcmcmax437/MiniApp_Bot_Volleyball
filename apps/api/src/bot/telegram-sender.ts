import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, Context } from 'grammy';

@Injectable()
export class TelegramSender implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramSender.name);
  private bot: Bot<Context> | null = null;
  private readonly token: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.token = this.config.get<string>('BOT_TOKEN');
  }

  onModuleInit() {
    if (!this.token) {
      this.logger.warn('BOT_TOKEN not configured — bot will not start. API still works.');
      return;
    }
    this.bot = new Bot<Context>(this.token);

    this.bot.command('start', async (ctx) => {
      const webappUrl = this.config.get<string>('WEBAPP_URL');
      const firstName = ctx.from?.first_name ?? 'friend';
      const text = webappUrl
        ? `Hi ${firstName}! Tap the button to open the Volleyball scheduler.`
        : `Hi ${firstName}! The Volleyball Mini App isn't configured yet — set WEBAPP_URL.`;
      if (webappUrl) {
        await ctx.reply(text, {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Open Volleyball App', url: webappUrl }],
            ],
          },
        });
      } else {
        await ctx.reply(text);
      }
    });

    this.bot
      .start()
      .catch((err) => this.logger.error(`bot.start failed: ${err?.message ?? err}`));
  }

  async onModuleDestroy() {
    if (this.bot) await this.bot.stop();
  }

  /**
   * Best-effort: send a message to a Telegram user by their telegramId.
   * Returns true on success, false on any failure (e.g. user blocked bot).
   */
  async sendToTelegramId(telegramId: string | bigint, text: string): Promise<boolean> {
    if (!this.bot) return false;
    try {
      await this.bot.api.sendMessage(telegramId.toString(), text, { parse_mode: 'HTML' });
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
