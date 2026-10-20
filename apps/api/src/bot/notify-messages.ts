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
    return `📍 <b>${esc(venueName)}</b>\n📌 ${esc(venueAddress.trim())}`;
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
    `🏐 <b>VolleyBot</b>`,
    ``,
    `<b>You're invited</b>`,
    `${esc(opts.inviterName)} asked you to play.`,
    ``,
    placeLine(opts.venueName, opts.venueAddress),
    `🗓 ${esc(when)}`,
    ``,
    `<i>Open the app to accept or decline.</i>`,
  ]);
}
/** Notify the host when an invitee accepts / declines / ignores. */
export function inviteResponseMessage(opts: {
  inviteeName: string;
  outcome: 'accepted' | 'declined' | 'ignored';
  venueName: string;
  venueAddress?: string | null;
  startAt: Date;
  locale?: string;
}): string {
  const when = formatGameWhen(opts.startAt, opts.locale);
  const name = esc(opts.inviteeName);
  const headline =
    opts.outcome === 'accepted'
      ? `✅ <b>${name}</b> accepted your invite`
      : opts.outcome === 'declined'
        ? `❌ <b>${name}</b> declined your invite`
        : `🙈 <b>${name}</b> ignored your invite`;
  return card([
    headline,
    ``,
    placeLine(opts.venueName, opts.venueAddress),
    `🗓 ${esc(when)}`,
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

/** Ask every participant to open the Mini App and rate co-players. */
export function ratePlayersMessage(opts: {
  venueName: string;
  venueAddress?: string | null;
  startAt: Date;
  locale?: string;
}): string {
  const when = formatGameWhen(opts.startAt, opts.locale);
  const locale = (opts.locale ?? 'en').slice(0, 2);
  const headline =
    locale === 'uk'
      ? '⭐ <b>Гру завершено</b> — оціни гравців'
      : locale === 'ru'
        ? '⭐ <b>Игра завершена</b> — оцени игроков'
        : locale === 'pl'
          ? '⭐ <b>Gra zakończona</b> — oceń graczy'
          : '⭐ <b>Game finished</b> — rate your co-players';
  const footer =
    locale === 'uk'
      ? '<i>Відкрий додаток і постав рівні тим, з ким грав.</i>'
      : locale === 'ru'
        ? '<i>Открой приложение и поставь уровни тем, с кем играл.</i>'
        : locale === 'pl'
          ? '<i>Otwórz aplikację i oceń poziom graczy z meczu.</i>'
          : '<i>Open the app and rate the players from this game.</i>';
  return card([
    headline,
    ``,
    placeLine(opts.venueName, opts.venueAddress),
    `🗓 ${esc(when)}`,
    ``,
    footer,
  ]);
}

export function spotOpenedMessage(opts: {
  venueName: string;
  venueAddress?: string | null;
  startAt: Date;
  spotsLeft: number;
  spotsTotal: number;
  locale?: string;
}): string {
  const when = formatGameWhen(opts.startAt, opts.locale);
  const spots =
    opts.spotsLeft === 1
      ? `1 spot free`
      : `${opts.spotsLeft} spots free`;
  return card([
    `🔔 <b>Spot opened!</b>`,
    ``,
    placeLine(opts.venueName, opts.venueAddress),
    `🗓 ${esc(when)}`,
    `👥 ${spots} · ${opts.spotsTotal - opts.spotsLeft}/${opts.spotsTotal}`,
    ``,
    `<i>Join now before it fills again.</i>`,
  ]);
}

/**
 * High-visibility reschedule alert — deliberately louder than invite/reminder
 * DMs so players don't skim past it in the chat list.
 */
export function timeChangedMessage(opts: {
  venueName: string;
  venueAddress?: string | null;
  oldStartAt: Date;
  newStartAt: Date;
  locale?: string;
}): string {
  const oldWhen = formatGameWhen(opts.oldStartAt, opts.locale);
  const newWhen = formatGameWhen(opts.newStartAt, opts.locale);
  return card([
    `⚡️⚡️⚡️`,
    `<b>⏰ GAME TIME CHANGED</b>`,
    `⚡️⚡️⚡️`,
    ``,
    `⚠️ <b>The host moved this game — check the new time!</b>`,
    ``,
    placeLine(opts.venueName, opts.venueAddress),
    ``,
    `❌ <b>Was:</b> <s>${esc(oldWhen)}</s>`,
    `✅ <b>Now:</b> <u>${esc(newWhen)}</u>`,
    ``,
    `━━━━━━━━━━━━`,
    `<i>Open the app if you can’t make the new time.</i>`,
  ]);
}

export type GameSettingChange =
  | { field: 'time'; oldStartAt: Date; newStartAt: Date }
  | { field: 'end'; oldEndAt: Date; newEndAt: Date }
  | { field: 'place'; from: string; to: string }
  | { field: 'playType'; from: string; to: string }
  | { field: 'level'; from: number; to: number }
  | { field: 'spots'; from: number; to: number }
  | { field: 'price'; from: string; to: string }
  | { field: 'notes' }
  | { field: 'hint' }
  | { field: 'closed'; closed: boolean }
  | { field: 'paid'; paid: boolean };

const PLAY_TYPE_LABEL: Record<string, Record<string, string>> = {
  en: { INDOOR: 'Indoor', OUTDOOR: 'Outdoor', BEACH: 'Beach' },
  pl: { INDOOR: 'W hali', OUTDOOR: 'Na zewnątrz', BEACH: 'Na plaży' },
  ru: { INDOOR: 'В зале', OUTDOOR: 'На улице', BEACH: 'На пляже' },
  uk: { INDOOR: 'У залі', OUTDOOR: 'Надворі', BEACH: 'На пляжі' },
};

function langOf(locale?: string): 'en' | 'pl' | 'ru' | 'uk' {
  const code = (locale ?? 'en').slice(0, 2);
  if (code === 'pl' || code === 'ru' || code === 'uk') return code;
  return 'en';
}

/**
 * Host edited lobby settings. One message lists every change so players
 * are not pinged once per field.
 */
export function gameSettingsChangedMessage(opts: {
  venueName: string;
  venueAddress?: string | null;
  startAt: Date;
  changes: GameSettingChange[];
  locale?: string;
}): string {
  const lang = langOf(opts.locale);
  const when = formatGameWhen(opts.startAt, opts.locale);
  const copy = {
    en: {
      title: '✏️ <b>Game updated</b>',
      intro: 'The host changed this game.',
      time: 'Time',
      end: 'End',
      place: 'Place',
      court: 'Court',
      level: 'Level',
      spots: 'Spots',
      price: 'Price',
      notes: 'Notes were updated',
      hint: 'The address note was updated',
      closedOn: 'Joining now needs the host’s approval',
      closedOff: 'The lobby is open again',
      paidOn: 'Marked as already paid',
      paidOff: 'Marked as not paid',
      footer: 'Open the app to see the new details.',
    },
    pl: {
      title: '✏️ <b>Mecz został zmieniony</b>',
      intro: 'Organizator zmienił tę grę.',
      time: 'Czas',
      end: 'Koniec',
      place: 'Miejsce',
      court: 'Boisko',
      level: 'Poziom',
      spots: 'Miejsca',
      price: 'Cena',
      notes: 'Notatka została zmieniona',
      hint: 'Dopisek do adresu został zmieniony',
      closedOn: 'Dołączenie wymaga teraz zgody organizatora',
      closedOff: 'Lobby jest znowu otwarte',
      paidOn: 'Oznaczono jako opłacone',
      paidOff: 'Oznaczono jako nieopłacone',
      footer: 'Otwórz aplikację, żeby zobaczyć szczegóły.',
    },
    ru: {
      title: '✏️ <b>Игра изменена</b>',
      intro: 'Организатор изменил эту игру.',
      time: 'Время',
      end: 'Конец',
      place: 'Место',
      court: 'Площадка',
      level: 'Уровень',
      spots: 'Места',
      price: 'Цена',
      notes: 'Заметка изменена',
      hint: 'Уточнение адреса изменено',
      closedOn: 'Теперь вход только с одобрения организатора',
      closedOff: 'Лобби снова открыто',
      paidOn: 'Отмечено как оплаченное',
      paidOff: 'Отмечено как не оплаченное',
      footer: 'Открой приложение, чтобы увидеть детали.',
    },
    uk: {
      title: '✏️ <b>Гру змінено</b>',
      intro: 'Організатор змінив цю гру.',
      time: 'Час',
      end: 'Кінець',
      place: 'Місце',
      court: 'Майданчик',
      level: 'Рівень',
      spots: 'Місця',
      price: 'Ціна',
      notes: 'Нотатку змінено',
      hint: 'Уточнення адреси змінено',
      closedOn: 'Тепер вхід лише з дозволу організатора',
      closedOff: 'Лобі знову відкрите',
      paidOn: 'Позначено як оплачене',
      paidOff: 'Позначено як не оплачене',
      footer: 'Відкрий додаток, щоб побачити деталі.',
    },
  }[lang];

  const play = PLAY_TYPE_LABEL[lang];
  const bullets = opts.changes.map((c) => {
    switch (c.field) {
      case 'time':
        return `• <b>${copy.time}:</b> <s>${esc(formatGameWhen(c.oldStartAt, opts.locale))}</s> → <b>${esc(formatGameWhen(c.newStartAt, opts.locale))}</b>`;
      case 'end':
        return `• <b>${copy.end}:</b> <s>${esc(formatGameWhen(c.oldEndAt, opts.locale))}</s> → <b>${esc(formatGameWhen(c.newEndAt, opts.locale))}</b>`;
      case 'place':
        return `• <b>${copy.place}:</b> ${esc(c.from)} → <b>${esc(c.to)}</b>`;
      case 'playType':
        return `• <b>${copy.court}:</b> ${esc(play[c.from] ?? c.from)} → <b>${esc(play[c.to] ?? c.to)}</b>`;
      case 'level':
        return `• <b>${copy.level}:</b> ${c.from} → <b>${c.to}</b>`;
      case 'spots':
        return `• <b>${copy.spots}:</b> ${c.from} → <b>${c.to}</b>`;
      case 'price':
        return `• <b>${copy.price}:</b> ${esc(c.from)} → <b>${esc(c.to)}</b>`;
      case 'notes':
        return `• ${copy.notes}`;
      case 'hint':
        return `• ${copy.hint}`;
      case 'closed':
        return `• ${c.closed ? copy.closedOn : copy.closedOff}`;
      case 'paid':
        return `• ${c.paid ? copy.paidOn : copy.paidOff}`;
    }
  });

  return card([
    copy.title,
    copy.intro,
    ``,
    placeLine(opts.venueName, opts.venueAddress),
    `🗓 ${esc(when)}`,
    ``,
    ...bullets,
    ``,
    `<i>${copy.footer}</i>`,
  ]);
}

export function botAlertsEnabledMessage(locale?: string): string {
  const lang = langOf(locale);
  const line =
    lang === 'uk'
      ? 'Тепер повідомлення про ігри приходитимуть у цей чат.'
      : lang === 'ru'
        ? 'Теперь сообщения об играх будут приходить в этот чат.'
        : lang === 'pl'
          ? 'Powiadomienia o meczach będą przychodzić na ten czat.'
          : 'Game alerts will arrive in this chat.';
  return card([`🏐 <b>VolleyBot</b>`, ``, line]);
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
