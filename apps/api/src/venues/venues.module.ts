import { Module } from '@nestjs/common';
import { VenuesController } from './venues.controller';
import { AuthModule } from '../auth/auth.module';
import { BotModule } from '../bot/bot.module';

@Module({
  imports: [AuthModule, BotModule],
  controllers: [VenuesController],
})
export class VenuesModule {}
