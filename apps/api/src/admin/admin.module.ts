import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from '../auth/admin.guard';

@Module({
  // Importing AuthModule makes AuthService, JwtAuthGuard, and JwtModule
  // available in this module's scope, which the @UseGuards(JwtAuthGuard,
  // AdminGuard) chain on AdminController needs at boot time.
  imports: [AuthModule, AnalyticsModule],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard],
  exports: [AdminService],
})
export class AdminModule {}