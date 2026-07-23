import { useEffect } from 'react';
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useTelegram } from './tg';
import { useApi } from './api';
import { Icon } from './Icon';
import { useI18n } from './i18n';
import { effectiveSkillLevel } from './lib/skill';
import { HomePage } from './pages/Home';
import { GamesPage } from './pages/Games';
import { GameDetailPage } from './pages/GameDetail';
import { CreateGamePage } from './pages/CreateGame';
import { VenuesPage } from './pages/Venues';
import { ProfilePage } from './pages/Profile';
import { WelcomePage } from './pages/Welcome';
import { AdminPage } from './pages/Admin';
import { AdminStatsPage } from './pages/AdminStats';
import { AdminUsersPage } from './pages/AdminUsers';
import { AdminGamesPage } from './pages/AdminGames';
import { AdminVenuesPage } from './pages/AdminVenues';
import { AdminReportsPage } from './pages/AdminReports';
import { CalendarPage } from './pages/Calendar';
import { BlacklistPage } from './pages/Blacklist';
import { InvitationsPage } from './pages/Invitations';
import { PaymentsPage } from './pages/Payments';
import { InvitationsBanner } from './components/InvitationsBanner';
import { PendingEvaluationsPrompt } from './components/PendingEvaluationsPrompt';
import { MessageNotify } from './components/MessageNotify';
import { useAnalytics } from './hooks/useAnalytics';
import './App.css';

function LoadingScreen() {
  const { t } = useI18n();
  return (
    <div className="app-container">
      <div className="empty-state">
        <div
          className="empty-state-icon skeleton"
          style={{ width: 56, height: 56, borderRadius: '50%' }}
        />
        <div className="empty-state-title skeleton" style={{ width: 140, height: 16 }} />
        <div
          className="empty-state-text skeleton"
          style={{ width: 200, height: 12, marginTop: 8 }}
        />
        <div style={{ marginTop: 16, color: 'var(--text-tertiary)' }}>{t('app.loadingHome')}</div>
      </div>
    </div>
  );
}

const ONBOARDED_KEY = 'volley:onboarded:v1';

function hasOnboardedLocally(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === '1';
  } catch {
    return false;
  }
}

function markOnboardedLocally() {
  try {
    localStorage.setItem(ONBOARDED_KEY, '1');
  } catch {
    /* ignore */
  }
}

/**
 * Client-side gate for /admin sub-pages. The server already enforces super
 * admin access via AdminGuard on every /api/v1/admin/* endpoint, so a non-admin
 * navigating here would get 403s on every call. This gate makes the UX
 * clear: they don't even see the page chrome. The real check is on the API.
 */
