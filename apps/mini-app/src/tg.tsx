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
    if (tg) {
      setInitData(tg.initData ?? '');
      const u = tg.initDataUnsafe?.user ?? null;
      setUser(u);
      setPhotoUrl(u?.photo_url ?? null);
      setColorScheme(tg.colorScheme);
      setWebApp(tg);
      tg.ready();
      tg.expand();

      // Detect the on-screen keyboard so we can hide the bottom nav while
      // the user is typing and stop the form from being obscured.
      // Telegram shrinks `viewportStableHeight` when the keyboard is up.
      const KEYBOARD_THRESHOLD = 300; // px — empirically enough on iOS/Android
      const updateKeyboard = () => {
        const stable = tg.viewportStableHeight ?? tg.viewportHeight ?? 0;
        const full = tg.viewportHeight ?? 0;
        const keyboardOpen =
          stable > 0 && full > 0 && full - stable > KEYBOARD_THRESHOLD;
        document.body.classList.toggle('keyboard-open', keyboardOpen);
      };
      tg.onEvent?.('viewportChanged', updateKeyboard);
      tg.onEvent?.('contentSafeAreaChanged', updateKeyboard);
      updateKeyboard();

      setReady(true);

      return () => {
        tg.offEvent?.('viewportChanged', updateKeyboard);
        tg.offEvent?.('contentSafeAreaChanged', updateKeyboard);
        document.body.classList.remove('keyboard-open');
      };
    }
    setReady(true);
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