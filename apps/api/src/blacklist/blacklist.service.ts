import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { User } from '@prisma/client';

const MAX_BLACKLIST_SIZE = 10;

@Injectable()
export class BlacklistService {
  constructor(private readonly prisma: PrismaService) {}

  /** List users blocked by `me`. */
  async list(me: User) {
    const rows = await this.prisma.blacklist.findMany({
      where: { ownerId: me.id },
      orderBy: { createdAt: 'desc' },
      include: {
        blocked: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            photoUrl: true,
            skillLevel: true,
          },
        },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      blockedId: r.blockedId,
      reason: r.reason,
      createdAt: r.createdAt,
      user: r.blocked,
    }));
  }

  async add(me: User, blockedId: string, reason?: string) {
    if (blockedId === me.id) {
      throw new BadRequestException('Cannot blacklist yourself');
    }
    const target = await this.prisma.user.findUnique({ where: { id: blockedId } });
    if (!target) throw new NotFoundException('User not found');

    const count = await this.prisma.blacklist.count({ where: { ownerId: me.id } });
    if (count >= MAX_BLACKLIST_SIZE) {
      throw new BadRequestException(
        `Blacklist is full (max ${MAX_BLACKLIST_SIZE} users). Remove someone first.`,
      );
    }

    return this.prisma.blacklist.upsert({
      where: { ownerId_blockedId: { ownerId: me.id, blockedId } },
      create: { ownerId: me.id, blockedId, reason: reason ?? null },
      update: { reason: reason ?? null },
    });
  }

  async remove(me: User, blockedId: string) {
    return this.prisma.blacklist.deleteMany({
      where: { ownerId: me.id, blockedId },
    });
  }

  /**
   * Return the set of user IDs from `participantIds` that `me` has blocked.
   * Used to render a warning banner before joining a game.
   */
  async blockedSetFor(me: User, participantIds: string[]) {
    if (participantIds.length === 0) return new Set<string>();
    const rows = await this.prisma.blacklist.findMany({
      where: {
        ownerId: me.id,
        blockedId: { in: participantIds },
      },
      select: { blockedId: true },
    });
    return new Set(rows.map((r) => r.blockedId));
  }
}