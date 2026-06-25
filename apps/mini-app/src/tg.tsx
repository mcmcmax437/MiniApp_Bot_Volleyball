import { createContext, useContext, useEffect, useState } from 'react';

interface TelegramContextValue {
  initData: string;
  user: TelegramUser | null;
  colorScheme: 'light' | 'dark';
  ready: boolean;
  webApp: TelegramWebApp | null;
}

const TelegramContext = createContext<TelegramContextValue>({
  initData: '',
  user: null,
  colorScheme: 'dark',
  ready: false,
  webApp: null,
});

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe?: { user?: TelegramUser };
  colorScheme: 'light' | 'dark';
  ready: () => void;
  expand: () => void;
  close: () => void;
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

  useEffect(() => {
    const tg = window.Telegram?.WebApp ?? null;
    if (tg) {
      setInitData(tg.initData ?? '');
      setUser(tg.initDataUnsafe?.user ?? null);
      setColorScheme(tg.colorScheme);
      setWebApp(tg);
      tg.ready();
      tg.expand();
    }
    setReady(true);
  }, []);

  return (
    <TelegramContext.Provider value={{ initData, user, colorScheme, ready, webApp }}>
      {children}
    </TelegramContext.Provider>
  );
}

export function useTelegram() {
  return useContext(TelegramContext);
}