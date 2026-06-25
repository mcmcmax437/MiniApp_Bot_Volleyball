import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { User } from '@prisma/client';

export const VALID_REASONS = ['TOXIC', 'SKIPPED_GAME', 'HARASSMENT', 'CHEATING', 'OTHER'] as const;
type ReportReason = (typeof VALID_REASONS)[number];

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async file(me: User, targetId: string, reason: ReportReason, gameId?: string, details?: string) {
    if (!VALID_REASONS.includes(reason)) {
      throw new BadRequestException(`Invalid reason: ${reason}`);
    }
    if (targetId === me.id) {
      throw new BadRequestException('Cannot report yourself');
    }
    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target) throw new NotFoundException('Target user not found');

    return this.prisma.report.create({
      data: {
        reporterId: me.id,
        targetId,
        gameId: gameId ?? null,
        reason,
        details: details ?? null,
      },
    });
  }

  async listMine(me: User) {
    return this.prisma.report.findMany({
      where: { reporterId: me.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        target: { select: { id: true, firstName: true, username: true } },
      },
    });
  }
}