import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "react-query";
import {
  useApi,
  AdminStats,
  AdminUserListItem,
  AdminUserDetail,
  AdminGameListItem,
  AdminVenueListItem,
  AdminAuditEntry,
  ReportDto,
  HeatmapBucket,
  SkillLevel,
  SKILL_LEVELS,
} from "../api";
import { Icon, IconName } from "../Icon";
import { Photo } from "../Photo";
import { SkillBadge } from "../SkillBadge";
import { useI18n } from "../i18n";
import "./Admin.css";

type Tab = "stats" | "users" | "games" | "venues" | "reports" | "audit" | "heatmap";

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: "stats", label: "Stats", icon: "chart-line-data-01" },
  { id: "users", label: "Users", icon: "user-account" },
  { id: "games", label: "Games", icon: "tennis-ball" },
  { id: "venues", label: "Venues", icon: "building-01" },
  { id: "reports", label: "Reports", icon: "report" },
  { id: "audit", label: "Audit", icon: "security" },
  { id: "heatmap", label: "Heatmap", icon: "fire" },
];

export function AdminPage() {
  const api = useApi();
  const qc = useQueryClient();
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("stats");

  return (
    <div className="adminPage">
      <header className="page-header">
        <div className="page-header-icon">
          <Icon name="crown" size={20} />
        </div>
        <div>
          <h1 className="page-header-title">{t('admin.title')}</h1>
          <p className="page-header-sub">Manage users, games, and venues.</p>
        </div>
      </header>

      <nav className="adminTabs" aria-label="Admin sections">
        {TABS.map((tabDef) => (
          <button
            key={tabDef.id}
            type="button"
            className={`adminTab ${tab === tabDef.id ? "adminTab-active" : ""}`}
            onClick={() => setTab(tabDef.id)}
            aria-pressed={tab === tabDef.id}
          >
            <Icon name={tabDef.icon} size={14} />
            <span>{tabDef.label}</span>
          </button>
        ))}
      </nav>

      <div className="adminContent">
        {tab === "stats" && <StatsTab />}
        {tab === "users" && <UsersTab />}
        {tab === "games" && <GamesTab />}
        {tab === "venues" && <VenuesTab />}
        {tab === "reports" && <ReportsTab />}
        {tab === "audit" && <AuditTab />}
        {tab === "heatmap" && <HeatmapTab />}
      </div>
    </div>
  );
}

