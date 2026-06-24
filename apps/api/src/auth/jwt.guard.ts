import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AuthService, JwtPayload } from './auth.service';

export interface AuthedRequest extends Request {
  user?: JwtPayload;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const headerToken = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    const cookieToken = (req as Request).cookies?.['auth_token'] as string | undefined;
    const token = headerToken || cookieToken;
    if (!token) throw new UnauthorizedException('Missing auth token');
    req.user = await this.auth.verifyToken(token);
    return true;
  }
}
