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

function LoadingScreen() {
  return (
    <div className="app-container">
      <div className="empty-state">
        <div className="empty-state-icon skeleton" style={{ width: 56, height: 56, borderRadius: '50%' }} />
        <div className="empty-state-title skeleton" style={{ width: 140, height: 16 }} />
        <div className="empty-state-text skeleton" style={{ width: 200, height: 12, marginTop: 8 }} />
      </div>
    </div>
  );
}

export function App() {
  const { initData, user, ready } = useTelegram();
  const api = useApi();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const meQ = useQuery(['me'], () => api.me(), {
    enabled: ready,
    retry: false,
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

  useEffect(() => {
    if (meQ.data && (meQ.data.age == null || meQ.data.skillLevel == null)) {
      navigate('/profile');
    }
  }, [meQ.data]);

  if (!ready) return <LoadingScreen />;

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
            This Mini App must be opened from a Telegram bot to work. If you're a developer, run it
            inside the Telegram client to get <code>initData</code>.
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
          <Route path="*" element={
            <div className="empty-state">
              <div className="empty-state-icon">
                <Icon name="maps" size={24} />
              </div>
              <div className="empty-state-title">Page not found</div>
              <div className="empty-state-text">The page you're looking for doesn't exist.</div>
            </div>
          } />
        </Routes>
      </div>

      <nav className="bottom-nav" aria-label="Main navigation">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon">
            <Icon name="home-01" size={20} />
          </span>
          <span>Home</span>
        </NavLink>
        <NavLink to="/games" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon">
            <Icon name="tennis-ball" size={20} />
          </span>
          <span>Games</span>
        </NavLink>
        <NavLink to="/create" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon">
            <Icon name="plus-sign" size={20} />
          </span>
          <span>Create</span>
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon">
            <Icon name="user-account" size={20} />
          </span>
          <span>Profile</span>
        </NavLink>
      </nav>
    </>
  );
}