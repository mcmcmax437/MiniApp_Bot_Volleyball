import { useTelegram } from './tg';

export type SkillLevel =
  | 'LEVEL_1'
  | 'LEVEL_2'
  | 'LEVEL_3'
  | 'LEVEL_4'
  | 'LEVEL_5'
  | 'LEVEL_6';

export type UserRole = 'USER' | 'ADMIN';

/** Surface type for a game (where it's being played). */
export type PlayType = 'INDOOR' | 'OUTDOOR' | 'BEACH';

export const PLAY_TYPES: PlayType[] = ['INDOOR', 'OUTDOOR', 'BEACH'];

/** Lightweight profile used by the user-search dropdown for invitations. */
export interface InviteSearchUser {
  id: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
  skillLevel: SkillLevel | null;
}

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
  isSuperAdmin: boolean;
  // v3:
  language: Language | null;
  evaluatedSkillLevel: SkillLevel | null;
  evaluatedAt: string | null;
  isBanned: boolean;
  bannedReason: string | null;
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

/** Public profile shape embedded in a game's participant list. */
export interface ApiGameParticipantUser {
  id: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
  skillLevel: SkillLevel | null;
  /** Weighted (peer-corrected) level, computed by the backend. */
  evaluatedSkillLevel: SkillLevel | null;
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
  // v3:
  isClosed: boolean;
  isPaid: boolean;
  currency: Currency;
  coverImageUrl: string | null;
  addressHint: string | null;
  // v4: where the game is being played (indoor court / outdoor court / beach).
  playType: PlayType;
  venue: Pick<ApiVenue, 'id' | 'name' | 'address' | 'lat' | 'lng' | 'indoor' | 'city'>;
  host: ApiGameParticipantUser;
  /**
   * Public participant profiles. The list endpoint ships the public fields
   * only (no phone, no telegramId) so the home feed can render an avatar
   * row with skill badges next to every photo.
   */
  participants: ApiGameParticipantUser[];
  participantsCount: number;
  perPlayerCost: number;
}

export interface ApiGameDetail extends Omit<ApiGame, 'participants'> {
  /**
   * Rich participant rows. The list endpoint only ships the public
   * `ApiGameParticipantUser` shape; the detail endpoint ships the join
   * row (`GameParticipant` from Prisma) so callers can access row-level
   * metadata like `joinedAt` and the `GameParticipant.id`.
   */
  participants: Array<{
    id: string;
    userId: string;
    user: ApiGameParticipantUser;
    joinedAt: string;
  }>;
  joinRequests?: Array<{ id: string; userId: string; createdAt: string; status: 'PENDING' | 'APPROVED' | 'REJECTED' }>;
  invitations?: Array<{ id: string; userId: string; inviterId: string; createdAt: string; status: 'PENDING' | 'ACCEPTED' | 'DECLINED' }>;
  payments?: Array<{
    id: string;
    userId: string;
    amount: number;
    currency: Currency;
    isPaid: boolean;
    paidAt: string | null;
  }>;
}

export interface CreateGamePayload {
  venueId?: string;
  venueName?: string;
  venueAddress: string;
  startAt: string;
  endAt: string;
  skillLevel: SkillLevel;
  spotsTotal: number;
  totalCost: number;
  notes?: string;
  // v3:
  currency?: Currency;
  isPaid?: boolean;
  isClosed?: boolean;
  coverImageUrl?: string;
  addressHint?: string;
  // v4:
  playType?: PlayType;
}

export interface UpdateGamePayload {
  startAt?: string;
  endAt?: string;
  notes?: string | null;
  skillLevel?: SkillLevel;
  spotsTotal?: number;
  totalCost?: number;
  currency?: Currency;
  isPaid?: boolean;
  isClosed?: boolean;
  coverImageUrl?: string | null;
  addressHint?: string | null;
  playType?: PlayType;
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
    evaluatedSkillLevel: SkillLevel | null;
    city: string;
    photoUrl: string | null;
    role: UserRole;
    language: string | null;
    isBanned: boolean;
    bannedReason: string | null;
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
  bannedUsers: number;
  pendingReports: number;
  finishedGames: number;
}

