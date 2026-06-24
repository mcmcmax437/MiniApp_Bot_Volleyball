import { useTelegram } from './tg';

export interface ApiUser {
  id: string;
  telegramId: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  age: number | null;
  skillLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'PRO' | null;
  city: string;
  lat: number | null;
  lng: number | null;
  reminderOffsets: number[];
}

export interface ApiVenue {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  indoor: boolean;
  surface: string | null;
  hourlyPrice: number;
  capacity: number;
  city: string;
}

export interface ApiGame {
  id: string;
  venueId: string;
  hostId: string;
  startAt: string;
  endAt: string;
  skillLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'PRO';
  spotsTotal: number;
  notes: string | null;
  totalCost: number;
  status: 'OPEN' | 'FULL' | 'CANCELLED' | 'FINISHED';
  venue: Pick<ApiVenue, 'id' | 'name' | 'address' | 'lat' | 'lng' | 'indoor' | 'city'>;
  host: { id: string; firstName: string; username: string | null; skillLevel: string | null };
  participantsCount: number;
  perPlayerCost: number;
}

export interface ApiGameDetail extends ApiGame {
  participants: Array<{
    id: string;
    userId: string;
    user: { id: string; firstName: string; lastName: string | null; username: string | null };
    joinedAt: string;
  }>;
}

export interface CreateGamePayload {
  venueId: string;
  startAt: string;
  endAt: string;
  skillLevel: ApiGame['skillLevel'];
  spotsTotal: number;
  totalCost: number;
  notes?: string;
}

export interface CreateVenuePayload {
  name: string;
  address: string;
  lat: number;
  lng: number;
  indoor?: boolean;
  surface?: string;
  hourlyPrice: number;
  capacity: number;
  city?: string;
}

// In production nginx proxies /api/* to the NestJS API on port 3000, so the
// build only needs the relative path. Set VITE_API_BASE in .env to override
// (e.g. http://localhost:3000/api/v1 for a local dev backend on a different port).
const BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api/v1';

async function http<T>(path: string, init: RequestInit, initData: string): Promise<T> {
  const url = new URL(`${BASE}${path}`, window.location.origin);
  const res = await fetch(url.toString(), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(initData ? { 'X-Telegram-InitData': initData } : {}),
      ...(init.headers ?? {}),
    },
    credentials: 'include',
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const j = await res.json();
      if (j?.message) msg = Array.isArray(j.message) ? j.message.join(', ') : String(j.message);
    } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function useApi() {
  const { initData } = useTelegram();
  return {
    login: (init: string) =>
      http<{ user: ApiUser; token: string }>(
        '/auth/telegram',
        { method: 'POST', body: JSON.stringify({ initData: init }) },
        init,
      ),
    me: () => http<ApiUser | null>('/auth/me', { method: 'GET' }, initData),
    updateMe: (patch: Partial<ApiUser>) =>
      http<ApiUser>('/me', { method: 'PATCH', body: JSON.stringify(patch) }, initData),

    listVenues: (q: { city?: string } = {}) => {
      const params = new URLSearchParams();
      if (q.city) params.set('city', q.city);
      const qs = params.toString();
      return http<ApiVenue[]>(`/venues${qs ? `?${qs}` : ''}`, { method: 'GET' }, initData);
    },
    createVenue: (payload: CreateVenuePayload) =>
      http<ApiVenue>('/venues', { method: 'POST', body: JSON.stringify(payload) }, initData),

    listGames: (q: { city?: string; skillLevel?: string } = {}) => {
      const params = new URLSearchParams();
      if (q.city) params.set('city', q.city);
      if (q.skillLevel) params.set('skillLevel', q.skillLevel);
      const qs = params.toString();
      return http<ApiGame[]>(`/games${qs ? `?${qs}` : ''}`, { method: 'GET' }, initData);
    },
    getGame: (id: string) => http<ApiGameDetail>(`/games/${id}`, { method: 'GET' }, initData),
    createGame: (payload: CreateGamePayload) =>
      http<ApiGameDetail>('/games', { method: 'POST', body: JSON.stringify(payload) }, initData),
    joinGame: (id: string) =>
      http<ApiGameDetail>(`/games/${id}/join`, { method: 'POST' }, initData),
    leaveGame: (id: string) =>
      http<ApiGameDetail>(`/games/${id}/leave`, { method: 'POST' }, initData),
    cancelGame: (id: string) =>
      http<ApiGameDetail>(`/games/${id}/cancel`, { method: 'POST' }, initData),

    defaultCity: () =>
      http<{ city: string | null; lat: number | null; lng: number | null }>(
        '/venues/default-city',
        { method: 'GET' },
        initData,
      ),
  };
}
