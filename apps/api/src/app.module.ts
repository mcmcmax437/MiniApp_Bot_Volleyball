import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { MeModule } from './me/me.module';
import { VenuesModule } from './venues/venues.module';
import { GamesModule } from './games/games.module';
import { BotModule } from './bot/bot.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { AdminModule } from './admin/admin.module';
import { AvatarModule } from './avatar/avatar.module';
import { BlacklistModule } from './blacklist/blacklist.module';
import { ReportsModule } from './reports/reports.module';
import { InvitationsModule } from './invitations/invitations.module';
import { PaymentsModule } from './payments/payments.module';
import { EvaluationsModule } from './evaluations/evaluations.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    AvatarModule,
    MeModule,
    VenuesModule,
    GamesModule,
    BotModule,
    SchedulerModule,
    AdminModule,
    BlacklistModule,
    ReportsModule,
    InvitationsModule,
    PaymentsModule,
    EvaluationsModule,
    AnalyticsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}