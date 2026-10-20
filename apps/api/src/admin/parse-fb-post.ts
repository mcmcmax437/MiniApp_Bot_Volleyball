/**
 * Turns a free-form volleyball post (usually Polish, written by hand)
 * into the board fields. Posts are not a fixed template.
 *
 * "komplet" / "komplekt" / "full" marks the game as full.
 * "przy komplecie" is a price note (cost once the roster fills), not a full game.
 */

export type FbOfferStatus = 'OPEN' | 'FULL';

export interface ParsedFbPost {
  status: FbOfferStatus;
  /** Start of the game in UTC, when a calendar day could be read. */
  gameDate: string | null;
  /** What to show in the Date row, e.g. "20.10.2026, 20:00–21:30". */
  whenLabel: string | null;
  gameLevel: string | null;
  /** "0" when the post says the game is full. */
  freePlaces: string | null;
  address: string | null;
  link: string | null;
}

const TZ = 'Europe/Warsaw';

const WEEKDAY: Record<string, number> = {
  niedziela: 0,
  poniedzialek: 1,
  wtorek: 2,
  sroda: 3,
  czwartek: 4,
  piatek: 5,
  sobota: 6,
};

function fold(s: string): string {
  return s
    .toLowerCase()
    .replace(/ą/g, 'a')
    .replace(/ć/g, 'c')
    .replace(/ę/g, 'e')
    .replace(/ł/g, 'l')
    .replace(/ń/g, 'n')
    .replace(/ó/g, 'o')
    .replace(/ś/g, 's')
    .replace(/ź/g, 'z')
    .replace(/ż/g, 'z')
    .replace(/\bsobote\b/g, 'sobota')
    .replace(/\bniedziele\b/g, 'niedziela')
    .replace(/\bsrode\b/g, 'sroda');
}

function warsawParts(date: Date) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  const hour = map.hour === '24' ? '00' : map.hour;
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(map.weekday);
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(hour),
    minute: Number(map.minute),
    weekday: weekday < 0 ? 0 : weekday,
  };
}

function wallToUtc(year: number, month: number, day: number, hour: number, minute: number): Date {
  let utcMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 4; i++) {
    const p = warsawParts(new Date(utcMs));
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0);
    const wanted = Date.UTC(year, month - 1, day, hour, minute, 0);
    utcMs += wanted - asUtc;
  }
  return new Date(utcMs);
}

function addDays(year: number, month: number, day: number, days: number) {
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export function isGameFull(raw: string): boolean {
  const folded = fold(raw)
    .replace(/przy\s+komplek?cie/g, ' ')
    .replace(/\b(w|po|na|do)\s+komplek?cie\b/g, ' ');
  if (/\bedit\s*[:\-]?\s*(komplek?t(?!ie)|full|pelny|pelne|brak miejsc)\b/.test(folded)) return true;
  if (/[\(\[]\s*(komplek?t(?!ie)|full)\s*[\)\]]/.test(folded)) return true;
  if (/(^|[\s,.;:!\n])(komplek?t(?!ie)|full)(?=$|[\s,.;:!\n\)])/.test(folded)) return true;
  return false;
}

