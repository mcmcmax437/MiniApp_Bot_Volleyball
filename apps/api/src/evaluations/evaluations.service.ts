import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SKILL_LEVELS } from '../shared/skill-levels';
import type { User } from '@prisma/client';

type SkillLevel = (typeof SKILL_LEVELS)[number];

/**
 * Convert numeric mean → nearest SkillLevel.
 * Uses midpoints between adjacent levels (1.5, 2.5, 3.5, 4.5, 5.5).
 */
function levelFromAverage(avg: number): SkillLevel {
  if (avg < 1.5) return 'LEVEL_1';
  if (avg < 2.5) return 'LEVEL_2';
  if (avg < 3.5) return 'LEVEL_3';
  if (avg < 4.5) return 'LEVEL_4';
  if (avg < 5.5) return 'LEVEL_5';
  return 'LEVEL_6';
}

@Injectable()
export class EvaluationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Submit evaluations for one or more co-players from a finished game. */
  async submitMany(
    me: User,
    gameId: string,
    items: Array<{ evaluateeId: string; skillLevel: SkillLevel; note?: string }>,
  ) {
    if (!items.length) throw new BadRequestException('Nothing to submit');

    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: { participants: true },
    });
    if (!game) throw new NotFoundException('Game not found');
    if (game.status !== 'FINISHED') {
      throw new BadRequestException('Game must be FINISHED to evaluate');
    }
    if (!game.participants.some((p) => p.userId === me.id)) {
      throw new ForbiddenException('Only participants can submit evaluations');
    }

    const validEvaluatees = new Set(game.participants.map((p) => p.userId));
    for (const it of items) {
      if (it.evaluateeId === me.id) {
        throw new BadRequestException('Cannot evaluate yourself');
      }
      if (!validEvaluatees.has(it.evaluateeId)) {
        throw new BadRequestException(`User ${it.evaluateeId} was not in this game`);
      }
      if (!SKILL_LEVELS.includes(it.skillLevel)) {
        throw new BadRequestException(`Invalid skill level ${it.skillLevel}`);
      }
    }

    const results = await this.prisma.$transaction(
      items.map((it) =>
        this.prisma.gameEvaluation.upsert({
          where: {
            gameId_evaluatorId_evaluateeId: {
              gameId,
              evaluatorId: me.id,
              evaluateeId: it.evaluateeId,
            },
          },
          create: {
            gameId,
            evaluatorId: me.id,
            evaluateeId: it.evaluateeId,
            skillLevel: it.skillLevel,
            note: it.note ?? null,
          },
          update: {
            skillLevel: it.skillLevel,
            note: it.note ?? null,
          },
        }),
      ),
    );

    // After inserting, recalibrate each evaluatee's stored skill level.
    const affectedIds = Array.from(new Set(items.map((i) => i.evaluateeId)));
    for (const id of affectedIds) {
      await this.recalibrateUserSkill(id);
    }

    return { count: results.length };
  }

  /** List the evaluations I have already submitted for a game. */
  async listMine(me: User, gameId: string) {
    return this.prisma.gameEvaluation.findMany({
      where: { evaluatorId: me.id, gameId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Recompute a user's `evaluatedSkillLevel` from the average of all
   * evaluation rows they've received. Persists the result and timestamp.
   */
  async recalibrateUserSkill(userId: string) {
    const rows = await this.prisma.gameEvaluation.findMany({
      where: { evaluateeId: userId },
      select: { skillLevel: true },
    });
    if (!rows.length) return null;
    const numeric = rows.map((r) => SKILL_LEVELS.indexOf(r.skillLevel) + 1);
    const avg = numeric.reduce((a, b) => a + b, 0) / numeric.length;
    const level = levelFromAverage(avg);
    await this.prisma.user.update({
      where: { id: userId },
      data: { evaluatedSkillLevel: level, evaluatedAt: new Date() },
    });
    return { average: avg, level, samples: rows.length };
  }

  /** Eligible co-players in a finished game. */
  async listEligibleEvaluators(me: User, gameId: string) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                photoUrl: true,
                skillLevel: true,
                evaluatedSkillLevel: true,
              },
            },
          },
        },
      },
    });
    if (!game) throw new NotFoundException('Game not found');
    if (game.status !== 'FINISHED') {
      throw new BadRequestException('Game must be FINISHED');
    }
    if (!game.participants.some((p) => p.userId === me.id)) {
      throw new ForbiddenException('Only participants can list evaluators');
    }

    const mine = await this.prisma.gameEvaluation.findMany({
      where: { evaluatorId: me.id, gameId },
    });
    const mineByEvaluatee = new Map(mine.map((e) => [e.evaluateeId, e.skillLevel]));

    return {
      currency: game.currency,
      self: me.id,
      candidates: game.participants
        .filter((p) => p.userId !== me.id)
        .map((p) => ({
          ...p.user,
          alreadyRated: mineByEvaluatee.has(p.userId),
          ratedAs: mineByEvaluatee.get(p.userId) ?? null,
        })),
    };
  }
}