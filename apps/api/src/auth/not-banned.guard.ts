import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthedRequest } from './jwt.guard';

/**
 * Blocks banned accounts from mutating actions. Must run *after* `JwtAuthGuard`
 * so `req.userRecord` is hydrated. Keep `/me` GET unguarded by this so the
 * client can still load the ban banner.
 */
@Injectable()
export class NotBannedGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (req.userRecord?.isBanned) {
      throw new ForbiddenException(
        req.userRecord.bannedReason
          ? `Account is banned: ${req.userRecord.bannedReason}`
          : 'Account is banned',
      );
    }
    return true;
  }
}
