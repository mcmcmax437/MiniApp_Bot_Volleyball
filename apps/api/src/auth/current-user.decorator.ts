import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { AuthedRequest } from './jwt.guard';
import { PrismaService } from '../prisma/prisma.service';

export const CurrentUser = createParamDecorator(
  async (_data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (!req.user) return null;
    const prisma = ctx.switchToHttp().getRequest().prisma as PrismaService | undefined;
    if (prisma) {
      return prisma.user.findUnique({ where: { id: req.user.sub } });
    }
    // Fallback: resolve from the app context (set in main.ts).
    const app = ctx.switchToHttp().getRequest().app ?? (globalThis as any).__nestApp;
    if (app) {
      try {
        const p = app.get(PrismaService, { strict: false });
        return await p.user.findUnique({ where: { id: req.user.sub } });
      } catch {
        return null;
      }
    }
    return null;
  },
);
