import { Module, forwardRef } from '@nestjs/common';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { AuthModule } from '../auth/auth.module';
import { InvitationsModule } from '../invitations/invitations.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [
    AuthModule,
    SchedulerModule,
    AnalyticsModule,
    forwardRef(() => InvitationsModule),
  ],
  controllers: [GamesController],
  providers: [GamesService],
  exports: [GamesService],
})
export class GamesModule {}
