/**
 * Share a game into Telegram chats via the native share sheet.
 *
 * Deep link: https://t.me/<bot>?startapp=g_<gameId>
 * The Mini App reads `start_param` on launch and opens /games/:id.
 *
 * Note: t.me/share/url only supports plain text (no HTML). The deep link
 * is required as `url`; we put the eye-catching copy in `text`.
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

export type GameShareDetails = {
  venueName: string;
  address?: string | null;
  when: string;
  playTypeLabel?: string | null;
  skillLabel?: string | null;
  closed?: boolean;
  spotsLine?: string | null;
  priceLabel?: string | null;
  headline: string;
  cta: string;
};

/** Build a plain-text invite card for Telegram share. */
export function buildGameShareText(d: GameShareDetails): string {
  const lines: string[] = [
    '━━━━ 🏐 ━━━━',
    d.headline,
    '━━━━━━━━━━',
    '',
    `📍 ${d.venueName}`,
  ];

  const addr = d.address?.trim();
  if (addr && addr !== d.venueName.trim()) {
    lines.push(`🗺 ${addr}`);
  }

  lines.push(`🗓 ${d.when}`);

  const chips: string[] = [];
  if (d.playTypeLabel) chips.push(d.playTypeLabel);
  if (d.skillLabel) chips.push(d.skillLabel);
  if (d.closed) chips.push('🔒');
  if (chips.length) lines.push(`🏷 ${chips.join(' · ')}`);

  if (d.spotsLine) lines.push(`👥 ${d.spotsLine}`);
  if (d.priceLabel) lines.push(`💰 ${d.priceLabel}`);

  lines.push('');
  lines.push(d.cta);
  lines.push('👇');

  return lines.join('\n');
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
