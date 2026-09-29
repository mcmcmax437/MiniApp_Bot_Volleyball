import { Module, forwardRef } from '@nestjs/common';
import { GamesController, GameCoverController } from './games.controller';
import { GamesService } from './games.service';
import { GameCoverService } from './game-cover.service';
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
  controllers: [GamesController, GameCoverController],
  providers: [GamesService, GameCoverService],
  exports: [GamesService, GameCoverService],
})
export class GamesModule {}
