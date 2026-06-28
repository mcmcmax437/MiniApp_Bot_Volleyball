import type { ApiUser, SkillLevel } from '../api';

/**
 * Loose shape: any record that carries the two fields we care about. Lets
 * the helper work for `ApiUser`, `ApiGame.host`, `GameParticipant.user`,
 * `BlacklistEntry.user`, `EvaluationCandidate`, etc. — all of which happen
 * to expose `skillLevel` + `evaluatedSkillLevel` without necessarily
 * declaring them in the same TypeScript shape.
 */
type WithLevels = {
  skillLevel?: SkillLevel | null;
  evaluatedSkillLevel?: SkillLevel | null;
};

/**
 * The single source of truth for "what skill number should we show for this
 * user?" Returns the peer-corrected weighted level when the backend has one
 * computed (it's cached on `User.evaluatedSkillLevel`), otherwise falls back
 * to the user's self-declared level, otherwise `null`.
 *
 * This is what every player-facing badge should consume. Admin views still
 * show the raw `skillLevel` and `evaluatedSkillLevel` separately because
 * admins need the underlying values, not the blended one.
 */
export function effectiveSkillLevel(
  user: WithLevels | null | undefined,
): SkillLevel | null {
  if (!user) return null;
  return (user.evaluatedSkillLevel ?? user.skillLevel) ?? null;
}
