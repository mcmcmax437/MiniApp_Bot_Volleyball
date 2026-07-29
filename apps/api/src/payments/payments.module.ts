import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GamesModule } from '../games/games.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [AuthModule, GamesModule, AnalyticsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