function StatsTab() {
  const api = useApi();
  const { t } = useI18n();
  const q = useQuery<AdminStats>(["admin", "stats"], () => api.adminStats());

  if (q.isLoading) return <AdminSkeleton lines={4} />;
  if (q.isError || !q.data) {
    return (
      <div className="error">
        <Icon name="bell-dot" size={16} />
        <span>{q.isError ? (q.error as Error).message : t('error.unknown')}</span>
      </div>
    );
  }

  const items = [
    { label: t('admin.users'), value: q.data.users, icon: "user-account" as IconName, color: "cool" },
    { label: t('admin.games'), value: q.data.games, icon: "tennis-ball" as IconName, color: "brand" },
    { label: t('admin.venues'), value: q.data.venues, icon: "building-01" as IconName, color: "success" },
    { label: "Signups (24h)", value: q.data.signupsLast24h, icon: "user-add-01" as IconName, color: "warn" },
    { label: t('admin.reports'), value: q.data.pendingReports, icon: "report" as IconName, color: "warn" },
    { label: "Banned", value: q.data.bannedUsers, icon: "user-remove-01" as IconName, color: "cool" },
    { label: t('game.finish'), value: q.data.finishedGames, icon: "check" as IconName, color: "success" },
  ];

  return (
    <div className="statsGrid">
      {items.map((s) => (
        <div key={s.label} className={`statCard statCard-${s.color}`}>
          <div className="statCard-icon">
            <Icon name={s.icon} size={20} />
          </div>
          <div className="statCard-value">{s.value.toLocaleString()}</div>
          <div className="statCard-label">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

function UsersTab() {
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

  const updateRole = useMutation(
    ({ id, role }: { id: string; role: "USER" | "ADMIN" }) =>
      api.adminUpdateUser(id, { role }),
    { onSuccess: () => qc.invalidateQueries(["admin", "users"]) },
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
            {f === 'ALL' ? t('games.filter.any') : f === 'YES' ? 'Banned' : 'Active'}
          </button>
        ))}
      </div>

      {q.isLoading && <AdminSkeleton lines={3} />}
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
                    Admin
                  </span>
                )}
                {u.isBanned && (
                  <span className="adminItem-badge adminItem-badge-danger">
                    <Icon name="user-remove-01" size={10} />
                    Banned
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
                title="Details"
                data-analytics-label="admin-user-details"
              >
                <Icon name="view" size={14} />
              </button>
              {u.role === "ADMIN" ? (
                <button
                  type="button"
                  className="adminItem-btn"
                  onClick={() => updateRole.mutate({ id: u.id, role: "USER" })}
                  disabled={updateRole.isLoading}
                  title="Demote to user"
                >
                  <Icon name="minus-sign" size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  className="adminItem-btn"
                  onClick={() => updateRole.mutate({ id: u.id, role: "ADMIN" })}
                  disabled={updateRole.isLoading}
                  title="Promote to admin"
                >
                  <Icon name="crown" size={14} />
                </button>
              )}
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
                  if (window.confirm(`Delete user ${u.firstName}? This cannot be undone.`)) {
                    del.mutate(u.id);
                  }
                }}
                disabled={del.isLoading}
                title="Delete user"
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
          <h3 className="modal-title">User details</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
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
                    <SkillBadge level={q.data.skillLevel as SkillLevel} size="sm" />
                  </div>
                )}
              </div>
            </div>

            <h2 className="formSection-title">
              <span className="formSection-num"><Icon name="chart-bar" size={12} /></span>
              Activity
            </h2>
            <div className="statsGrid">
              <div className="statCard statCard-cool">
                <div className="statCard-value">{q.data.stats.gamesAttended}</div>
                <div className="statCard-label">Visited</div>
              </div>
              <div className="statCard statCard-warn">
                <div className="statCard-value">{q.data.stats.gamesCancelled}</div>
                <div className="statCard-label">Cancelled</div>
              </div>
              <div className="statCard statCard-brand">
                <div className="statCard-value">{q.data.stats.gamesHosted}</div>
                <div className="statCard-label">Created</div>
              </div>
              <div className="statCard statCard-success">
                <div className="statCard-value">{q.data.stats.avgSessionsPerWeek.toFixed(1)}</div>
                <div className="statCard-label">Sessions / wk</div>
              </div>
            </div>

            <div className="costRow">
              <span>Evaluations given</span>
              <strong>{q.data.stats.evaluationsGiven}</strong>
            </div>
            <div className="costRow">
              <span>Evaluations received</span>
              <strong>{q.data.stats.evaluationsReceived}</strong>
            </div>
            <div className="costRow">
              <span>Reports against</span>
              <strong>{q.data.stats.reportsAgainst}</strong>
            </div>
            <div className="costRow">
              <span>Payments made</span>
              <strong>{q.data.stats.paymentsMade}</strong>
            </div>
            {q.data.evaluatedSkillLevel && (
              <div className="costRow">
                <span>Evaluated skill</span>
                <SkillBadge level={q.data.evaluatedSkillLevel as SkillLevel} size="sm" />
              </div>
            )}
            {q.data.isBanned && (
              <div className="error" style={{ marginTop: 10 }}>
                <Icon name="user-remove-01" size={14} />
                <span>Banned: {q.data.bannedReason ?? '—'}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function GamesTab() {
  const api = useApi();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const q = useQuery<AdminGameListItem>(
    ["admin", "games", search],
    () => api.adminListGames({ take: 100, q: search || undefined }),
  );

  const setStatus = useMutation(
    ({ id, status }: { id: string; status: "OPEN" | "FULL" | "CANCELLED" | "FINISHED" }) =>
      api.adminUpdateGame(id, { status }),
    { onSuccess: () => qc.invalidateQueries(["admin", "games"]) },
  );

  const del = useMutation(
    (id: string) => api.adminDeleteGame(id),
    { onSuccess: () => qc.invalidateQueries(["admin", "games"]) },
  );

  return (
    <div className="adminList">
      <div className="adminList-search">
        <Icon name="search-01" size={14} />
        <input
          type="text"
          placeholder="Search games…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {q.isLoading && <AdminSkeleton lines={3} />}
      {q.isError && (
        <div className="error">
          <Icon name="bell-dot" size={16} />
          <span>{(q.error as Error).message}</span>
        </div>
      )}
      {q.data && (
        <div className="adminList-meta">
          {q.data.total} game{q.data.total === 1 ? "" : "s"}
        </div>
      )}

      <div className="adminItems">
        {q.data?.items.map((g) => (
          <article key={g.id} className="adminItem">
            <div className={`adminItem-statusBadge adminItem-statusBadge-${g.status.toLowerCase()}`}>
              {g.status}
            </div>
            <div className="adminItem-info">
              <div className="adminItem-title">{g.venue.name}</div>
              <div className="adminItem-sub">
                {new Date(g.startAt).toLocaleString()} · {g._count.participants}/{g.spotsTotal} players
              </div>
              <div className="adminItem-meta">
                Host: {g.host.firstName}
                {g.host.username && ` (@${g.host.username})`} · Level: {g.skillLevel}
              </div>
            </div>
            <div className="adminItem-actions">
              {g.status !== "CANCELLED" && (
                <button
                  type="button"
                  className="adminItem-btn adminItem-btn-warn"
                  onClick={() => {
                    if (window.confirm("Cancel this game?")) {
                      setStatus.mutate({ id: g.id, status: "CANCELLED" });
                    }
                  }}
                  disabled={setStatus.isLoading}
                  title="Cancel game"
                >
                  <Icon name="cancel-01" size={14} />
                </button>
              )}
              {g.status !== "FINISHED" && g.status !== "CANCELLED" && (
                <button
                  type="button"
                  className="adminItem-btn"
                  onClick={() => setStatus.mutate({ id: g.id, status: "FINISHED" })}
                  disabled={setStatus.isLoading}
                  title="Mark as finished"
                >
                  <Icon name="check" size={14} />
                </button>
              )}
              <button
                type="button"
                className="adminItem-btn adminItem-btn-danger"
                onClick={() => {
                  if (window.confirm("Delete this game?")) del.mutate(g.id);
                }}
                disabled={del.isLoading}
                title="Delete game"
              >
                <Icon name="delete-01" size={14} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function VenuesTab() {
  const api = useApi();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const q = useQuery<AdminVenueListItem>(
    ["admin", "venues", search],
    () => api.adminListVenues({ take: 100, q: search || undefined }),
  );

  const setStatus = useMutation(
    ({ id, status }: { id: string; status: "PUBLISHED" | "HIDDEN" }) =>
      api.adminUpdateVenue(id, { status }),
    { onSuccess: () => qc.invalidateQueries(["admin", "venues"]) },
  );

  const del = useMutation(
    (id: string) => api.adminDeleteVenue(id),
    { onSuccess: () => qc.invalidateQueries(["admin", "venues"]) },
  );

  return (
    <div className="adminList">
      <div className="adminList-search">
        <Icon name="search-01" size={14} />
        <input
          type="text"
          placeholder="Search venues…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {q.isLoading && <AdminSkeleton lines={3} />}
      {q.isError && (
        <div className="error">
          <Icon name="bell-dot" size={16} />
          <span>{(q.error as Error).message}</span>
        </div>
      )}
      {q.data && (
        <div className="adminList-meta">
          {q.data.total} venue{q.data.total === 1 ? "" : "s"}
        </div>
      )}

      <div className="adminItems">
        {q.data?.items.map((v) => (
          <article key={v.id} className="adminItem">
            <div className="adminItem-icon">
              <Icon name="building-01" size={18} />
            </div>
            <div className="adminItem-info">
              <div className="adminItem-title">
                {v.name}
                {v.status === "HIDDEN" && (
                  <span className="adminItem-badge adminItem-badge-warn">Hidden</span>
                )}
              </div>
              <div className="adminItem-sub">
                {v.address} · {v.city}
              </div>
              <div className="adminItem-meta">
                {(v.hourlyPrice / 100).toFixed(2)} / hour · capacity {v.capacity} · {v._count.games} game
                {v._count.games === 1 ? "" : "s"}
              </div>
            </div>
            <div className="adminItem-actions">
              {v.status === "PUBLISHED" ? (
                <button
                  type="button"
                  className="adminItem-btn"
                  onClick={() => setStatus.mutate({ id: v.id, status: "HIDDEN" })}
                  disabled={setStatus.isLoading}
                  title="Hide venue"
                >
                  <Icon name="view-off" size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  className="adminItem-btn"
                  onClick={() => setStatus.mutate({ id: v.id, status: "PUBLISHED" })}
                  disabled={setStatus.isLoading}
                  title="Publish venue"
                >
                  <Icon name="view" size={14} />
                </button>
              )}
              <button
                type="button"
                className="adminItem-btn adminItem-btn-danger"
                onClick={() => {
                  if (window.confirm("Delete this venue? Refused if it has games.")) {
                    del.mutate(v.id);
                  }
                }}
                disabled={del.isLoading}
                title="Delete venue"
              >
                <Icon name="delete-01" size={14} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function ReportsTab() {
  const api = useApi();
  const qc = useQueryClient();
  const { t } = useI18n();
  const [statusFilter, setStatusFilter] = useState<'OPEN' | 'REVIEWED' | 'DISMISSED' | 'ALL'>('OPEN');

  const q = useQuery<{ items: ReportDto[]; total: number }>(
    ['admin', 'reports', statusFilter],
    () =>
      api.adminListReports({
        take: 100,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      }),
  );

  const resolveMut = useMutation(
    ({ id, status, ban }: { id: string; status: 'REVIEWED' | 'DISMISSED'; ban?: boolean }) =>
      api.adminResolveReport(id, { status, ban }),
    { onSuccess: () => qc.invalidateQueries(['admin', 'reports']) },
  );

  return (
    <div className="adminList">
      <div className="adminList-filters">
        {(['OPEN', 'REVIEWED', 'DISMISSED', 'ALL'] as const).map((f) => (
          <button
            key={f}
            type="button"
            className={`chip ${statusFilter === f ? 'chip-active' : ''}`}
            onClick={() => setStatusFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {q.isLoading && <AdminSkeleton lines={3} />}
      {q.isError && (
        <div className="error">
          <Icon name="bell-dot" size={16} />
          <span>{(q.error as Error).message}</span>
        </div>
      )}
      {q.data && (
        <div className="adminList-meta">{q.data.total} report{q.data.total === 1 ? '' : 's'}</div>
      )}

      <div className="adminItems">
        {q.data?.items.map((r) => (
          <article key={r.id} className="adminItem">
            <div className={`adminItem-statusBadge adminItem-statusBadge-${r.status === 'OPEN' ? 'open' : r.status === 'REVIEWED' ? 'finished' : 'cancelled'}`}>
              {r.status}
            </div>
            <div className="adminItem-info">
              <div className="adminItem-title">
                {r.reason} · <strong>{r.target.firstName}</strong>
              </div>
              <div className="adminItem-sub">
                by {r.reporter?.firstName ?? '—'} {r.reporter?.username && `(@${r.reporter.username})`}
                {r.game && ` · game ${r.game.startAt.slice(0, 10)}`}
              </div>
              {r.details && <div className="adminItem-meta">{r.details}</div>}
            </div>
            {r.status === 'OPEN' && (
              <div className="adminItem-actions">
                <button
                  type="button"
                  className="adminItem-btn adminItem-btn-warn"
                  onClick={() => {
                    if (window.confirm('Ban this user?')) {
                      resolveMut.mutate({ id: r.id, status: 'REVIEWED', ban: true });
                    }
                  }}
                  disabled={resolveMut.isLoading}
                  title={t('admin.resolveAndBan')}
                >
                  <Icon name="user-remove-01" size={14} />
                </button>
                <button
                  type="button"
                  className="adminItem-btn"
                  onClick={() => resolveMut.mutate({ id: r.id, status: 'REVIEWED' })}
                  disabled={resolveMut.isLoading}
                  title={t('admin.resolve')}
                >
                  <Icon name="check" size={14} />
                </button>
                <button
                  type="button"
                  className="adminItem-btn adminItem-btn-danger"
                  onClick={() => resolveMut.mutate({ id: r.id, status: 'DISMISSED' })}
                  disabled={resolveMut.isLoading}
                  title={t('admin.dismiss')}
                >
                  <Icon name="cancel-01" size={14} />
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

function AuditTab() {
  const api = useApi();
  const q = useQuery<{ items: AdminAuditEntry[]; total: number }>(
    ["admin", "audit"],
    () => api.adminListAudit({ take: 100 }),
  );

  if (q.isLoading) return <AdminSkeleton lines={4} />;
  if (q.isError) {
    return (
      <div className="error">
        <Icon name="bell-dot" size={16} />
        <span>{(q.error as Error).message}</span>
      </div>
    );
  }

  return (
    <div className="adminList">
      {q.data && (
        <div className="adminList-meta">
          {q.data.total} audit entr{q.data.total === 1 ? "y" : "ies"}
        </div>
      )}
      <div className="adminItems">
        {q.data?.items.map((a) => (
          <article key={a.id} className="adminItem adminItem-audit">
            <div className="adminItem-icon">
              <Icon name="security" size={16} />
            </div>
            <div className="adminItem-info">
              <div className="adminItem-title">
                {a.action} <span className="adminItem-target">on {a.targetType}</span>
              </div>
              <div className="adminItem-sub">
                by {a.actor.firstName}
                {a.actor.username && ` (@${a.actor.username})`} · target {a.targetId.slice(0, 8)}…
              </div>
              <div className="adminItem-meta">{new Date(a.createdAt).toLocaleString()}</div>
            </div>
          </article>
        ))}
        {q.data && q.data.items.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Icon name="security" size={20} />
            </div>
            <div className="empty-state-title">No audit entries yet</div>
            <div className="empty-state-text">Admin actions will be recorded here.</div>
          </div>
        )}
      </div>
    </div>
  );
}

function HeatmapTab() {
  const api = useApi();
  const [days, setDays] = useState(7);

  const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const q = useQuery<HeatmapBucket[]>(
    ['admin', 'heatmap', days],
    () => api.adminHeatmap({ from: fromDate.toISOString() }),
  );

  return (
    <div className="adminList">
      <div className="adminList-filters">
        {[1, 7, 30].map((d) => (
          <button
            key={d}
            type="button"
            className={`chip ${days === d ? 'chip-active' : ''}`}
            onClick={() => setDays(d)}
          >
            {d} day{d === 1 ? '' : 's'}
          </button>
        ))}
      </div>

      {q.isLoading && <AdminSkeleton lines={4} />}
      {q.isError && (
        <div className="error">
          <Icon name="bell-dot" size={16} />
          <span>{(q.error as Error).message}</span>
        </div>
      )}

      {q.data && q.data.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Icon name="chart-bar" size={24} />
          </div>
          <div className="empty-state-title">No click data yet</div>
          <div className="empty-state-text">As users interact with the app, the most-clicked elements will appear here.</div>
        </div>
      )}

      {q.data && q.data.length > 0 && (
        <>
          <div className="adminList-meta">{q.data.length} unique elements</div>
          <div className="adminItems">
            {q.data.map((b, i) => {
              const max = Math.max(...q.data!.map((x) => x.count));
              const pct = Math.max(8, Math.round((b.count / max) * 100));
              return (
                <article key={i} className="adminItem adminItem-heatmap">
                  <div className="adminItem-icon">
                    <Icon name="target" size={16} />
                  </div>
                  <div className="adminItem-info">
                    <div className="adminItem-title">{b.target}</div>
                    <div className="adminItem-sub">on {b.screen}</div>
                    <div
                      style={{
                        marginTop: 6,
                        height: 8,
                        borderRadius: 4,
                        background: 'var(--surface-2)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          background: 'var(--gradient-brand)',
                          transition: 'width 240ms',
                        }}
                      />
                    </div>
                  </div>
                  <div className="adminItem-meta" style={{ alignSelf: 'center', minWidth: 48, textAlign: 'right' }}>
                    <strong>{b.count}</strong>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function AdminSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="adminItems">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="adminItem">
          <div className="skeleton" style={{ width: 40, height: 40, borderRadius: "50%" }} />
          <div className="adminItem-info">
            <div className="skeleton" style={{ width: "60%", height: 14, marginBottom: 6 }} />
            <div className="skeleton" style={{ width: "40%", height: 12, marginBottom: 4 }} />
            <div className="skeleton" style={{ width: "80%", height: 11 }} />
          </div>
        </div>
      ))}
    </div>
  );
}