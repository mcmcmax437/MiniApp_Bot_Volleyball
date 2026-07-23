import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { useApi, AdminUserListItem, AdminUserDetail, SkillLevel } from "../api";
import { Icon } from "../Icon";
import { Photo } from "../Photo";
import { SkillBadge } from "../SkillBadge";
import { useI18n } from "../i18n";

export function AdminUsersPage() {
  const api = useApi();
  const qc = useQueryClient();
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [filterBanned, setFilterBanned] = useState<'ALL' | 'YES' | 'NO'>('ALL');
  const [openUser, setOpenUser] = useState<string | null>(null);

  const q = useQuery<AdminUserListItem>(
    ["admin", "users", search, filterBanned],
    () =>
      api.adminListUsers({
        take: 100,
        q: search || undefined,
        isBanned: filterBanned === 'ALL' ? undefined : filterBanned === 'YES' ? 'true' : 'false',
      }),
  );

  const banMut = useMutation(
    ({ id, reason }: { id: string; reason?: string }) => api.adminBanUser(id, reason),
    { onSuccess: () => qc.invalidateQueries(["admin", "users"]) },
  );

  const unbanMut = useMutation(
    (id: string) => api.adminUnbanUser(id),
    { onSuccess: () => qc.invalidateQueries(["admin", "users"]) },
  );

  const del = useMutation(
    (id: string) => api.adminDeleteUser(id),
    { onSuccess: () => qc.invalidateQueries(["admin", "users"]) },
  );

  return (
    <div className="adminList">
      <div className="adminList-search">
        <Icon name="search-01" size={14} />
        <input
          type="text"
          placeholder={t('admin.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="adminList-filters">
        {(['ALL', 'YES', 'NO'] as const).map((f) => (
          <button
            key={f}
            type="button"
            className={`chip ${filterBanned === f ? 'chip-active' : ''}`}
            onClick={() => setFilterBanned(f)}
          >
            {f === 'ALL' ? t('game.filter.any') : f === 'YES' ? t('admin.filterBanned') : t('admin.filterActive')}
          </button>
        ))}
      </div>

      {q.isLoading && (
        <div className="adminItems">
          {[0, 1, 2].map((i) => (
            <div key={i} className="adminItem">
              <div className="skeleton" style={{ width: 40, height: 40, borderRadius: "50%" }} />
              <div className="adminItem-info">
                <div className="skeleton" style={{ width: "60%", height: 14, marginBottom: 6 }} />
                <div className="skeleton" style={{ width: "40%", height: 12 }} />
              </div>
            </div>
          ))}
        </div>
      )}
      {q.isError && (
        <div className="error">
          <Icon name="bell-dot" size={16} />
          <span>{(q.error as Error).message}</span>
        </div>
      )}
      {q.data && (
        <div className="adminList-meta">
          {q.data.total} user{q.data.total === 1 ? "" : "s"}
        </div>
      )}

      <div className="adminItems">
        {q.data?.items.map((u) => (
          <article key={u.id} className="adminItem">
            <Photo
              src={u.photoUrl}
              name={`${u.firstName}${u.lastName ? " " + u.lastName : ""}`}
              size={40}
            />
            <div className="adminItem-info">
              <div className="adminItem-title">
                {u.firstName} {u.lastName ?? ""}
                {u.role === "ADMIN" && (
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
              <div className="adminItem-sub">
                {u.username ? `@${u.username}` : "—"} · {u.city ?? '—'}
                {u.skillLevel && (
                  <span style={{ marginLeft: 6 }}>
                    <SkillBadge level={u.skillLevel as SkillLevel} size="sm" />
                  </span>
                )}
              </div>
              <div className="adminItem-meta">
                ID: {u.id} · TG: {u.telegramId} · Joined {new Date(u.createdAt).toLocaleDateString()}
              </div>
            </div>
            <div className="adminItem-actions">
              <button
                type="button"
                className="adminItem-btn"
                onClick={() => setOpenUser(u.id)}
                title={t('admin.userDetails')}
                data-analytics-label="admin-user-details"
              >
                <Icon name="view" size={14} />
              </button>
              {u.isBanned ? (
                <button
                  type="button"
                  className="adminItem-btn"
                  onClick={() => unbanMut.mutate(u.id)}
                  disabled={unbanMut.isLoading}
                  title={t('admin.unban')}
                >
                  <Icon name="lock-unlocked-01" size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  className="adminItem-btn adminItem-btn-warn"
                  onClick={() => {
                    const reason = window.prompt(t('admin.banReason'));
                    if (reason !== null) banMut.mutate({ id: u.id, reason: reason || undefined });
                  }}
                  disabled={banMut.isLoading}
                  title={t('admin.ban')}
                >
                  <Icon name="lock" size={14} />
                </button>
              )}
              <button
                type="button"
                className="adminItem-btn adminItem-btn-danger"
                onClick={() => {
                  if (window.confirm(t('admin.deleteUserConfirm', { name: u.firstName }))) {
                    del.mutate(u.id);
                  }
                }}
                disabled={del.isLoading}
                title={t('admin.deleteUser')}
              >
                <Icon name="delete-01" size={14} />
              </button>
            </div>
          </article>
        ))}
      </div>

      <UserDetailsModal userId={openUser} onClose={() => setOpenUser(null)} />
    </div>
  );
}

function UserDetailsModal({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const api = useApi();
  const { t } = useI18n();
  const q = useQuery<AdminUserDetail | null>(
    ['admin', 'user', userId],
    () => api.adminGetUser(userId!),
    { enabled: !!userId },
  );

  if (!userId) return null;

  return (
    <div className="modalBackdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h3 className="modal-title">{t('admin.userDetails')}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label={t('common.close')}>
            <Icon name="cancel-01" size={14} />
          </button>
        </div>
        {q.isLoading && <div className="skeleton" style={{ height: 100, borderRadius: 10 }} />}
        {q.data && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <Photo src={q.data.photoUrl} name={q.data.firstName} size={56} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>
                  {q.data.firstName} {q.data.lastName ?? ''}
                </div>
                <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
                  @{q.data.username ?? '—'} · {q.data.city}
                </div>
                {q.data.skillLevel && (
                  <div style={{ marginTop: 6 }}>
                    <SkillBadge level={q.data.skillLevel as SkillLevel} size="sm" withLabel />
                  </div>
                )}
              </div>
            </div>

            <h2 className="formSection-title">
              <span className="formSection-num"><Icon name="chart-bar" size={12} /></span>
              {t('admin.userActivity')}
            </h2>
            <div className="statsGrid">
              <div className="statCard statCard-cool">
                <div className="statCard-value">{q.data.stats.gamesAttended}</div>
                <div className="statCard-label">{t('admin.stat.visited')}</div>
              </div>
              <div className="statCard statCard-warn">
                <div className="statCard-value">{q.data.stats.gamesCancelled}</div>
                <div className="statCard-label">{t('admin.stat.cancelled')}</div>
              </div>
              <div className="statCard statCard-brand">
                <div className="statCard-value">{q.data.stats.gamesHosted}</div>
                <div className="statCard-label">{t('admin.stat.created')}</div>
              </div>
              <div className="statCard statCard-success">
                <div className="statCard-value">{q.data.stats.avgSessionsPerWeek.toFixed(1)}</div>
                <div className="statCard-label">{t('admin.stat.sessionsPerWeek')}</div>
              </div>
            </div>

            <div className="costRow">
              <span>{t('admin.stat.evalGiven')}</span>
              <strong>{q.data.stats.evaluationsGiven}</strong>
            </div>
            <div className="costRow">
              <span>{t('admin.stat.evalReceived')}</span>
              <strong>{q.data.stats.evaluationsReceived}</strong>
            </div>
            <div className="costRow">
              <span>{t('admin.stat.reportsAgainst')}</span>
              <strong>{q.data.stats.reportsAgainst}</strong>
            </div>
            <div className="costRow">
              <span>{t('admin.stat.paymentsMade')}</span>
              <strong>{q.data.stats.paymentsMade}</strong>
            </div>
            {q.data.evaluatedSkillLevel && (
              <div className="costRow">
                <span>{t('admin.stat.evaluatedSkill')}</span>
                <SkillBadge level={q.data.evaluatedSkillLevel as SkillLevel} size="sm" withLabel />
              </div>
            )}
            {q.data.isBanned && (
              <div className="error" style={{ marginTop: 10 }}>
                <Icon name="user-remove-01" size={14} />
                <span>{t('admin.bannedWithReason', { reason: q.data.bannedReason ?? '—' })}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