function AdminGate({ children }: { children: React.ReactNode }) {
  const api = useApi();
  const meQ = useQuery(['me'], () => api.me(), { retry: false });
  const { t } = useI18n();

  if (meQ.isLoading) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon skeleton" style={{ width: 56, height: 56, borderRadius: '50%' }} />
      </div>
    );
  }

  if (!meQ.data?.isSuperAdmin) {
    return (
      <div className="empty-state" style={{ marginTop: 40 }}>
        <div className="empty-state-icon" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
          <Icon name="lock" size={20} />
        </div>
        <div className="empty-state-title">Admin only</div>
        <div className="empty-state-text">
          {t('error.unknown')}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Wrapper for the "change my level" entry point. Pre-selects the user's
 * current level so they can confirm or pick a new one in one tap. Safe to
 * open without a server-level (e.g. user never onboarded) — in that case
 * the picker opens empty.
 */
function WelcomeChangePage() {
  const api = useApi();
  const meQ = useQuery(['me'], () => api.me(), { retry: false, staleTime: 0 });
  // Pre-select the user's current *effective* level (peer-corrected if
  // present, else their self pick). If the user has neither, fall back to
  // the self-level (which may still be null) so the picker opens empty.
  const prefill = meQ.data
    ? (effectiveSkillLevel(meQ.data) ?? meQ.data.skillLevel ?? null)
    : null;
  return (
    <WelcomePage
      mode="change"
      initialLevel={prefill as any}
    />
  );
}

export function App() {
  const { initData, user, ready } = useTelegram();
  const api = useApi();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t } = useI18n();
  useAnalytics();

  const meQ = useQuery(['me'], () => api.me(), {
    enabled: ready,
    retry: false,
    refetchOnMount: 'always',
    staleTime: 0,
  });

  const loginMut = useMutation(() => api.login(initData), {
    onSuccess: () => qc.invalidateQueries(['me']),
  });

  useEffect(() => {
    if (!ready) return;
    if (initData && meQ.isFetched && !meQ.data && !loginMut.isLoading) {
      loginMut.mutate();
    }
  }, [ready, initData, meQ.isFetched, meQ.data, loginMut.isLoading]);

  // Onboarding redirect
  useEffect(() => {
    if (!meQ.data) return;
    if (window.location.pathname !== '/') return;
    if (hasOnboardedLocally()) return;
    if (meQ.data.skillLevel == null) {
      navigate('/welcome', { replace: true });
    } else {
      markOnboardedLocally();
    }
  }, [meQ.data]);

  useEffect(() => {
    (window as any).__markVolleyOnboarded = markOnboardedLocally;
  }, []);

  if (!ready) return <LoadingScreen />;

  // Banned screen — replaces the entire app UI for banned users.
  if (meQ.data?.isBanned) {
    return (
      <div className="app-container">
        <div className="card" style={{ marginTop: 60, textAlign: 'center' }}>
          <div
            className="empty-state-icon"
            style={{ margin: '0 auto 12px', background: 'var(--gradient-danger)' }}
          >
            <Icon name="user-remove-01" size={24} />
          </div>
          <h2 style={{ margin: 0 }}>{t('auth.banned.title')}</h2>
          <p style={{ color: 'var(--text-tertiary)' }}>
            {t('auth.banned.body', { reason: meQ.data.bannedReason ?? '—' })}
          </p>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
            {t('auth.banned.contact')}
          </p>
        </div>
      </div>
    );
  }

  if (!initData && !meQ.data) {
    return (
      <div className="app-container">
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header">
            <h3 className="card-title">
              <Icon name="bell-dot" size={18} className="icon-inline" />
              Open from Telegram
            </h3>
          </div>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 14, lineHeight: 1.6 }}>
            This Mini App must be opened from a Telegram bot to work.
          </p>
          <p style={{ color: 'var(--text-secondary)', marginTop: 12 }}>
            Hello{user ? `, ${user.first_name}` : ''}.
          </p>
        </div>
      </div>
    );
  }

  if (loginMut.isError) {
    return (
      <div className="app-container">
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header">
            <h3 className="card-title">
              <Icon name="bell-dot" size={18} className="icon-inline" />
              Sign-in failed
            </h3>
          </div>
          <div className="error">
            <Icon name="bell-dot" size={16} />
            <span>{(loginMut.error as Error).message}</span>
          </div>
          <button className="btn" onClick={() => loginMut.mutate()} style={{ marginTop: 16 }}>
            <Icon name="plus-sign" size={18} />
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/games" element={<GamesPage />} />
          <Route path="/games/:id" element={<GameDetailPage />} />
          <Route path="/create" element={<CreateGamePage />} />
          <Route path="/venues" element={<VenuesPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/welcome" element={<WelcomePage />} />
          <Route path="/welcome/change" element={<WelcomeChangePage />} />
          <Route path="/admin" element={<AdminGate><AdminPage /></AdminGate>} />
          <Route path="/admin/stats" element={<AdminGate><AdminPage subPage="stats" /></AdminGate>} />
          <Route path="/admin/users" element={<AdminGate><AdminPage subPage="users" /></AdminGate>} />
          <Route path="/admin/games" element={<AdminGate><AdminPage subPage="games" /></AdminGate>} />
          <Route path="/admin/venues" element={<AdminGate><AdminPage subPage="venues" /></AdminGate>} />
          <Route path="/admin/reports" element={<AdminGate><AdminPage subPage="reports" /></AdminGate>} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/blacklist" element={<BlacklistPage />} />
          <Route path="/invitations" element={<InvitationsPage />} />
          <Route path="/payments" element={<PaymentsPage />} />
          <Route
            path="*"
            element={
              <div className="empty-state">
                <div className="empty-state-icon">
                  <Icon name="maps" size={24} />
                </div>
                <div className="empty-state-title">Page not found</div>
                <div className="empty-state-text">
                  The page you're looking for doesn't exist.
                </div>
              </div>
            }
          />
        </Routes>
      </div>

      <nav className="bottom-nav" aria-label="Main navigation">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon">
            <Icon name="home-01" size={20} />
          </span>
          <span>{t('nav.home')}</span>
        </NavLink>
        <NavLink to="/games" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon">
            <Icon name="tennis-ball" size={20} />
          </span>
          <span>{t('nav.games')}</span>
        </NavLink>
        <NavLink to="/create" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon">
            <Icon name="plus-sign" size={20} />
          </span>
          <span>{t('nav.create')}</span>
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon">
            <Icon name="user-account" size={20} />
          </span>
          <span>{t('nav.profile')}</span>
        </NavLink>
        {meQ.data?.isSuperAdmin && (
          <NavLink
            to="/admin"
            className={({ isActive }) => (isActive ? 'active' : '')}
            data-analytics-label="nav-admin"
          >
            <span className="nav-icon">
              <Icon name="crown" size={20} />
            </span>
            <span>{t('nav.admin')}</span>
          </NavLink>
        )}
      </nav>

      {/* Persistent pending-invitations banner. Hidden on the dedicated
          /invitations page (it IS the inbox) and on /games/:id (the user is
          already acting on that game). */}
      {window.location.pathname !== '/invitations' &&
        !window.location.pathname.startsWith('/games/') && <InvitationsBanner />}

      {/* Post-game skill ratings: prompts every participant of a finished
          game on their next app open, not just the host at finish-time. */}
      <PendingEvaluationsPrompt />

      {/* Top-right shake tab when there are pending invitations. */}
      <MessageNotify />
    </>
  );
}
