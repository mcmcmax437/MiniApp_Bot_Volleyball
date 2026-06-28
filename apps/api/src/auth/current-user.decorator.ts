import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { User } from '@prisma/client';
import { AuthedRequest } from './jwt.guard';

/**
 * Returns the authenticated `User` row for the current request, or `null` if
 * the request is unauthenticated (the controller's own `JwtAuthGuard` runs
 * first and is responsible for rejecting unauthenticated callers — see
 * `auth.controller.ts` for how `req.userRecord` is also used).
 *
 * The user record is hydrated once per request by `JwtAuthGuard` and stored on
 * `req.userRecord`, so this decorator never hits the database itself. The
 * previous implementation tried to resolve Prisma via `req.prisma` and a
 * global app reference, but neither was ever wired up — which meant every
 * `@CurrentUser()` call returned `null` and downstream services crashed with
 * `Cannot read properties of null (reading 'id')`.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User | null => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (req.userRecord === undefined) {
      // Guard never ran (route is public). Fall back to the JWT subject if
      // present so callers that expect a User-shaped object still get one.
      return req.user ? ({ id: req.user.sub } as User) : null;
    }
    return req.userRecord;
  },
);