import { SKILL_LEVELS, type SkillLevel } from '../shared/skill-levels';

/**
 * Convert a 1–6 numeric level to the nearest `SkillLevel` enum value.
 * Snap points sit at the midpoints (1.5, 2.5, …) so e.g. 1.4 → LEVEL_1
 * and 1.6 → LEVEL_2. This is the same rounding rule used by the previous
 * unweighted aggregator; kept here so callers can swap formulas without
 * changing how the result is bucketed.
 */
export function levelFromAverage(avg: number): SkillLevel {
  if (avg < 1.5) return 'LEVEL_1';
  if (avg < 2.5) return 'LEVEL_2';
  if (avg < 3.5) return 'LEVEL_3';
  if (avg < 4.5) return 'LEVEL_4';
  if (avg < 5.5) return 'LEVEL_5';
  return 'LEVEL_6';
}

/** Map a `SkillLevel` to its numeric position (LEVEL_1 = 1, …, LEVEL_6 = 6). */
export function skillLevelToNumber(level: SkillLevel): number {
  return SKILL_LEVELS.indexOf(level) + 1;
}

export interface ComputeWeightedSkillLevelInput {
  /**
   * The user's self-declared level (their own pick from the welcome flow or
   * later edits). `null` if the user hasn't picked one yet.
   */
  selfLevel: SkillLevel | null;
  /**
   * Every peer-evaluation row that targets this user, across all games.
   * Order doesn't matter.
   */
  peerLevels: SkillLevel[];
}

/**
 * The single user-facing skill number that gets shown next to a player's
 * photo and on every game card.
 */
export interface WeightedSkillLevelResult {
  /** The computed level, or `null` if there is no signal at all. */
  level: SkillLevel | null;
  /** How many peer-evaluation rows fed into the calculation. */
  samples: number;
  /**
   * The raw weighted mean (1..6). Exposed for debug/analytics; the UI
   * displays `level` (the bucketed value).
   */
  mean: number | null;
}

const SELF_WEIGHT = 0.2;
const PEER_WEIGHT = 0.8;

/**
 * Compute the user-facing weighted skill level from a self-declared level
 * and a list of peer evaluations.
 *
 * Rules (per project decision):
 *  - If the user has neither a self-level nor any peer evaluations, the
 *    result is `null` — nothing to display.
 *  - If the user has a self-level but no peer evaluations yet, the result
 *    is the self-level (no peer evidence to override it).
 *  - If the user has no self-level but has peer evaluations, fall back to
 *    the unweighted peer mean (self-weight can't be applied).
 *  - Otherwise combine: `0.2 * self + 0.8 * peerMean`, then snap to the
 *    nearest `SkillLevel` via `levelFromAverage`.
 *
 * This function is pure (no DB, no clock) so it's trivial to unit-test and
 * trivial to swap out when the project's weighting rules change.
 */
export function computeWeightedSkillLevel(
  input: ComputeWeightedSkillLevelInput,
): WeightedSkillLevelResult {
  const { selfLevel, peerLevels } = input;
  const samples = peerLevels.length;

  // Nothing to display.
  if (!selfLevel && samples === 0) {
    return { level: null, samples: 0, mean: null };
  }

  // No peer evidence yet — trust the user's self-declaration.
  if (selfLevel && samples === 0) {
    return {
      level: selfLevel,
      samples: 0,
      mean: skillLevelToNumber(selfLevel),
    };
  }

  // No self-declaration but we have peer votes — fall back to the simple
  // peer mean. There is no self value to weight against, so we apply the
  // peer weight fully rather than artificially capping the result.
  if (!selfLevel && samples > 0) {
    const peerSum = peerLevels.reduce((acc, lvl) => acc + skillLevelToNumber(lvl), 0);
    const peerMean = peerSum / samples;
    return {
      level: levelFromAverage(peerMean),
      samples,
      mean: peerMean,
    };
  }

  // Both self and peers exist — combine with the 0.2 / 0.8 weights.
  const selfNumeric = skillLevelToNumber(selfLevel as SkillLevel);
  const peerSum = peerLevels.reduce((acc, lvl) => acc + skillLevelToNumber(lvl), 0);
  const peerMean = peerSum / samples;
  const weighted = SELF_WEIGHT * selfNumeric + PEER_WEIGHT * peerMean;

  return {
    level: levelFromAverage(weighted),
    samples,
    mean: weighted,
  };
}
