import { useEffect } from 'react';
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useTelegram } from './tg';
import { useApi } from './api';
import { Icon } from './Icon';
import { HomePage } from './pages/Home';
import { GamesPage } from './pages/Games';
import { GameDetailPage } from './pages/GameDetail';
import { CreateGamePage } from './pages/CreateGame';
import { VenuesPage } from './pages/Venues';
import { ProfilePage } from './pages/Profile';
import './App.css';

export function App() {
  const { initData, user, ready } = useTelegram();
  const api = useApi();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Try to get the current user from the API (cookie-based) first.
  const meQ = useQuery(['me'], () => api.me(), {
    enabled: ready,
    retry: false,
  });

  // Login mutation: called when we have initData but no user.
  const loginMut = useMutation(() => api.login(initData), {
    onSuccess: () => qc.invalidateQueries(['me']),
  });

  useEffect(() => {
    if (!ready) return;
    if (initData && meQ.isFetched && !meQ.data && !loginMut.isLoading) {
      loginMut.mutate();
    }
  }, [ready, initData, meQ.isFetched, meQ.data, loginMut.isLoading]);

  // Onboarding guard: if user has no age or skill, send to profile.
  useEffect(() => {
    if (meQ.data && (meQ.data.age == null || meQ.data.skillLevel == null)) {
      navigate('/profile');
    }
  }, [meQ.data]);

  if (!ready) {
    return (
      <div className="app-container">
        <div className="empty">Loading…</div>
      </div>
    );
  }

  if (!initData && !meQ.data) {
    return (
      <div className="app-container">
        <div className="detailCard">
          <h3>Open from Telegram</h3>
          <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>
            This Mini App must be opened from a Telegram bot to work. If you're a developer, run it
            inside the Telegram client to get <code>initData</code>.
          </p>
          <p>Hello{user ? `, ${user.first_name}` : ''}.</p>
        </div>
      </div>
    );
  }

  if (loginMut.isError) {
    return (
      <div className="app-container">
        <div className="detailCard">
          <h3>Sign-in failed</h3>
          <div className="error">{(loginMut.error as Error).message}</div>
          <button className="btn" onClick={() => loginMut.mutate()}>
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
          <Route path="*" element={<div className="empty">Page not found.</div>} />
        </Routes>
      </div>

      <nav className="bottom-nav">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
          <Icon name="home-01" size={18} className="icon-stacked" />
          <span>Home</span>
        </NavLink>
        <NavLink to="/games" className={({ isActive }) => (isActive ? 'active' : '')}>
          <Icon name="tennis-ball" size={18} className="icon-stacked" />
          <span>Games</span>
        </NavLink>
        <NavLink to="/create" className={({ isActive }) => (isActive ? 'active' : '')}>
          <Icon name="plus-sign" size={18} className="icon-stacked" />
          <span>Create</span>
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => (isActive ? 'active' : '')}>
          <Icon name="user-account" size={18} className="icon-stacked" />
          <span>Profile</span>
        </NavLink>
      </nav>
    </>
  );
}
