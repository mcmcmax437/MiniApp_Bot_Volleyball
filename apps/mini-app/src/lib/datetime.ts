/**
 * Game times are wall-clock in the app timezone (same as the bot's
 * APP_TIMEZONE). Phone TZ must not shift what "15:00 at the court" means.
 */

let appTimeZone = 'Europe/Warsaw';

export function setAppTimeZone(tz: string | null | undefined) {
  const next = (tz ?? '').trim();
  if (next) appTimeZone = next;
}

export function getAppTimeZone(): string {
  return appTimeZone;
}

const LOCALE_TAG: Record<string, string> = {
  uk: 'uk-UA',
  pl: 'pl-PL',
  en: 'en-GB',
  ru: 'ru-RU',
};

export function localeTag(lang?: string | null): string | undefined {
  if (!lang) return undefined;
  return LOCALE_TAG[lang] ?? lang;
}

function partsInZone(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  // en-GB may emit hour "24" for midnight — normalize.
  const hour = map.hour === '24' ? '00' : map.hour;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(hour),
    minute: Number(map.minute),
    second: Number(map.second ?? '0'),
  };
}

/**
 * Interpret `YYYY-MM-DDTHH:mm` as wall time in the app timezone → UTC ISO.
 * Used by Create Game so picking 16:00 means 16:00 at the venue, not on the phone.
 */
export function wallClockToUtcIso(
  wall: string,
  timeZone: string = appTimeZone,
): string {
  const m = wall.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (!m) return new Date(wall).toISOString();
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = Number(m[6] ?? '0');

  // Iterate: adjust a UTC guess until formatting in `timeZone` matches wall.
  let utcMs = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let i = 0; i < 4; i++) {
    const p = partsInZone(new Date(utcMs), timeZone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const wanted = Date.UTC(year, month - 1, day, hour, minute, second);
    const delta = wanted - asUtc;
    if (delta === 0) break;
    utcMs += delta;
  }
  return new Date(utcMs).toISOString();
}

/** Format a UTC instant as `YYYY-MM-DDTHH:mm` for `<input type="datetime-local">`. */
export function utcIsoToWallClock(
  iso: string | Date,
  timeZone: string = appTimeZone,
): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const p = partsInZone(d, timeZone);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Default create-game start: +24h, snapped to the hour, in app timezone. */
export function defaultWallStartAt(timeZone: string = appTimeZone): string {
  const d = new Date(Date.now() + 24 * 3600_000);
  d.setUTCMinutes(0, 0, 0);
  // Snap using zone parts then rebuild.
  const wall = utcIsoToWallClock(d, timeZone);
  const [datePart, timePart] = wall.split('T');
  const [hh] = timePart.split(':');
  return `${datePart}T${hh}:00`;
}

export function formatGameDateTime(
  iso: string | Date,
  opts: { locale?: string | null; timeZone?: string } = {},
): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const timeZone = opts.timeZone ?? appTimeZone;
  const locale = localeTag(opts.locale) || undefined;
  return d.toLocaleString(locale, {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatGameTimeOnly(
  iso: string | Date,
  opts: { locale?: string | null; timeZone?: string } = {},
): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const timeZone = opts.timeZone ?? appTimeZone;
  const locale = localeTag(opts.locale) || undefined;
  return d.toLocaleTimeString(locale, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatGameDayKey(
  iso: string | Date,
  timeZone: string = appTimeZone,
): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const p = partsInZone(d, timeZone);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Calendar day header from a YYYY-MM-DD key interpreted in app TZ noon. */
export function dateFromDayKey(dayKey: string, timeZone: string = appTimeZone): Date {
  // Noon wall-clock avoids DST edges when building a Date for labels.
  return new Date(wallClockToUtcIso(`${dayKey}T12:00`, timeZone));
}
