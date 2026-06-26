import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthedRequest } from './jwt.guard';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Requires the authenticated Telegram user to match TELEGRAM_SUPERADMIN_ID. Must be applied
 * AFTER JwtAuthGuard (so `req.user.sub` is set).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (!req.user?.sub) {
      throw new ForbiddenException('Not authenticated');
    }
    const me = await this.prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { id: true, telegramId: true },
    });
    const superadminId = this.config.get<string>('TELEGRAM_SUPERADMIN_ID')?.trim();
    if (!me || !superadminId || me.telegramId.toString() !== superadminId) {
      throw new ForbiddenException('Super admin access required');
    }
    return true;
  }
}
