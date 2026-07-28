import { useState } from 'react';
import { useQuery } from 'react-query';
import { useApi, AdminUserActivityList } from '../api';
import { Icon } from '../Icon';
import { Photo } from '../Photo';
import { useI18n } from '../i18n';
import './AdminActivity.css';

function formatDurationMs(ms: number): string {
  if (!ms || ms < 1000) return '0s';
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatLastActive(
  iso: string | null,
  t: (k: string, vars?: Record<string, string | number>) => string,
): string {
  if (!iso) return t('admin.stat.neverActive');
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return t('admin.stat.activeJustNow');
  if (diff < 3_600_000) {
    return t('admin.stat.activeMinutesAgo', { n: Math.floor(diff / 60_000) });
  }
  if (diff < 86_400_000) {
    return t('admin.stat.activeHoursAgo', { n: Math.floor(diff / 3_600_000) });
  }
  return d.toLocaleString();
}

/**
 * Admin-only roster of every user with app-usage trackers
 * (entries / day·week·month + average time in app).
 */
export function AdminActivityPage() {
  const api = useApi();
  const { t } = useI18n();
  const [search, setSearch] = useState('');

  const q = useQuery<AdminUserActivityList>(
    ['admin', 'users-activity', search],
    () => api.adminListUserActivity({ take: 200, q: search || undefined }),
    { keepPreviousData: true },
  );

  const items = q.data?.items ?? [];

  return (
    <div className="adminActivity">
      <div className="adminList-search">
        <Icon name="search-01" size={14} />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('admin.search')}
          aria-label={t('admin.search')}
        />
      </div>

      {q.isLoading && (
        <div className="skeleton" style={{ height: 160, borderRadius: 12 }} />
      )}

      {!q.isLoading && items.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Icon name="chart-bar" size={24} />
          </div>
          <div className="empty-state-title">{t('admin.activityEmpty')}</div>
        </div>
      )}

      <div className="adminActivity-list">
        {items.map((u) => {
          const name = u.lastName ? `${u.firstName} ${u.lastName}` : u.firstName;
          const a = u.activity;
          return (
            <article key={u.id} className="adminActivity-card card">
              <div className="adminActivity-head">
                <Photo src={u.photoUrl} name={name} size={40} variant="rounded" />
                <div className="adminActivity-who">
                  <div className="adminActivity-name">
                    {name}
                    {u.role === 'ADMIN' && (
                      <span className="adminItem-badge adminItem-badge-admin">
                        <Icon name="crown" size={10} />
                        {t('admin.roleAdmin')}
                      </span>
                    )}
                    {u.isBanned && (
                      <span className="adminItem-badge adminItem-badge-danger">
                        <Icon name="user-remove-01" size={10} />
                        {t('admin.badgeBanned')}
                      </span>
                    )}
                  </div>
                  <div className="adminActivity-sub">
                    {u.username ? `@${u.username}` : '—'}
                    {u.city ? ` · ${u.city}` : ''}
                  </div>
                  <div className="adminActivity-last">
                    {formatLastActive(a.lastActiveAt, t)}
                  </div>
                </div>
              </div>

              <div className="adminActivity-metrics">
                <div className="adminActivity-metric">
                  <span className="adminActivity-metricVal">{a.entriesDay}</span>
                  <span className="adminActivity-metricLbl">{t('admin.stat.entriesDayShort')}</span>
                </div>
                <div className="adminActivity-metric">
                  <span className="adminActivity-metricVal">{a.entriesWeek}</span>
                  <span className="adminActivity-metricLbl">{t('admin.stat.entriesWeekShort')}</span>
                </div>
                <div className="adminActivity-metric">
                  <span className="adminActivity-metricVal">{a.entriesMonth}</span>
                  <span className="adminActivity-metricLbl">{t('admin.stat.entriesMonthShort')}</span>
                </div>
                <div className="adminActivity-metric adminActivity-metric-time">
                  <span className="adminActivity-metricVal">
                    {formatDurationMs(a.avgSessionMs)}
                  </span>
                  <span className="adminActivity-metricLbl">{t('admin.stat.avgTimeShort')}</span>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {q.data && q.data.total > items.length && (
        <p className="adminActivity-more">
          {t('admin.activityShowing', { shown: items.length, total: q.data.total })}
        </p>
      )}
    </div>
  );
}
