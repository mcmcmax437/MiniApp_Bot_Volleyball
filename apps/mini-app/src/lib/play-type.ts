import type { PlayType } from '../api';

/**
 * Map a `Game.playType` to the static cover image that ships with the app.
 *
 * The image is a public asset (under `apps/mini-app/public/`) served by Vite
 * at the site root. We derive the URL on the client instead of storing a
 * `coverImageUrl` row in the DB so:
 *   1. The organizer never has to pick a photo during game creation.
 *   2. We can swap covers with a single deploy — no DB migration needed.
 *   3. The image is always in sync with `playType`.
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