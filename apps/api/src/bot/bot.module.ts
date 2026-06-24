import { Module } from '@nestjs/common';
import { TelegramSender } from './telegram-sender';

@Module({
  providers: [TelegramSender],
  exports: [TelegramSender],
})
export class BotModule {}
