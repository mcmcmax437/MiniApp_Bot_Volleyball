/**
 * Tiny dependency-free i18n. We deliberately avoid pulling in i18next because:
 *   1. The mini-app's surface area for strings is small (a few hundred keys).
 *   2. Adding a dep requires a re-install on the VPS via the deploy script.
 *   3. We need a static fallback chain (uk → en) so an untranslated key
 *      doesn't blow up the UI.
 *
 * Translations live in `i18n/strings.ts`. Add a new key by adding it to
 * the `en` (canonical) map and any other locales that need it.
 */
import { useEffect, useMemo, useState } from 'react';
import type { Language } from './api';

import { en } from './i18n/en';
import { uk } from './i18n/uk';
import { pl } from './i18n/pl';
import { ru } from './i18n/ru';

const STORAGE_KEY = 'volley:lang:v1';

export const SUPPORTED_LANGUAGES: Language[] = ['uk', 'pl', 'en', 'ru'];

export const LANG_LABELS: Record<Language, string> = {
  uk: 'Українська',
  pl: 'Polski',
  en: 'English',
  ru: 'Русский',
};

export const LANG_FLAGS: Record<Language, string> = {
  uk: '🇺🇦',
  pl: '🇵🇱',
  en: '🇬🇧',
  ru: '🇷🇺',
};

type Catalog = Record<string, string>;

const CATALOGS: Record<Language, Catalog> = { en, uk, pl, ru };

function resolve(lang: Language, key: string): string {
  const chain: Language[] = [lang];
  if (lang !== 'en') chain.push('en'); // fallback to English
  for (const l of chain) {
    const v = CATALOGS[l][key];
    if (v) return v;
  }
  return key;
}

// Locale detection order: stored choice → Telegram WebApp `language_code` →
// default to English (the canonical language of the app).
function detectInitialLang(): Language {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY) as Language | null;
    if (stored && SUPPORTED_LANGUAGES.includes(stored)) return stored;
  }
  if (typeof window !== 'undefined') {
    const tg = (window as any).Telegram?.WebApp;
    const code = (tg?.initDataUnsafe?.user?.language_code as string | undefined) ?? navigator.language;
    if (code) {
      const short = code.split('-')[0].toLowerCase();
      if (SUPPORTED_LANGUAGES.includes(short as Language)) return short as Language;
    }
  }
  return 'en';
}

let currentLang: Language = 'en';
const subscribers = new Set<(l: Language) => void>();

export function getLang(): Language {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY) as Language | null;
    if (stored && SUPPORTED_LANGUAGES.includes(stored)) return stored;
  }
  return detectInitialLang();
}

export function setLang(l: Language) {
  currentLang = l;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, l);
  }
  subscribers.forEach((cb) => cb(l));
}

/**
 * Hook that subscribes the component to locale changes and re-renders.
 * The returned `t` function substitutes `{var}` placeholders.
 */
export function useI18n() {
  const [lang, setLangState] = useState<Language>(() => getLang());
  useEffect(() => {
    const cb = (l: Language) => setLangState(l);
    subscribers.add(cb);
    return () => {
      subscribers.delete(cb);
    };
  }, []);

  const t = useMemo(() => {
    return (key: string, vars?: Record<string, string | number>) => {
      const template = resolve(lang, key);
      if (!vars) return template;
      return template.replace(/\{(\w+)\}/g, (_, name) =>
        name in vars ? String(vars[name]) : `{${name}}`,
      );
    };
  }, [lang]);

  return { lang, setLang, t };
}

/**
 * Imperative translation (e.g. for things that happen outside React render
 * cycles, like analytics event names).
 */
export function t(key: string, vars?: Record<string, string | number>): string {
  const template = resolve(getLang(), key);
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name) =>
    name in vars ? String(vars[name]) : `{${name}}`,
  );
}