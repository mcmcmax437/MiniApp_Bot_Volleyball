/**
 * Share a game into Telegram chats via the native share sheet.
 *
 * Deep link: https://t.me/<bot>?startapp=g_<gameId>
 * The Mini App reads `start_param` on launch and opens /games/:id.
 */

export const GAME_START_PREFIX = 'g_';

export function gameStartParam(gameId: string): string {
  return `${GAME_START_PREFIX}${gameId}`;
}

export function parseGameStartParam(param: string | null | undefined): string | null {
  if (!param || !param.startsWith(GAME_START_PREFIX)) return null;
  const id = param.slice(GAME_START_PREFIX.length).trim();
  return id || null;
}

export function gameDeepLink(botUsername: string, gameId: string): string {
  const user = botUsername.replace(/^@/, '');
  return `https://t.me/${user}?startapp=${encodeURIComponent(gameStartParam(gameId))}`;
}

export function shareGameToTelegram(opts: {
  botUsername: string;
  gameId: string;
  text: string;
}): boolean {
  const user = opts.botUsername.replace(/^@/, '').trim();
  if (!user || !opts.gameId) return false;

  const deepLink = gameDeepLink(user, opts.gameId);
  const shareUrl =
    `https://t.me/share/url` +
    `?url=${encodeURIComponent(deepLink)}` +
    `&text=${encodeURIComponent(opts.text)}`;

  const tg = window.Telegram?.WebApp as
    | { openTelegramLink?: (url: string) => void }
    | null
    | undefined;

  if (tg && typeof tg.openTelegramLink === 'function') {
    tg.openTelegramLink(shareUrl);
    return true;
  }

  window.open(shareUrl, '_blank', 'noopener,noreferrer');
  return true;
}
