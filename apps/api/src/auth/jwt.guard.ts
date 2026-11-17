import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import type { User } from '@prisma/client';
import { AuthService, JwtPayload } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { verifyTelegramInitData } from './telegram-auth.util';

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

/**
 * Same hydration as `JwtAuthGuard`, but never rejects. Used on public game
 * reads so we can redact the roster for outsiders when the host hid players.
 */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const headerToken = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    const cookieToken = (req as Request).cookies?.['auth_token'] as string | undefined;
    const token = headerToken || cookieToken;
    if (token) {
      try {
        const payload = await this.auth.verifyToken(token);
        req.user = payload;
        req.userRecord = await this.prisma.user.findUnique({
          where: { id: payload.sub },
        });
        return true;
      } catch {
        // Expired / invalid cookie — fall through to the initData fallback.
      }
    }

    // The Mini App sends its Telegram `initData` on every request, but the
    // login cookie only exists after `/auth/telegram` has run. On a cold start
    // from a deep link (e.g. an invitation's "Open invite" button) the game
    // read can race ahead of that login and be answered as an anonymous
    // viewer — which used to leave an invited player stuck on "Spots full"
    // even when a reserved seat was held for them. Verify the initData here
    // so public reads are personalised from the first call.
    const user = await this.userFromInitData(req);
    req.userRecord = user;
    req.user = user ? { sub: user.id, tid: user.telegramId.toString() } : undefined;
    return true;
  }

  /** Resolve the Telegram user from the `X-Telegram-InitData` header. */
  private async userFromInitData(req: Request): Promise<User | null> {
    const raw = req.headers['x-telegram-initdata'];
    const initData = Array.isArray(raw) ? raw[0] : raw;
    if (!initData) return null;
    const botToken = this.config.get<string>('BOT_TOKEN');
    if (!botToken) return null;
    try {
      const parsed = verifyTelegramInitData(initData, botToken);
      const telegramId = parsed.user?.id;
      if (!telegramId) return null;
      return await this.prisma.user.findUnique({
        where: { telegramId: BigInt(telegramId) },
      });
    } catch {
      // Invalid / expired initData → treat the request as anonymous.
      return null;
    }
  }
}
