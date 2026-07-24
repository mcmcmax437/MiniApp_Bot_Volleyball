import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt.guard';
import { NotBannedGuard } from './not-banned.guard';
import { AvatarModule } from '../avatar/avatar.module';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get<string>('JWT_SECRET') ?? 'dev-only-secret-change-me',
        signOptions: { expiresIn: cfg.get<string>('JWT_EXPIRES_IN') ?? '30d' },
      }),
    }),
    AvatarModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, NotBannedGuard],
  exports: [AuthService, JwtAuthGuard, NotBannedGuard, JwtModule],
})
export class AuthModule {}