function extractLevel(folded: string): string | null {
  const m = folded.match(/\bpoz(?:iom)?\.?(?:\s+min\.?)?\s+(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const prefix = /poz(?:iom)?\.?\s+min/.test(folded) ? 'min ' : '';
  return `${prefix}${m[1]}`;
}

function extractFreePlaces(folded: string, full: boolean): string | null {
  if (full) return '0';
  const direct = folded.match(/(\d+)\s+woln\w*\s+miejs/);
  if (direct) return direct[1];
  const flipped = folded.match(/(\d+)\s+miejs\w*\s+woln/);
  if (flipped) return flipped[1];
  const left = folded.match(/zostal\w*\s+(\d+)\s+miejs/);
  return left ? left[1] : null;
}

function extractAddress(raw: string): string | null {
  const m = raw.match(/\b((?:hala|sala|os\.?|ul\.?|uam)\s+[^,\n|]{2,80})/i);
  if (!m) return null;
  return m[1]
    .replace(/\s+/g, ' ')
    .replace(/\s+(poziom|poz\.?|godzina|koszt|cena)\b.*$/i, '')
    .replace(/\s*[\(\[]\s*(komplet|komplekt|full)\s*[\)\]]\s*$/i, '')
    .trim();
}

function extractLink(raw: string): string | null {
  const urls = raw.match(/https?:\/\/[^\s)]+/gi) ?? [];
  const fb = urls.find((u) => /facebook\.com/i.test(u));
  return (fb ?? urls[0] ?? '').replace(/[.,]+$/, '') || null;
}

function extractWhen(raw: string, now: Date): { gameDate: string | null; whenLabel: string | null } {
  const folded = fold(raw);
  let rest = raw;
  let startH: number | undefined;
  let startM = 0;
  let endH: number | undefined;
  let endM: number | undefined;

  const clockRange = rest.match(
    /(\d{1,2})[:.](\d{2})\s*(?:-|–|do)\s*(\d{1,2})[:.](\d{2})/i,
  );
  const compact = rest.match(/(\d{1,2})\s*-\s*(\d{1,2})[:.](\d{2})/);
  const godzina = rest.match(
    /godzina\s+(\d{1,2})[:.](\d{2})(?:\s*(?:-|–|do)\s*(\d{1,2})[:.](\d{2}))?/i,
  );
  const hourSpan = rest.match(/\b([01]?\d|2[0-3])\s*-\s*([01]?\d|2[0-3])\b/);

  if (clockRange) {
    startH = Number(clockRange[1]);
    startM = Number(clockRange[2]);
    endH = Number(clockRange[3]);
    endM = Number(clockRange[4]);
    rest = rest.replace(clockRange[0], ' ');
  } else if (compact && Number(compact[1]) >= 8 && Number(compact[1]) <= 23) {
    startH = Number(compact[1]);
    startM = 0;
    endH = Number(compact[2]);
    endM = Number(compact[3]);
    rest = rest.replace(compact[0], ' ');
  } else if (godzina) {
    startH = Number(godzina[1]);
    startM = Number(godzina[2]);
    if (godzina[3]) {
      endH = Number(godzina[3]);
      endM = Number(godzina[4]);
    }
    rest = rest.replace(godzina[0], ' ');
  } else if (hourSpan) {
    const a = Number(hourSpan[1]);
    const b = Number(hourSpan[2]);
    if (a >= 8 && a <= 23 && b >= 8 && b <= 23 && b > a) {
      startH = a;
      endH = b;
      endM = 0;
      rest = rest.replace(hourSpan[0], ' ');
    }
  }

  const today = warsawParts(now);
  let year = today.year;
  let month = today.month;
  let day = today.day;
  let foundDay = false;

  const numeric = findCalendarDate(rest);
  if (numeric) {
    day = numeric.day;
    month = numeric.month;
    if (numeric.year != null) year = numeric.year;
    foundDay = true;
  } else if (/\bjutro\b/.test(folded)) {
    const next = addDays(today.year, today.month, today.day, 1);
    year = next.year;
    month = next.month;
    day = next.day;
    foundDay = true;
  } else if (/\b(dzis|dzisiaj)\b/.test(folded)) {
    foundDay = true;
  } else {
    const wd = folded.match(/\b(niedziela|poniedzialek|wtorek|sroda|czwartek|piatek|sobota)\b/);
    if (wd && WEEKDAY[wd[1]] != null) {
      let delta = (WEEKDAY[wd[1]] - today.weekday + 7) % 7;
      const next = addDays(today.year, today.month, today.day, delta);
      year = next.year;
      month = next.month;
      day = next.day;
      foundDay = true;
    }
  }

  if (!foundDay && startH == null) return { gameDate: null, whenLabel: null };

  if (foundDay && !numericYear(rest) ) {
    const guessed = wallToUtc(year, month, day, 12, 0).getTime();
    if (now.getTime() - guessed > 200 * 24 * 3600_000) year += 1;
  }

  const hh = (n: number) => String(n).padStart(2, '0');
  const dateBit = foundDay ? `${hh(day)}.${hh(month)}.${year}` : '';
  let timeBit = '';
  if (startH != null) {
    timeBit = `${hh(startH)}:${hh(startM)}`;
    if (endH != null) timeBit += `–${hh(endH)}:${hh(endM ?? 0)}`;
  }
  const whenLabel = [dateBit, timeBit].filter(Boolean).join(', ') || null;
  const gameDate = foundDay
    ? wallToUtc(year, month, day, startH ?? 0, startM).toISOString()
    : null;
  return { gameDate, whenLabel };
}

function numericYear(rest: string): boolean {
  return findCalendarDate(rest)?.year != null;
}

/**
 * Polish posts write dates as 20.10 and levels/prices as 3,5 or 8.5.
 * A one-digit fraction is not a month. An invalid month (2,20) is skipped
 * so a later 20.10 still wins.
 */
function findCalendarDate(rest: string): { day: number; month: number; year: number | null } | null {
  const re = /\b(\d{1,2})([./])(\d{1,2})(?:[./](\d{2,4}))?\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rest))) {
    const day = Number(m[1]);
    const sep = m[2];
    const month = Number(m[3]);
    const monthRaw = m[3];
    if (day < 1 || day > 31 || month < 1 || month > 12) continue;
    if (!m[4] && sep === ',' ) continue;
    if (!m[4] && monthRaw.length < 2) continue;
    const after = rest.slice(m.index + m[0].length, m.index + m[0].length + 4);
    if (/^\s*z[lł]/i.test(after)) continue;
    const before = rest.slice(Math.max(0, m.index - 12), m.index);
    if (/poz(?:iom)?\.?\s*$/i.test(before) || /siatk\w*\s*$/i.test(before)) continue;
    const year = m[4] ? (Number(m[4]) < 100 ? 2000 + Number(m[4]) : Number(m[4])) : null;
    return { day, month, year };
  }
  return null;
}

export function parseFbPost(raw: string, now = new Date()): ParsedFbPost {
  const text = raw.replace(/\r/g, '').trim();
  const folded = fold(text);
  const full = isGameFull(text);
  const when = extractWhen(text, now);
  return {
    status: full ? 'FULL' : 'OPEN',
    gameDate: when.gameDate,
    whenLabel: when.whenLabel,
    gameLevel: extractLevel(folded),
    freePlaces: extractFreePlaces(folded, full),
    address: extractAddress(text),
    link: extractLink(text),
  };
}

/** One post, or several posts split by a line that is only `---`. */
export function splitFbPosts(raw: string): string[] {
  return raw
    .replace(/\r/g, '')
    .split(/\n\s*---\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 12);
}
