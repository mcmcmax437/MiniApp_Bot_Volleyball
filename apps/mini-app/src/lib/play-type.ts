import type { PlayType } from '../api';

/**
 * Map a `Game.playType` to the static cover image that ships with the app.
 *
 * The image is a public asset (under `apps/mini-app/public/`) served by Vite
 * at the site root. Used as the fallback when the host has not uploaded a
 * custom field photo (`coverImageUrl` / `coverImageUrl2`).
 *
 * If a game was created before `playType` shipped, it defaults to OUTDOOR
 * server-side, so the same default image covers the legacy rows too.
 */
export function coverForPlayType(playType: PlayType): string {
  switch (playType) {
    case 'BEACH':
      return '/cover-beach.png';
    case 'INDOOR':
      return '/cover-indoor.png';
    case 'OUTDOOR':
    default:
      return '/cover-outdoor.png';
  }
}

/** Prefer custom field photo(s); fall back to the play-type stock cover. */
export function resolveGameCovers(game: {
  playType: PlayType;
  coverImageUrl?: string | null;
  coverImageUrl2?: string | null;
}): string[] {
  const custom = [game.coverImageUrl, game.coverImageUrl2].filter(
    (u): u is string => !!u && u.trim().length > 0,
  );
  if (custom.length) return custom;
  return [coverForPlayType(game.playType)];
}

export function resolveGameCover(game: {
  playType: PlayType;
  coverImageUrl?: string | null;
  coverImageUrl2?: string | null;
}): string {
  return resolveGameCovers(game)[0];
}