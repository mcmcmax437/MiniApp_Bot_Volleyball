import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parseFbPost, splitFbPosts } from './parse-fb-post';

const TZ = 'Europe/Warsaw';

function warsawYmd(date: Date) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(map.weekday);
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    weekday: weekday < 0 ? 0 : weekday,
  };
}

/** Monday 00:00 Europe/Warsaw, as a UTC Date. */
export function startOfThisWeek(now = new Date()): Date {
  const p = warsawYmd(now);
  const daysSinceMonday = (p.weekday + 6) % 7;
  const monday = new Date(Date.UTC(p.year, p.month - 1, p.day - daysSinceMonday));
  // Reinterpret that calendar day as Warsaw midnight.
  let utcMs = Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate(), 0, 0, 0);
  for (let i = 0; i < 4; i++) {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const map: Record<string, string> = {};
    for (const part of fmt.formatToParts(new Date(utcMs))) {
      if (part.type !== 'literal') map[part.type] = part.value;
    }
    const hour = map.hour === '24' ? '00' : map.hour;
    const asUtc = Date.UTC(
      Number(map.year),
      Number(map.month) - 1,
      Number(map.day),
      Number(hour),
      Number(map.minute),
      0,
    );
    const wanted = Date.UTC(
      monday.getUTCFullYear(),
      monday.getUTCMonth(),
      monday.getUTCDate(),
      0,
      0,
      0,
    );
    utcMs += wanted - asUtc;
  }
  return new Date(utcMs);
}

@Injectable()
export class FbOffersService {
  constructor(private readonly prisma: PrismaService) {}

  async listThisWeek() {
    const from = startOfThisWeek();
    const rows = await this.prisma.fbGameOffer.findMany({
      where: { postedAt: { gte: from } },
    });
    rows.sort((a, b) => {
      if (a.gameDate && b.gameDate) return a.gameDate.getTime() - b.gameDate.getTime();
      if (a.gameDate) return -1;
      if (b.gameDate) return 1;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        status: r.status as 'OPEN' | 'FULL',
        gameDate: r.gameDate?.toISOString() ?? null,
        whenLabel: r.whenLabel,
        gameLevel: r.gameLevel,
        freePlaces: r.freePlaces,
        address: r.address,
        link: r.link,
        rawText: r.rawText,
        postedAt: r.postedAt.toISOString(),
      })),
    };
  }

  async importPosts(text: string, link?: string) {
    const chunks = splitFbPosts(text);
    if (!chunks.length) throw new BadRequestException('Paste at least one post');
    const now = new Date();
    const created: string[] = [];
    for (const chunk of chunks) {
      const parsed = parseFbPost(chunk, now);
      const row = await this.prisma.fbGameOffer.create({
        data: {
          rawText: chunk.slice(0, 8000),
          status: parsed.status,
          gameDate: parsed.gameDate ? new Date(parsed.gameDate) : null,
          whenLabel: parsed.whenLabel,
          gameLevel: parsed.gameLevel,
          freePlaces: parsed.freePlaces,
          address: parsed.address,
          link: parsed.link ?? (chunks.length === 1 ? link?.trim() || null : null),
          postedAt: now,
        },
      });
      created.push(row.id);
    }
    return { count: created.length };
  }

  async remove(id: string) {
    const row = await this.prisma.fbGameOffer.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Offer not found');
    await this.prisma.fbGameOffer.delete({ where: { id } });
    return { ok: true };
  }
}
