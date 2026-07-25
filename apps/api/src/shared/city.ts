/**
 * City matching helpers.
 *
 * Create Game / Home list by city string, but reverse-geocode + profile edits
 * often produce aliases of the same place (e.g. "Poznań" vs "Познань"). Exact
 * equality then hides venues/games. We canonicalize on write and expand on read.
 */

const ALIAS_GROUPS: string[][] = [
  ['Poznań', 'Poznan', 'Познань', 'познань', 'POZNAŃ'],
  ['Kyiv', 'Київ', 'Kiev', 'Киев', 'київ', 'киев'],
  ['Warsaw', 'Warszawa', 'Варшава', 'варшава'],
];

/** Fold for comparison: trim, lower-case, strip diacritics. */
export function foldCity(city: string): string {
  return city
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function aliasGroupFor(city: string): string[] | null {
  const f = foldCity(city);
  if (!f) return null;
  return ALIAS_GROUPS.find((g) => g.some((a) => foldCity(a) === f)) ?? null;
}

/**
 * Prefer DEFAULT_CITY spelling when the given city is an alias of it;
 * otherwise return trimmed input (or the group's first label if known).
 */
export function canonicalizeCity(city: string, defaultCity?: string | null): string {
  const trimmed = city.trim();
  if (!trimmed) return defaultCity?.trim() || trimmed;

  const group = aliasGroupFor(trimmed);
  if (!group) return trimmed;

  const def = defaultCity?.trim();
  if (def && group.some((a) => foldCity(a) === foldCity(def))) {
    return def;
  }
  return group[0];
}

/** All spellings that should match a city filter (for Prisma `in` / JS includes). */
export function expandCityFilter(city: string, defaultCity?: string | null): string[] {
  const trimmed = city.trim();
  if (!trimmed) return [];

  const out = new Set<string>([trimmed]);
  const group = aliasGroupFor(trimmed);
  if (group) {
    for (const a of group) out.add(a);
  }

  const def = defaultCity?.trim();
  if (def && group && group.some((a) => foldCity(a) === foldCity(def))) {
    out.add(def);
  }

  return [...out];
}

export function citiesMatch(a: string, b: string): boolean {
  if (foldCity(a) === foldCity(b)) return true;
  const ga = aliasGroupFor(a);
  const gb = aliasGroupFor(b);
  return !!ga && ga === gb;
}
