import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import type { User } from '@prisma/client';
import { AuthService, JwtPayload } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

export interface AuthedRequest extends Request {
  /**
   * The verified JWT payload. Populated by `JwtAuthGuard`.
   * Always present after the guard has run.
   */
  user?: JwtPayload;
  /**
   * The full DB record for the user identified by `user.sub`. Populated by
   * `JwtAuthGuard` so downstream `@CurrentUser()` calls and any code that needs
   * the full user (role, telegramId, photoUrl, etc.) can read it without an
   * extra `prisma.user.findUnique` round-trip. `null` if the user record no
   * longer exists in the DB (e.g. the row was hard-deleted while the token is
   * still valid). The JWT itself is still considered verified.
   */
  userRecord?: User | null;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const headerToken = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    const cookieToken = (req as Request).cookies?.['auth_token'] as string | undefined;
    const token = headerToken || cookieToken;
    if (!token) throw new UnauthorizedException('Missing auth token');
    const payload = await this.auth.verifyToken(token);
    req.user = payload;
    // Hydrate the full user record once per request so `@CurrentUser()` and
    // other handlers don't each need a separate `prisma.user.findUnique`. We
    // intentionally allow the lookup to fail without rejecting the request —
    // a stale token for a deleted user should still get a clean 401 from the
    // controller rather than a 500 here.
    try {
      req.userRecord = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });
    } catch {
      req.userRecord = null;
    }
    return true;
  }
}
