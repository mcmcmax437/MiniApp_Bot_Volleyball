import { createContext, useContext, useEffect, useState } from 'react';

interface TelegramContextValue {
  initData: string;
  user: TelegramUser | null;
  colorScheme: 'light' | 'dark';
  ready: boolean;
  webApp: TelegramWebApp | null;
  photoUrl: string | null;
}

const TelegramContext = createContext<TelegramContextValue>({
  initData: '',
  user: null,
  colorScheme: 'dark',
  ready: false,
  webApp: null,
  photoUrl: null,
});

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe?: { user?: TelegramUser };
  colorScheme: 'light' | 'dark';
  ready: () => void;
  expand: () => void;
  close: () => void;
  viewportHeight?: number;
  viewportStableHeight?: number;
  isExpanded?: boolean;
  onEvent?: (event: string, handler: () => void) => void;
  offEvent?: (event: string, handler: () => void) => void;
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [initData, setInitData] = useState('');
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('dark');
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    const tg = window.Telegram?.WebApp ?? null;

    // ---- Keyboard detection -----------------------------------------------
    // Telegram's viewport events are unreliable across clients and OS versions,
    // so we use *two* signals: the Telegram event (preferred) and a focus-based
    // fallback that watches the document for focused form fields. The CSS
    // `body.keyboard-open .bottom-nav { display: none }` rule hides the nav.
    const setKeyboardOpen = (open: boolean) => {
      document.body.classList.toggle('keyboard-open', open);
    };

    if (tg) {
      setInitData(tg.initData ?? '');
      const u = tg.initDataUnsafe?.user ?? null;
      setUser(u);
      setPhotoUrl(u?.photo_url ?? null);
      setColorScheme(tg.colorScheme);
      setWebApp(tg);
      tg.ready();
      tg.expand();

      const KEYBOARD_THRESHOLD = 200;
      const updateKeyboard = () => {
        const stable = tg.viewportStableHeight ?? tg.viewportHeight ?? 0;
        const full = tg.viewportHeight ?? 0;
        const keyboardOpen =
          stable > 0 && full > 0 && full - stable > KEYBOARD_THRESHOLD;
        setKeyboardOpen(keyboardOpen);
      };
      tg.onEvent?.('viewportChanged', updateKeyboard);
      tg.onEvent?.('contentSafeAreaChanged', updateKeyboard);
      updateKeyboard();
    }

    // Fallback: any focused <input>/<textarea>/[contenteditable] is treated as
    // "keyboard open". We add a small grace period on blur so taps on a
    // submit button right after typing don't flash the nav back in.
    let blurTimer: number | undefined;
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const tag = t.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        t.isContentEditable
      ) {
        if (blurTimer) {
          window.clearTimeout(blurTimer);
          blurTimer = undefined;
        }
        setKeyboardOpen(true);
      }
    };
    const onFocusOut = () => {
      if (blurTimer) window.clearTimeout(blurTimer);
      blurTimer = window.setTimeout(() => {
        const active = document.activeElement as HTMLElement | null;
        const stillTyping =
          active &&
          (active.tagName === 'INPUT' ||
            active.tagName === 'TEXTAREA' ||
            active.tagName === 'SELECT' ||
            active.isContentEditable);
        if (!stillTyping) setKeyboardOpen(false);
      }, 120);
    };
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);

    setReady(true);

    return () => {
      tg?.offEvent?.('viewportChanged', () => undefined);
      tg?.offEvent?.('contentSafeAreaChanged', () => undefined);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      if (blurTimer) window.clearTimeout(blurTimer);
      setKeyboardOpen(false);
    };
  }, []);

  return (
    <TelegramContext.Provider value={{ initData, user, colorScheme, ready, webApp, photoUrl }}>
      {children}
    </TelegramContext.Provider>
  );
}

export function useTelegram() {
  return useContext(TelegramContext);
}