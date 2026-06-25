import { useTelegram } from './tg';

export type SkillLevel =
  | 'LEVEL_1'
  | 'LEVEL_2'
  | 'LEVEL_3'
  | 'LEVEL_4'
  | 'LEVEL_5'
  | 'LEVEL_6';

export type UserRole = 'USER' | 'ADMIN';

export const SKILL_LEVELS: SkillLevel[] = [
  'LEVEL_1',
  'LEVEL_2',
  'LEVEL_3',
  'LEVEL_4',
  'LEVEL_5',
  'LEVEL_6',
];

export const SKILL_LEVEL_LABELS: Record<SkillLevel, string> = {
  LEVEL_1: 'Beginner',
  LEVEL_2: 'Beginner (Amateur)',
  LEVEL_3: 'Intermediate',
  LEVEL_4: 'Advanced',
  LEVEL_5: 'Semi-Pro',
  LEVEL_6: 'Professional',
};

export const SKILL_LEVEL_DESCRIPTIONS: Record<SkillLevel, string> = {
  LEVEL_1: 'Knows the rules, but basic elements (receive, serve, pass) are inconsistent.',
  LEVEL_2: 'Overhand serve, positional defense, simple receive.',
  LEVEL_3: 'Consistent reception, confident attacks, first attempts at a group block.',
  LEVEL_4: 'Confident play with the setter, first-tempo attacks, powerful & tactical serves.',
  LEVEL_5: 'Deep tactical understanding, powerful serves / gliders, well-rehearsed combinations.',
  LEVEL_6: 'Former pro athletes, MS / CMS holders, excellent technique, lightning-fast teamwork.',
};

export interface ApiUser {
  id: string;
  telegramId: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  age: number | null;
  skillLevel: SkillLevel | null;
  city: string;
  lat: number | null;
  lng: number | null;
  reminderOffsets: number[];
  photoUrl: string | null;
  role: UserRole;
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
  skillLevel: SkillLevel;
  spotsTotal: number;
  notes: string | null;
  totalCost: number;
  status: 'OPEN' | 'FULL' | 'CANCELLED' | 'FINISHED';
  venue: Pick<ApiVenue, 'id' | 'name' | 'address' | 'lat' | 'lng' | 'indoor' | 'city'>;
  host: {
    id: string;
    firstName: string;
    lastName: string | null;
    username: string | null;
    skillLevel: SkillLevel | null;
    photoUrl: string | null;
  };
  participantsCount: number;
  perPlayerCost: number;
}

export interface ApiGameDetail extends ApiGame {
  participants: Array<{
    id: string;
    userId: string;
    user: {
      id: string;
      firstName: string;
      lastName: string | null;
      username: string | null;
      photoUrl: string | null;
    };
    joinedAt: string;
  }>;
}

export interface CreateGamePayload {
  venueId: string;
  startAt: string;
  endAt: string;
  skillLevel: SkillLevel;
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

// Admin types (subset of fields used by the admin page)
export interface AdminUserListItem {
  items: Array<{
    id: string;
    telegramId: string;
    firstName: string;
    lastName: string | null;
    username: string | null;
    age: number | null;
    skillLevel: SkillLevel | null;
    city: string;
    photoUrl: string | null;
    role: UserRole;
    createdAt: string;
  }>;
  total: number;
}

export interface AdminGameListItem {
  items: Array<{
    id: string;
    skillLevel: SkillLevel;
    spotsTotal: number;
    status: ApiGame['status'];
    startAt: string;
    host: { id: string; firstName: string; username: string | null };
    venue: { id: string; name: string };
    _count: { participants: number };
  }>;
  total: number;
}

export interface AdminVenueListItem {
  items: Array<{
    id: string;
    name: string;
    address: string;
    city: string;
    status: 'PUBLISHED' | 'HIDDEN';
    hourlyPrice: number;
    capacity: number;
    _count: { games: number };
  }>;
  total: number;
}

export interface AdminStats {
  users: number;
  games: number;
  venues: number;
  signupsLast24h: number;
}

export interface AdminAuditEntry {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  meta: unknown;
  createdAt: string;
  actor: { id: string; firstName: string; username: string | null };
}

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
      // Some upstreams (nginx 502/503, empty proxy responses) return an empty
      // body — that's why we need to guard the JSON parse.
      const text = await res.text();
      if (text) {
        const j = JSON.parse(text);
        if (j?.message) msg = Array.isArray(j.message) ? j.message.join(', ') : String(j.message);
      }
    } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;

  // Same guard on the happy path — empty bodies should not throw a JSON error.
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
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

    // Admin endpoints
    adminStats: () => http<AdminStats>('/admin/stats', { method: 'GET' }, initData),
    adminListUsers: (q: { take?: number; skip?: number; q?: string } = {}) => {
      const params = new URLSearchParams();
      if (q.take) params.set('take', String(q.take));
      if (q.skip) params.set('skip', String(q.skip));
      if (q.q) params.set('q', q.q);
      const qs = params.toString();
      return http<AdminUserListItem>(
        `/admin/users${qs ? `?${qs}` : ''}`,
        { method: 'GET' },
        initData,
      );
    },
    adminUpdateUser: (id: string, patch: Record<string, unknown>) =>
      http<ApiUser>(`/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }, initData),
    adminDeleteUser: (id: string) =>
      http<{ ok: boolean }>(`/admin/users/${id}`, { method: 'DELETE' }, initData),

    adminListGames: (q: { take?: number; skip?: number; q?: string } = {}) => {
      const params = new URLSearchParams();
      if (q.take) params.set('take', String(q.take));
      if (q.skip) params.set('skip', String(q.skip));
      if (q.q) params.set('q', q.q);
      const qs = params.toString();
      return http<AdminGameListItem>(
        `/admin/games${qs ? `?${qs}` : ''}`,
        { method: 'GET' },
        initData,
      );
    },
    adminUpdateGame: (id: string, patch: Record<string, unknown>) =>
      http<ApiGame>(`/admin/games/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }, initData),
    adminDeleteGame: (id: string) =>
      http<{ ok: boolean }>(`/admin/games/${id}`, { method: 'DELETE' }, initData),

    adminListVenues: (q: { take?: number; skip?: number; q?: string } = {}) => {
      const params = new URLSearchParams();
      if (q.take) params.set('take', String(q.take));
      if (q.skip) params.set('skip', String(q.skip));
      if (q.q) params.set('q', q.q);
      const qs = params.toString();
      return http<AdminVenueListItem>(
        `/admin/venues${qs ? `?${qs}` : ''}`,
        { method: 'GET' },
        initData,
      );
    },
    adminUpdateVenue: (id: string, patch: Record<string, unknown>) =>
      http<ApiVenue>(`/admin/venues/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }, initData),
    adminDeleteVenue: (id: string) =>
      http<{ ok: boolean }>(`/admin/venues/${id}`, { method: 'DELETE' }, initData),

    adminListAudit: (q: { take?: number; skip?: number } = {}) => {
      const params = new URLSearchParams();
      if (q.take) params.set('take', String(q.take));
      if (q.skip) params.set('skip', String(q.skip));
      const qs = params.toString();
      return http<{ items: AdminAuditEntry[]; total: number }>(
        `/admin/audit${qs ? `?${qs}` : ''}`,
        { method: 'GET' },
        initData,
      );
    },
  };
}