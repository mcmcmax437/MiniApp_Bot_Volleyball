import { useMemo } from 'react';
import { useQuery } from 'react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useApi, SkillLevel, SKILL_LEVELS } from '../api';
import { useI18n } from '../i18n';
import { Icon, IconName } from '../Icon';

const SKILL_ICONS: Record<SkillLevel, IconName> = {
  LEVEL_1: 'tennis-ball',
  LEVEL_2: 'play',
  LEVEL_3: 'medal-01',
  LEVEL_4: 'award-01',
  LEVEL_5: 'star',
  LEVEL_6: 'crown',
};

interface DayBucket {
  dateKey: string;
  date: Date;
  games: Array<{
    id: string;
    startAt: string;
    endAt: string;
    skillLevel: SkillLevel;
    spotsTotal: number;
    participantsCount: number;
    venue: { name: string; address: string };
  }>;
}

function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function CalendarPage() {
  const api = useApi();
  const { t } = useI18n();
  const navigate = useNavigate();

  // 60-day window centred on today
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - 7);
  const to = new Date(from);
  to.setDate(to.getDate() + 60);

  const gamesQ = useQuery(['games', 'calendar', from.toISOString(), to.toISOString()], () =>
    api.listGames({
      from: from.toISOString(),
      to: to.toISOString(),
    }),
  );

  const days: DayBucket[] = useMemo(() => {
    const map = new Map<string, DayBucket>();
    // Pre-fill the visible days so empty days still appear
    for (let i = 0; i < 60; i++) {
      const d = new Date(from);
      d.setDate(from.getDate() + i);
      const key = dayKey(d);
      map.set(key, { dateKey: key, date: d, games: [] });
    }
    if (gamesQ.data) {
      for (const g of gamesQ.data) {
        const d = new Date(g.startAt);
        const key = dayKey(d);
        const bucket = map.get(key);
        if (bucket) bucket.games.push(g as any);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [gamesQ.data]);

  const todayKey = dayKey(new Date());

  return (
    <div className="calendarPage">
      <header className="page-header">
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          aria-label={t('common.close')}
          data-analytics-label="calendar-back"
          onClick={() => {
            if (window.history.length > 1) navigate(-1);
            else navigate('/games');
          }}
        >
          <Icon name="arrow-left-01" size={16} />
        </button>
        <div className="page-header-icon">
          <Icon name="calendar-02" size={20} />
        </div>
        <div style={{ flex: 1 }}>
          <h1 className="page-header-title">{t('calendar.title')}</h1>
          <p className="page-header-sub">
            {t('calendar.upcoming')}
          </p>
        </div>
      </header>

      {gamesQ.isLoading && (
        <div className="skeleton" style={{ height: 200, borderRadius: 12 }} />
      )}

      {!gamesQ.isLoading && (
        <div className="calendarList">
          {days.map((day) => (
            <section key={day.dateKey} className="calendarDay">
              <div className="calendarDay-head">
                <span
                  className={`calendarDay-pill${day.dateKey === todayKey ? ' isToday' : ''}`}
                >
                  {day.date.toLocaleDateString(undefined, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
                {day.games.length > 0 && (
                  <span className="calendarDay-count">
                    {day.games.length}
                  </span>
                )}
              </div>
              {day.games.length === 0 ? (
                <div className="calendarDay-empty">—</div>
              ) : (
                <div className="calendarDay-games">
                  {day.games.map((g) => {
                    const skillNum = SKILL_LEVELS.indexOf(g.skillLevel) + 1;
                    const time = new Date(g.startAt).toLocaleTimeString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    const left = g.spotsTotal - g.participantsCount;
                    return (
                      <Link
                        key={g.id}
                        to={`/games/${g.id}`}
                        className="calendarGame"
                        data-analytics-label={`calendar-game-${g.id}`}
                      >
                        <span className="calendarGame-time">{time}</span>
                        <span className={`calendarGame-skill skill-${g.skillLevel}`}>
                          <Icon name={SKILL_ICONS[g.skillLevel]} size={14} />
                          {skillNum}
                        </span>
                        <span className="calendarGame-info">
                          <span className="calendarGame-venue">{g.venue.name}</span>
                          <span className="calendarGame-meta">
                            {left > 0 ? `${left} ${t('game.spotsLeft', { n: left })}` : t('game.spotsFull')}
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}