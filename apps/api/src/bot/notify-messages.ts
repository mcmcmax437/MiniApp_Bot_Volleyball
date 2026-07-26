/**
 * HTML bodies for Telegram bot notifications.
 * `TelegramSender` always sends with parse_mode: 'HTML'.
 *
 * Times must use APP_TIMEZONE (not the VPS clock). The API stores UTC
 * instants; without an explicit zone, Node on the server formats as UTC
 * and Telegram shows e.g. 12:00 while the Mini App (phone local) shows 15:00.
 */

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** IANA zone for game times in bot DMs. Override with APP_TIMEZONE in .env. */
export function appTimeZone(): string {
  return (
    process.env.APP_TIMEZONE?.trim() ||
    process.env.TZ?.trim() ||
    'Europe/Warsaw'
  );
}

const LOCALE_TAG: Record<string, string> = {
  uk: 'uk-UA',
  pl: 'pl-PL',
  en: 'en-GB',
  ru: 'ru-RU',
};

/** Human-friendly datetime in the app timezone, e.g. "Sun, 26 Jul · 17:00". */
export function formatGameWhen(
  date: Date,
  locale = 'en',
  timeZone: string = appTimeZone(),
): string {
  const tag = LOCALE_TAG[locale] ?? locale;
  try {
    const day = new Intl.DateTimeFormat(tag, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone,
    }).format(date);
    const time = new Intl.DateTimeFormat(tag, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone,
    }).format(date);
    return `${day} · ${time}`;
  } catch {
    return date.toISOString().replace('T', ' ').slice(0, 16);
  }
}

function placeLine(venueName: string, venueAddress?: string | null): string {
  if (venueAddress && venueAddress.trim() && venueAddress.trim() !== venueName.trim()) {
    return `📍 <b>${esc(venueName)}</b>\n   ${esc(venueAddress.trim())}`;
  }
  return `📍 <b>${esc(venueName)}</b>`;
}

function card(lines: string[]): string {
  return lines.filter((l) => l !== null && l !== undefined).join('\n');
}

export function inviteMessage(opts: {
  inviterName: string;
  venueName: string;
  venueAddress?: string | null;
  startAt: Date;
  locale?: string;
}): string {
  const when = formatGameWhen(opts.startAt, opts.locale);
  return card([
    `🏐 <b>You're invited!</b>`,
    ``,
    `<b>${esc(opts.inviterName)}</b> invited you to a volleyball game.`,
    ``,
    placeLine(opts.venueName, opts.venueAddress),
    `🗓 ${esc(when)}`,
    ``,
    `<i>Open the app to accept or decline.</i>`,
  ]);
}

export function reminderMessage(opts: {
  venueName: string;
  venueAddress?: string | null;
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
    placeLine(opts.venueName, opts.venueAddress),
    `🗓 ${esc(when)}`,
    `👥 ${opts.players}/${opts.spotsTotal} players`,
    ``,
    `<i>See you on the court!</i>`,
  ]);
}

export function cancelledMessage(opts: {
  venueName: string;
  venueAddress?: string | null;
  startAt: Date;
  locale?: string;
}): string {
  const when = formatGameWhen(opts.startAt, opts.locale);
  return card([
    `❌ <b>Game cancelled</b>`,
    ``,
    placeLine(opts.venueName, opts.venueAddress),
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
