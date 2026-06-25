import { useState } from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { useApi, ApiGame } from '../api';
import { Icon } from '../Icon';

const SKILL_OPTIONS = ['ALL', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PRO'] as const;
type SkillFilter = (typeof SKILL_OPTIONS)[number];

function formatGameTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMoney(minor: number): string {
  // assume minor units; treat 100 = 1.00
  return `${(minor / 100).toFixed(2)}`;
}

export function FeedPage() {
  const api = useApi();
  const [skill, setSkill] = useState<SkillFilter>('ALL');
  const cityQ = useQuery(['default-city'], () => api.defaultCity());
  const gamesQ = useQuery(
    ['games', cityQ.data?.city, skill],
    () =>
      api.listGames({
        city: cityQ.data?.city ?? undefined,
        skillLevel: skill !== 'ALL' ? skill : undefined,
      }),
    { enabled: !!cityQ.data },
  );

  return (
    <>
      <div className="map-placeholder">
        <Icon name="maps" size={28} className="icon-inline" />
        <span>Map of upcoming games</span>
      </div>

      <div className="field">
        <label>Skill level</label>
        <select value={skill} onChange={(e) => setSkill(e.target.value as SkillFilter)}>
          {SKILL_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {gamesQ.isLoading && <div className="empty">Loading games…</div>}
      {gamesQ.isError && <div className="error">{(gamesQ.error as Error).message}</div>}
      {gamesQ.data && gamesQ.data.length === 0 && (
        <div className="empty">No open games in your city yet. Be the first to create one!</div>
      )}

      {gamesQ.data?.map((g: ApiGame) => (
        <Link key={g.id} to={`/games/${g.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card">
            <h3>{g.venue.name}</h3>
            <div className="row">
              <span>
                <Icon name="calendar-01" className="icon-inline" />
                {formatGameTime(g.startAt)}
              </span>
              <span>
                <Icon name="user-group" className="icon-inline" />
                {g.participantsCount}/{g.spotsTotal} players
              </span>
            </div>
            <div className="row">
              <span>
                <span className="tag accent">{g.skillLevel}</span>
                <span className="tag">{g.venue.indoor ? 'Indoor' : 'Outdoor'}</span>
              </span>
              <strong>{formatMoney(g.perPlayerCost)} / player</strong>
            </div>
            <div className="row">
              <span>
                <Icon name="user-account" className="icon-inline" />
                {g.host.firstName}
              </span>
            </div>
          </div>
        </Link>
      ))}
    </>
  );
}
