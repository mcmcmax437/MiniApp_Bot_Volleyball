import type { ApiGame } from '../api';

/** Display statuses shown on cards (LIVE is derived, not stored in DB). */
export type GameDisplayStatus = ApiGame['status'] | 'LIVE';

/**
 * A game is "going" once kickoff has passed and the lobby is still
 * OPEN/FULL (auto-finish is startAt + 5h). FINISHED/CANCELLED stay as-is.
 */
export function isGameLive(game: Pick<ApiGame, 'status' | 'startAt'>): boolean {
  if (game.status !== 'OPEN' && game.status !== 'FULL') return false;
  return new Date(game.startAt).getTime() <= Date.now();
}

export function gameDisplayStatus(
  game: Pick<ApiGame, 'status' | 'startAt'>,
): GameDisplayStatus {
  if (isGameLive(game)) return 'LIVE';
  return game.status;
}
