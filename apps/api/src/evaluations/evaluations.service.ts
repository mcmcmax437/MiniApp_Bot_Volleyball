import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { type SkillLevel } from '../shared/skill-levels';
import type { User } from '@prisma/client';
import {
  computeWeightedSkillLevel,
  skillLevelToNumber,
} from './skill-aggregator';

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
      // Note: we don't validate the SkillLevel value here — it's already
      // enforced by the DTO (`@IsIn(SKILL_LEVELS)`).
    }

    // Snapshot the set of evaluatees we need to recalibrate. Done up front
    // so the work after the transaction is independent of what changed
    // inside it.
    const affectedIds = Array.from(new Set(items.map((i) => i.evaluateeId)));

    // Transaction: upsert each evaluation row AND recompute each affected
    // user's evaluatedSkillLevel inside the same DB transaction. This
    // guarantees the cached aggregated level can never be left stale
    // relative to the evaluation rows that produced it (if the process
    // dies mid-transaction, both halves roll back together).
    const txResults = await this.prisma.$transaction(async (tx) => {
      const upserts = await Promise.all(
        items.map((it) =>
          tx.gameEvaluation.upsert({
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

      for (const id of affectedIds) {
        await this.recalibrateUserSkillInTx(tx, id);
      }

      return upserts;
    });

    return { count: txResults.length };
  }

  /** List the evaluations I have already submitted for a game. */
  async listMine(me: User, gameId: string) {
    return this.prisma.gameEvaluation.findMany({
      where: { evaluatorId: me.id, gameId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Public, standalone recompute. Used by callers that don't already hold a
   * transaction (e.g. the user's own level edit). Wraps the inner work in a
   * transaction so partial failures don't corrupt `evaluatedSkillLevel`.
   */
  async recalibrateUserSkill(userId: string) {
    return this.prisma.$transaction(async (tx) =>
      this.recalibrateUserSkillInTx(tx, userId),
    );
  }

  /**
   * Compute and persist the user-facing weighted skill level for a single
   * user. Must be called inside a transaction (see {@link recalibrateUserSkill}
   * for the standalone wrapper).
   */
  private async recalibrateUserSkillInTx(
    tx: Prisma.TransactionClient,
    userId: string,
  ) {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { skillLevel: true },
    });
    if (!user) return null;

    const rows = await tx.gameEvaluation.findMany({
      where: { evaluateeId: userId },
      select: { skillLevel: true },
    });
    const peerLevels = rows.map((r) => r.skillLevel as SkillLevel);

    const result = computeWeightedSkillLevel({
      selfLevel: (user.skillLevel as SkillLevel | null) ?? null,
      peerLevels,
    });

    // Persist only when there's a level to display — keeps the column
    // sparse for users with no signal at all.
    if (result.level === null) {
      // Don't blindly null out an existing value — only clear it if the
      // caller explicitly wants that. For now, leave it untouched.
      return null;
    }

    await tx.user.update({
      where: { id: userId },
      data: { evaluatedSkillLevel: result.level, evaluatedAt: new Date() },
    });
    return { ...result, meanNumeric: result.mean ?? skillLevelToNumber(result.level) };
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
