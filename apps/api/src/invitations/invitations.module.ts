import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BotModule } from '../bot/bot.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';
import { InvitationsRealtimeService } from './invitations-realtime.service';

@Module({
  imports: [AuthModule, BotModule, AnalyticsModule],
  controllers: [InvitationsController],
  providers: [InvitationsService, InvitationsRealtimeService],
  exports: [InvitationsService],
})
export class InvitationsModule {}
