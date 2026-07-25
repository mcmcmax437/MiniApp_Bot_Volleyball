/**
 * HTML bodies for Telegram bot notifications.
 * `TelegramSender` always sends with parse_mode: 'HTML'.
 */

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Human-friendly local datetime, e.g. "Sun, 26 Jul · 17:00". */
export function formatGameWhen(date: Date, locale = 'en'): string {
  try {
    const day = new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(date);
    const time = new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
    return `${day} · ${time}`;
  } catch {
    return date.toISOString().replace('T', ' ').slice(0, 16);
  }
}

function card(lines: string[]): string {
  return lines.filter((l) => l !== null && l !== undefined).join('\n');
}

export function inviteMessage(opts: {
  inviterName: string;
  venueName: string;
  startAt: Date;
  locale?: string;
}): string {
  const when = formatGameWhen(opts.startAt, opts.locale);
  return card([
    `🏐 <b>You're invited!</b>`,
    ``,
    `<b>${esc(opts.inviterName)}</b> invited you to a volleyball game.`,
    ``,
    `📍 <b>${esc(opts.venueName)}</b>`,
    `🗓 ${esc(when)}`,
    ``,
    `<i>Open the app to accept or decline.</i>`,
  ]);
}

export function reminderMessage(opts: {
  venueName: string;
  startAt: Date;
  minutesUntil: number;
  players: number;
  spotsTotal: number;
  locale?: string;
}): string {
  const when = formatGameWhen(opts.startAt, opts.locale);
  const lead =
    opts.minutesUntil >= 60
      ? `${Math.round(opts.minutesUntil / 60)}h`
      : `${Math.round(opts.minutesUntil)}m`;
  return card([
    `⏰ <b>Game reminder</b> · in ${esc(lead)}`,
    ``,
    `📍 <b>${esc(opts.venueName)}</b>`,
    `🗓 ${esc(when)}`,
    `👥 ${opts.players}/${opts.spotsTotal} players`,
    ``,
    `<i>See you on the court!</i>`,
  ]);
}

export function cancelledMessage(opts: {
  venueName: string;
  startAt: Date;
  locale?: string;
}): string {
  const when = formatGameWhen(opts.startAt, opts.locale);
  return card([
    `❌ <b>Game cancelled</b>`,
    ``,
    `📍 <b>${esc(opts.venueName)}</b>`,
    `🗓 ${esc(when)}`,
    ``,
    `<i>The host cancelled this game.</i>`,
  ]);
}

export function welcomeMessage(opts: { firstName: string; hasWebApp: boolean }): string {
  const name = esc(opts.firstName || 'friend');
  if (opts.hasWebApp) {
    return card([
      `🏐 <b>Welcome, ${name}!</b>`,
      ``,
      `Find games, create lobbies, and rate players — all in one place.`,
      ``,
      `<i>Tap the button below to open VolleyBot.</i>`,
    ]);
  }
  return card([
    `🏐 <b>Welcome, ${name}!</b>`,
    ``,
    `The Mini App isn't configured yet — set <code>WEBAPP_URL</code> on the server.`,
  ]);
}
