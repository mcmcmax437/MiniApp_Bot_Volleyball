import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdminUpdateGameDto,
  AdminUpdateUserDto,
  AdminUpdateVenueDto,
} from './dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------- Stats ----------
  async getStats() {
    const [users, games, venues, todaySignups] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.game.count(),
      this.prisma.venue.count(),
      this.prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);
    return {
      users,
      games,
      venues,
      signupsLast24h: todaySignups,
    };
  }

  // ---------- Users ----------
  async listUsers(params: { take: number; skip: number; q?: string }) {
    const where = params.q
      ? {
          OR: [
            { firstName: { contains: params.q } },
            { lastName: { contains: params.q } },
            { username: { contains: params.q } },
          ],
        }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params.take,
        skip: params.skip,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, take: params.take, skip: params.skip };
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async updateUser(actorId: string, id: string, dto: AdminUpdateUserDto) {
    const before = await this.getUser(id);
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        firstName: dto.firstName ?? undefined,
        lastName: dto.lastName === undefined ? undefined : dto.lastName,
        username: dto.username === undefined ? undefined : dto.username,
        city: dto.city ?? undefined,
        age: dto.age ?? undefined,
        skillLevel: dto.skillLevel === undefined ? undefined : dto.skillLevel,
        role: dto.role ?? undefined,
      },
    });
    await this.log(actorId, 'user.update', 'user', id, { before, after: updated });
    return updated;
  }

  async deleteUser(actorId: string, id: string) {
    const user = await this.getUser(id);
    // Cascade-delete related entities to keep DB consistent.
    await this.prisma.$transaction([
      this.prisma.gameParticipant.deleteMany({ where: { userId: id } }),
      this.prisma.game.deleteMany({ where: { hostId: id } }),
      this.prisma.user.delete({ where: { id } }),
    ]);
    await this.log(actorId, 'user.delete', 'user', id, { telegramId: user.telegramId.toString() });
    return { ok: true };
  }

  // ---------- Games ----------
  async listGames(params: { take: number; skip: number; q?: string }) {
    const where = params.q
      ? {
          OR: [
            { notes: { contains: params.q } },
            { venue: { name: { contains: params.q } } },
            { host: { firstName: { contains: params.q } } },
          ],
        }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.game.findMany({
        where,
        orderBy: { startAt: 'desc' },
        take: params.take,
        skip: params.skip,
        include: {
          venue: true,
          host: { select: { id: true, firstName: true, username: true } },
          _count: { select: { participants: true } },
        },
      }),
      this.prisma.game.count({ where }),
    ]);
    return { items, total, take: params.take, skip: params.skip };
  }

  async updateGame(actorId: string, id: string, dto: AdminUpdateGameDto) {
    const before = await this.prisma.game.findUnique({ where: { id } });
    if (!before) throw new NotFoundException(`Game ${id} not found`);
    const updated = await this.prisma.game.update({
      where: { id },
      data: {
        status: dto.status ?? undefined,
        spotsTotal: dto.spotsTotal ?? undefined,
        notes: dto.notes === undefined ? undefined : dto.notes,
      },
    });
    await this.log(actorId, 'game.update', 'game', id, {
      fields: Object.keys(dto),
      before,
      after: updated,
    });
    return updated;
  }

  async deleteGame(actorId: string, id: string) {
    const game = await this.prisma.game.findUnique({ where: { id } });
    if (!game) throw new NotFoundException(`Game ${id} not found`);
    await this.prisma.game.delete({ where: { id } });
    await this.log(actorId, 'game.delete', 'game', id, null);
    return { ok: true };
  }

  // ---------- Venues ----------
  async listVenues(params: { take: number; skip: number; q?: string }) {
    const where = params.q
      ? {
          OR: [
            { name: { contains: params.q } },
            { address: { contains: params.q } },
            { city: { contains: params.q } },
          ],
        }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.venue.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params.take,
        skip: params.skip,
        include: { _count: { select: { games: true } } },
      }),
      this.prisma.venue.count({ where }),
    ]);
    return { items, total, take: params.take, skip: params.skip };
  }

  async updateVenue(actorId: string, id: string, dto: AdminUpdateVenueDto) {
    const before = await this.prisma.venue.findUnique({ where: { id } });
    if (!before) throw new NotFoundException(`Venue ${id} not found`);
    const updated = await this.prisma.venue.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        address: dto.address ?? undefined,
        hourlyPrice: dto.hourlyPrice ?? undefined,
        capacity: dto.capacity ?? undefined,
        status: dto.status ?? undefined,
      },
    });
    await this.log(actorId, 'venue.update', 'venue', id, {
      fields: Object.keys(dto),
      before,
      after: updated,
    });
    return updated;
  }

  async deleteVenue(actorId: string, id: string) {
    const venue = await this.prisma.venue.findUnique({ where: { id } });
    if (!venue) throw new NotFoundException(`Venue ${id} not found`);
    // Refuse to delete if there are games on this venue (data integrity).
    const gameCount = await this.prisma.game.count({ where: { venueId: id } });
    if (gameCount > 0) {
      throw new NotFoundException(
        `Cannot delete venue with ${gameCount} game(s). Hide it instead by setting status=HIDDEN.`,
      );
    }
    await this.prisma.venue.delete({ where: { id } });
    await this.log(actorId, 'venue.delete', 'venue', id, null);
    return { ok: true };
  }

  // ---------- Audit log ----------
  async listAudit(params: { take: number; skip: number }) {
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: params.take,
        skip: params.skip,
        include: {
          actor: { select: { id: true, firstName: true, username: true } },
        },
      }),
      this.prisma.auditLog.count(),
    ]);
    return { items, total, take: params.take, skip: params.skip };
  }

  private async log(
    actorId: string,
    action: string,
    targetType: string,
    targetId: string,
    meta: unknown,
  ) {
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action,
        targetType,
        targetId,
        meta: meta === null || meta === undefined ? undefined : (meta as any),
      },
    });
  }
}