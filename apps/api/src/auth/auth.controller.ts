import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { IsString } from 'class-validator';
import { AuthService } from './auth.service';
import { JwtAuthGuard, AuthedRequest } from './jwt.guard';
import { PrismaService } from '../prisma/prisma.service';

class TelegramLoginDto {
  @IsString()
  initData!: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('telegram')
  async telegram(@Body() dto: TelegramLoginDto, @Res({ passthrough: true }) res: Response) {
    const { user, token } = await this.auth.loginWithTelegram(dto.initData);
    res.cookie('auth_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 30,
    });
    return { user: this.toPublicUser(user), token };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('auth_token');
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async whoami(@Req() req: AuthedRequest) {
    const u = await this.prisma.user.findUnique({ where: { id: req.user!.sub } });
    return u ? this.toPublicUser(u) : null;
  }

  private toPublicUser(u: any) {
    return {
      id: u.id,
      telegramId: u.telegramId.toString(),
      firstName: u.firstName,
      lastName: u.lastName,
      username: u.username,
      age: u.age,
      skillLevel: u.skillLevel,
      city: u.city,
      lat: u.lat,
      lng: u.lng,
      reminderOffsets: u.reminderOffsets,
      photoUrl: u.photoUrl ?? null,
      role: u.role ?? 'USER',
    };
  }
}