import { useEffect, useMemo } from 'react';
import { useQuery } from 'react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useApi, SkillLevel, SKILL_LEVELS } from '../api';
import { useI18n } from '../i18n';
import { Icon, IconName } from '../Icon';
import {
  dateFromDayKey,
  formatGameDayKey,
  formatGameTimeOnly,
  getAppTimeZone,
  setAppTimeZone,
  wallClockToUtcIso,
} from '../lib/datetime';
import { FILTER_GAMES_BY_CITY } from '../lib/city-filter';

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
    isClosed: boolean;
    venue: { name: string; address: string };
  }>;
}

export function CalendarPage() {
  const api = useApi();
  const { t, lang } = useI18n();
  const navigate = useNavigate();

  const meQ = useQuery(['me'], () => api.me());
  const cityQ = useQuery(['default-city'], () => api.defaultCity());
  const filterCity = meQ.data?.city || cityQ.data?.city || undefined;

  useEffect(() => {
    if (cityQ.data?.timeZone) setAppTimeZone(cityQ.data.timeZone);
  }, [cityQ.data?.timeZone]);

  const tz = cityQ.data?.timeZone || getAppTimeZone();

  // 60-day window in the app timezone (not the phone clock).
  const { fromIso, toIso, todayKey, dayKeys } = useMemo(() => {
    const today = formatGameDayKey(new Date(), tz);
    const todayNoon = dateFromDayKey(today, tz);
    const keys: string[] = [];
    for (let i = -7; i < 53; i++) {
      const d = new Date(todayNoon.getTime() + i * 24 * 3600_000);
      keys.push(formatGameDayKey(d, tz));
    }
    const fromIso = wallRangeStart(keys[0], tz);
    const toIso = wallRangeEnd(keys[keys.length - 1], tz);
    return { fromIso, toIso, todayKey: today, dayKeys: keys };
  }, [tz]);

  const gamesQ = useQuery(
    ['games', 'calendar', FILTER_GAMES_BY_CITY ? filterCity : 'ALL', fromIso, toIso],
    () =>
      api.listGames({
        city: FILTER_GAMES_BY_CITY ? filterCity : undefined,
        from: fromIso,
        to: toIso,
        includeClosed: true,
      }),
    {
      enabled: FILTER_GAMES_BY_CITY
        ? !!filterCity
        : !!meQ.data || cityQ.isFetched,
    },
  );

  const days: DayBucket[] = useMemo(() => {
    const map = new Map<string, DayBucket>();
    for (const key of dayKeys) {
      map.set(key, {
        dateKey: key,
        date: dateFromDayKey(key, tz),
        games: [],
      });
    }
    if (gamesQ.data) {
      for (const g of gamesQ.data) {
        const key = formatGameDayKey(g.startAt, tz);
        const bucket = map.get(key);
        if (bucket) bucket.games.push(g as DayBucket['games'][number]);
      }
    }
    return Array.from(map.values());
  }, [gamesQ.data, dayKeys, tz]);

  return (
    <div className="calendarPage">
      <header className="page-header">
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          aria-label={t('common.close')}
          data-analytics-label="calendar-back"
          onClick={() => navigate('/games')}
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
                  {day.date.toLocaleDateString(lang === 'en' ? 'en-GB' : lang, {
                    timeZone: tz,
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
                    const time = formatGameTimeOnly(g.startAt, { locale: lang });
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
                        </span>
                        <span className="calendarGame-side">
                          {g.isClosed && (
                            <span
                              className="calendarGame-lock"
                              title={t('game.closed')}
                              aria-label={t('game.closed')}
                            >
                              <Icon name="lock" size={14} />
                            </span>
                          )}
                          <span
                            className="calendarGame-capacity"
                            aria-label={`${g.participantsCount}/${g.spotsTotal} ${t('game.playersShort')}`}
                          >
                            {g.participantsCount}/{g.spotsTotal}
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

function wallRangeStart(dayKey: string, tz: string): string {
  return wallClockToUtcIso(`${dayKey}T00:00`, tz);
}

function wallRangeEnd(dayKey: string, tz: string): string {
  return wallClockToUtcIso(`${dayKey}T23:59`, tz);
}