export interface AdminUserDetail {
  id: string;
  telegramId: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  age: number | null;
  city: string;
  skillLevel: SkillLevel | null;
  evaluatedSkillLevel: SkillLevel | null;
  photoUrl: string | null;
  role: UserRole;
  language: string | null;
  isBanned: boolean;
  bannedReason: string | null;
  bannedAt: string | null;
  createdAt: string;
  stats: {
    gamesAttended: number;
    gamesCancelled: number;
    gamesHosted: number;
    evaluationsGiven: number;
    evaluationsReceived: number;
    reportsAgainst: number;
    paymentsMade: number;
    avgSessionsPerWeek: number;
    lastActiveAt: string | null;
  };
}

// ===== v3 frontend additions =====

export type Language = 'uk' | 'pl' | 'en' | 'ru';
// Order: Polish first (default currency), then the rest.
export const SUPPORTED_LANGUAGES: Language[] = ['pl', 'en', 'uk', 'ru'];

export type Currency = 'UAH' | 'PLN' | 'EUR' | 'USD';
// Polish Zloty first because it is the app's default currency.
export const SUPPORTED_CURRENCIES: Currency[] = ['PLN', 'UAH', 'EUR', 'USD'];
export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  UAH: '₴',
  PLN: 'zł',
  EUR: '€',
  USD: '$',
};

export interface BlacklistEntry {
  id: string;
  blockedId: string;
  reason: string | null;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string | null; username: string | null; photoUrl: string | null; skillLevel: SkillLevel | null };
}

export interface ReportDto {
  id: string;
  reason: 'TOXIC' | 'SKIPPED_GAME' | 'HARASSMENT' | 'CHEATING' | 'OTHER';
  status: 'OPEN' | 'REVIEWED' | 'DISMISSED';
  details: string | null;
  createdAt: string;
  target: { id: string; firstName: string; username: string | null };
  reporter?: { id: string; firstName: string; username: string | null };
  game?: { id: string; startAt: string };
}

export interface GameInvitationDto {
  id: string;
  gameId: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  createdAt: string;
  game: {
    id: string;
    startAt: string;
    endAt: string;
    skillLevel: SkillLevel;
    spotsTotal: number;
    venue: { id: string; name: string; address: string };
  };
  inviter: { id: string; firstName: string; lastName: string | null; username: string | null; photoUrl: string | null };
}

export interface GamePaymentDetail {
  currency: Currency;
  totalCost: number;
  perPlayer: number;
  participants: Array<{
    userId: string;
    user: { id: string; firstName: string; lastName: string | null; username: string | null; photoUrl: string | null };
    joinedAt: string;
    amount: number;
    isPaid: boolean;
    paidAt: string | null;
    note: string | null;
  }>;
}

export interface EvaluationCandidate {
  id: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
  skillLevel: SkillLevel | null;
  evaluatedSkillLevel: SkillLevel | null;
  alreadyRated: boolean;
  ratedAs: SkillLevel | null;
}

export interface HeatmapBucket {
  screen: string;
  target: string;
  count: number;
  xSum: number;
  ySum: number;
  n: number;
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

    /**
     * TEMP debug — fetches the server's configured TELEGRAM_SUPERADMIN_ID,
     * masked to first-2 / last-2 digits. Used by the Home debug banner so
     * we can confirm the deploy actually wrote the expected value. Remove
     * the banner once admin role is confirmed working.
     */
    serverSuperadminId: () =>
      http<{ configured: boolean; masked?: string; length?: number }>(
        '/healthz/superadmin-id',
        { method: 'GET' },
        initData,
      ),

    listVenues: (q: { city?: string } = {}) => {
      const params = new URLSearchParams();
      if (q.city) params.set('city', q.city);
      const qs = params.toString();
      return http<ApiVenue[]>(`/venues${qs ? `?${qs}` : ''}`, { method: 'GET' }, initData);
    },
    createVenue: (payload: CreateVenuePayload) =>
      http<ApiVenue>('/venues', { method: 'POST', body: JSON.stringify(payload) }, initData),

