/**
 * Share a game into Telegram chats via the native share sheet.
 *
 * Deep link: https://t.me/<bot>?startapp=g_<gameId>
 * The Mini App reads `start_param` on launch and opens /games/:id.
 *
 * Note: t.me/share/url only supports plain text (no HTML). The deep link
 * is required as `url` (Telegram shows it above the card); eye-catching
 * copy goes in `text`.
 */

import { trackAnalytics } from './analytics-bus';

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
  /** Deep link placed on the CTA line (tappable in Telegram chats). */
  link: string;
  /** Optional brand line above the headline (e.g. "VolleyBot"). */
  brand?: string | null;
};

/**
 * Plain-text invite card for Telegram share.
 * Designed for scanability in a chat bubble: short brand, bold-feeling
 * headline, airy detail block, then CTA label + tappable game deep link.
 */
export function buildGameShareText(d: GameShareDetails): string {
  const brand = (d.brand ?? 'VolleyBot').trim();
  const lines: string[] = [
    `🏐  ${brand}`,
    '',
    d.headline.trim(),
    '',
    `📍  ${d.venueName.trim()}`,
  ];

  const addr = d.address?.trim();
  if (addr && addr !== d.venueName.trim()) {
    lines.push(`      ${addr}`);
  }

  lines.push('');
  lines.push(`🗓  ${d.when.trim()}`);

  const meta: string[] = [];
  if (d.playTypeLabel?.trim()) meta.push(d.playTypeLabel.trim());
  if (d.skillLabel?.trim()) meta.push(d.skillLabel.trim());
  if (d.closed) meta.push('🔒');
  if (meta.length) lines.push(`🏷  ${meta.join('  ·  ')}`);

  if (d.spotsLine?.trim()) lines.push(`👥  ${d.spotsLine.trim()}`);
  if (d.priceLabel?.trim()) lines.push(`💰  ${d.priceLabel.trim()}`);

  const link = d.link.trim();
  lines.push('');
  lines.push(`👉  ${d.cta.trim()}`);
  if (link) lines.push(link);

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
    trackAnalytics({
      type: 'game_share',
      screen: `/games/${opts.gameId}`,
      target: opts.gameId,
      meta: { via: 'telegram_link' },
    });
    return true;
  }

  window.open(shareUrl, '_blank', 'noopener,noreferrer');
  trackAnalytics({
    type: 'game_share',
    screen: `/games/${opts.gameId}`,
    target: opts.gameId,
    meta: { via: 'window_open' },
  });
  return true;
}
