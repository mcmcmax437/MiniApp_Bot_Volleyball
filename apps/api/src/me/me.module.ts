import { Module } from '@nestjs/common';
import { MeController } from './me.controller';
import { AuthModule } from '../auth/auth.module';
import { EvaluationsModule } from '../evaluations/evaluations.module';

@Module({
  imports: [AuthModule, EvaluationsModule],
  controllers: [MeController],
})
export class MeModule {}
