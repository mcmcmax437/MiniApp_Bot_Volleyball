import { useState } from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { useApi } from '../api';
import { Icon } from '../Icon';
import { Photo } from '../Photo';
import { SkillBadge } from '../SkillBadge';
import { useI18n } from '../i18n';
import { formatGameDateTime } from '../lib/datetime';

function personName(u: { firstName: string; lastName: string | null }) {
  return u.lastName ? `${u.firstName} ${u.lastName}` : u.firstName;
}

function displayName(u: { firstName: string; lastName: string | null; username: string | null }) {
  const name = personName(u);
  return u.username ? `${name} (@${u.username})` : name;
}

export function AdminRatingsPage() {
  const api = useApi();
  const { t, lang } = useI18n();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const usersQ = useQuery(
    ['admin', 'rating-givers', search],
    () => api.adminListRatingGivers(search),
  );

  const ratingsQ = useQuery(
    ['admin', 'ratings-given', selectedId],
    () => api.adminListRatingsGiven(selectedId!),
    { enabled: !!selectedId },
  );

  const scores = [...(ratingsQ.data?.items ?? [])].sort((a, b) => {
    const byName = personName(a.evaluatee).localeCompare(personName(b.evaluatee), lang, {
      sensitivity: 'base',
    });
    if (byName !== 0) return byName;
    return a.game.startAt.localeCompare(b.game.startAt);
  });

  return (
    <div className="adminList">
      <div className="adminList-search">
        <Icon name="search-01" size={14} />
        <input
          type="text"
          placeholder={t('admin.ratingsSearch')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {usersQ.isLoading && <div className="empty">{t('common.loading')}</div>}
      {usersQ.data && (
        <div className="adminItems">
          {usersQ.data.items.map((u) => {
            const active = u.id === selectedId;
            return (
              <div key={u.id} className="adminRatings-block">
                <button
                  type="button"
                  className={`adminItem adminRatings-pick${active ? ' isActive' : ''}`}
                  onClick={() => setSelectedId(active ? null : u.id)}
                >
                  <Photo src={u.photoUrl} name={u.firstName} size={40} variant="rounded" />
                  <div className="adminItem-info">
                    <div className="adminItem-title">{displayName(u)}</div>
                  </div>
                  <span className="adminRatings-count">
                    {t('admin.ratingsCount', { n: u.givenCount })}
                  </span>
                </button>
                {active && (
                  <div className="adminRatings-scores">
                    {ratingsQ.isLoading && <div className="empty">{t('common.loading')}</div>}
                    {ratingsQ.isError && (
                      <div className="error">{(ratingsQ.error as Error).message}</div>
                    )}
                    {ratingsQ.data && scores.length === 0 && (
                      <p className="adminRatings-hint">{t('admin.ratingsEmpty')}</p>
                    )}
                    {scores.map((row) => (
                      <article key={row.id} className="adminItem">
                        <Photo
                          src={row.evaluatee.photoUrl}
                          name={row.evaluatee.firstName}
                          size={40}
                          variant="rounded"
                        />
                        <div className="adminItem-info">
                          <div className="adminItem-title">{displayName(row.evaluatee)}</div>
                          <div className="adminItem-sub">
                            <Link to={`/games/${row.game.id}`}>
                              {formatGameDateTime(row.game.startAt, { locale: lang })} · {row.game.venueName}
                            </Link>
                          </div>
                          {row.note && <div className="adminItem-meta">{row.note}</div>}
                        </div>
                        <SkillBadge level={row.skillLevel} size="md" withLabel />
                      </article>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {usersQ.data.items.length === 0 && (
            <div className="empty-state-title">{t('admin.activityEmpty')}</div>
          )}
        </div>
      )}

    </div>
  );
}
