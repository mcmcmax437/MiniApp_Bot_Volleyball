import { createContext, useContext, useEffect, useState } from 'react';

interface TelegramContextValue {
  initData: string;
  user: TelegramUser | null;
  colorScheme: 'light' | 'dark';
  ready: boolean;
}

const TelegramContext = createContext<TelegramContextValue>({
  initData: '',
  user: null,
  colorScheme: 'dark',
  ready: false,
});

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe?: { user?: TelegramUser };
        colorScheme: 'light' | 'dark';
        ready: () => void;
        expand: () => void;
        close: () => void;
      };
    };
  }
}

export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [initData, setInitData] = useState('');
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      setInitData(tg.initData ?? '');
      setUser(tg.initDataUnsafe?.user ?? null);
      setColorScheme(tg.colorScheme);
      tg.ready();
      tg.expand();
    }
    setReady(true);
  }, []);

  return (
    <TelegramContext.Provider value={{ initData, user, colorScheme, ready }}>
      {children}
    </TelegramContext.Provider>
  );
}

export function useTelegram() {
  return useContext(TelegramContext);
}