    listGames: (
      q: {
        city?: string;
        skillLevel?: string;
        bucket?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
        from?: string;
        to?: string;
        minSpots?: number;
        hasSpots?: boolean;
        isPaid?: boolean;
        isClosed?: boolean;
        search?: string;
        playType?: PlayType;
      } = {},
    ) => {
      const params = new URLSearchParams();
      if (q.city) params.set('city', q.city);
      if (q.skillLevel) params.set('skillLevel', q.skillLevel);
      if (q.bucket) params.set('bucket', q.bucket);
      if (q.from) params.set('from', q.from);
      if (q.to) params.set('to', q.to);
      if (q.minSpots != null) params.set('minSpots', String(q.minSpots));
      if (q.hasSpots) params.set('hasSpots', 'true');
      if (q.isPaid) params.set('isPaid', 'true');
      if (q.isClosed) params.set('isClosed', 'true');
      if (q.search) params.set('q', q.search);
      if (q.playType) params.set('playType', q.playType);
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
    adminListUsers: (
      q: { take?: number; skip?: number; q?: string; isBanned?: 'true' | 'false'; role?: 'USER' | 'ADMIN'; city?: string } = {},
    ) => {
      const params = new URLSearchParams();
      if (q.take) params.set('take', String(q.take));
      if (q.skip) params.set('skip', String(q.skip));
      if (q.q) params.set('q', q.q);
      if (q.isBanned) params.set('isBanned', q.isBanned);
      if (q.role) params.set('role', q.role);
      if (q.city) params.set('city', q.city);
      const qs = params.toString();
      return http<AdminUserListItem>(
        `/admin/users${qs ? `?${qs}` : ''}`,
        { method: 'GET' },
        initData,
      );
    },
    adminGetUser: (id: string) =>
      http<AdminUserDetail>(`/admin/users/${id}`, { method: 'GET' }, initData),
    adminUpdateUser: (id: string, patch: Record<string, unknown>) =>
      http<ApiUser>(`/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }, initData),
    adminBanUser: (id: string, reason?: string) =>
      http<ApiUser>(`/admin/users/${id}/ban`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }, initData),
    adminUnbanUser: (id: string) =>
      http<ApiUser>(`/admin/users/${id}/unban`, { method: 'POST' }, initData),
    adminDeleteUser: (id: string) =>
      http<{ ok: boolean }>(`/admin/users/${id}`, { method: 'DELETE' }, initData),

    adminCancelGame: (id: string) =>
      http<ApiGame>(`/admin/games/${id}/cancel`, { method: 'POST' }, initData),

    adminListReports: (q: { take?: number; skip?: number; status?: 'OPEN' | 'REVIEWED' | 'DISMISSED' } = {}) => {
      const params = new URLSearchParams();
      if (q.take) params.set('take', String(q.take));
      if (q.skip) params.set('skip', String(q.skip));
      if (q.status) params.set('status', q.status);
      const qs = params.toString();
      return http<{ items: ReportDto[]; total: number }>(
        `/admin/reports${qs ? `?${qs}` : ''}`,
        { method: 'GET' },
        initData,
      );
    },
    adminResolveReport: (id: string, payload: { status: 'REVIEWED' | 'DISMISSED'; ban?: boolean }) =>
      http<ReportDto>(`/admin/reports/${id}/resolve`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }, initData),

    adminHeatmap: (q: { from?: string; to?: string; screen?: string } = {}) => {
      const params = new URLSearchParams();
      if (q.from) params.set('from', q.from);
      if (q.to) params.set('to', q.to);
      if (q.screen) params.set('screen', q.screen);
      const qs = params.toString();
      return http<HeatmapBucket[]>(`/admin/analytics/heatmap${qs ? `?${qs}` : ''}`, { method: 'GET' }, initData);
    },

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

    // ===== Blacklist =====

    listBlacklist: () =>
      http<BlacklistEntry[]>(`/blacklist`, { method: 'GET' }, initData),
    addBlacklist: (body: { blockedId?: string; telegramId?: string; reason?: string }) =>
      http<{ id: string }>(`/blacklist`, {
        method: 'POST',
        body: JSON.stringify(body),
      }, initData),
    removeBlacklist: (blockedId: string) =>
      http<{ count: number }>(`/blacklist/${blockedId}`, { method: 'DELETE' }, initData),
    intersectBlacklist: (ids: string[]) => {
      const params = new URLSearchParams();
      params.set('ids', ids.join(','));
      return http<{ blocked: string[] }>(
        `/blacklist/intersect?${params.toString()}`,
        { method: 'GET' },
        initData,
      );
    },

    // ===== Reports =====

    fileReport: (body: { targetId: string; reason: string; gameId?: string; details?: string }) =>
      http<ReportDto>(`/reports`, {
        method: 'POST',
        body: JSON.stringify(body),
      }, initData),
    listMyReports: () =>
      http<ReportDto[]>(`/reports/mine`, { method: 'GET' }, initData),

    // ===== Invitations =====

    invitePlayer: (gameId: string, inviteeId: string) =>
      http<GameInvitationDto>(`/games/${gameId}/invitations`, {
        method: 'POST',
        body: JSON.stringify({ inviteeId }),
      }, initData),
    searchInvitees: (q: string, excludeIds: string[]) => {
      const qs = new URLSearchParams();
      if (q.trim()) qs.set('q', q.trim());
      if (excludeIds.length) qs.set('exclude', excludeIds.join(','));
      return http<{ users: InviteSearchUser[] }>(
        `/users/search${qs.toString() ? `?${qs.toString()}` : ''}`,
        { method: 'GET' },
        initData,
      );
    },
    cancelInvitation: (id: string) =>
      http<{ ok: boolean }>(`/invitations/${id}`, { method: 'DELETE' }, initData),
    respondInvitation: (id: string, accept: boolean) =>
      http<{ ok: boolean }>(`/invitations/${id}/respond`, {
        method: 'POST',
        body: JSON.stringify({ accept }),
      }, initData),
    listMyInvitations: () =>
      http<GameInvitationDto[]>(`/invitations/mine`, { method: 'GET' }, initData),

    // ===== Payments =====

    listGamePayments: (gameId: string) =>
      http<GamePaymentDetail>(`/games/${gameId}/payments`, { method: 'GET' }, initData),
    setGamePayment: (gameId: string, body: { userId: string; isPaid: boolean }) =>
      http<{ id: string; isPaid: boolean }>(`/games/${gameId}/payments`, {
        method: 'POST',
        body: JSON.stringify(body),
      }, initData),
    listMyPayments: () =>
      http<Array<{ id: string; isPaid: boolean; amount: number; currency: Currency; game: { id: string; startAt: string; venue: { name: string }; host: { firstName: string; lastName: string | null; username: string | null } } }>>(
        `/payments/mine`,
        { method: 'GET' },
        initData,
      ),

    // ===== Evaluations =====

    listMyEvaluations: (gameId: string) =>
      http<Array<{ evaluateeId: string; skillLevel: SkillLevel }>>(
        `/games/${gameId}/evaluations`,
        { method: 'GET' },
        initData,
      ),
    listEvaluationCandidates: (gameId: string) =>
      http<{ self: string; candidates: EvaluationCandidate[] }>(
        `/games/${gameId}/evaluations/candidates`,
        { method: 'GET' },
        initData,
      ),
    submitEvaluations: (
      gameId: string,
      items: Array<{ evaluateeId: string; skillLevel: SkillLevel; note?: string }>,
    ) =>
      http<{ count: number }>(`/games/${gameId}/evaluations`, {
        method: 'POST',
        body: JSON.stringify({ items }),
      }, initData),

    // ===== Analytics =====

    ingestAnalytics: (events: Array<{ type: string; screen?: string; target?: string; meta?: Record<string, unknown> }>) =>
      http<{ count: number }>(`/analytics`, {
        method: 'POST',
        body: JSON.stringify({ events }),
      }, initData),
    heartbeat: () =>
      http<{ ok: boolean }>(`/analytics/heartbeat`, { method: 'POST' }, initData),

    // ===== Game edits (host) =====

    updateGame: (id: string, patch: UpdateGamePayload) =>
      http<ApiGameDetail>(`/games/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }, initData),
    finishGame: (id: string) =>
      http<ApiGameDetail>(`/games/${id}/finish`, { method: 'POST' }, initData),
    decideJoinRequest: (gameId: string, requestId: string, accept: boolean) =>
      http<{ ok: boolean; status: string }>(`/games/${gameId}/join-requests/${requestId}`, {
        method: 'POST',
        body: JSON.stringify({ accept }),
      }, initData),
    listJoinRequests: (gameId: string) =>
      http<Array<{ id: string; userId: string; status: string; user: { firstName: string; lastName: string | null; username: string | null; photoUrl: string | null; skillLevel: SkillLevel | null }; createdAt: string }>>(
        `/games/${gameId}/join-requests`,
        { method: 'GET' },
        initData,
      ),
  };
}
