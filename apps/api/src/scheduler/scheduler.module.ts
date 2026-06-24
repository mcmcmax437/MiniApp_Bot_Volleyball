import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { BotModule } from '../bot/bot.module';

@Module({
  imports: [BotModule],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
