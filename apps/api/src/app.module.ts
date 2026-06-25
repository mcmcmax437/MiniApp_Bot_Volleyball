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
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    MeModule,
    VenuesModule,
    GamesModule,
    BotModule,
    SchedulerModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
