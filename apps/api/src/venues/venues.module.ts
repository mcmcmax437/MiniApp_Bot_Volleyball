import { Module } from '@nestjs/common';
import { VenuesController } from './venues.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [VenuesController],
})
export class VenuesModule {}
