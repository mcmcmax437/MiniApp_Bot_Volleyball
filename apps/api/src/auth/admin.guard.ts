import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { CurrentUser } from './current-user.decorator';
import { AuthedRequest } from './jwt.guard';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Requires the authenticated user to have `role: 'ADMIN'`. Must be applied
 * AFTER JwtAuthGuard (so `req.user.sub` is set).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (!req.user?.sub) {
      throw new ForbiddenException('Not authenticated');
    }
    const me = await this.prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { id: true, role: true },
    });
    if (!me || me.role !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}