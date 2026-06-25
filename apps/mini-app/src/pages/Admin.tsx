import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "react-query";
import {
  useApi,
  AdminStats,
  AdminUserListItem,
  AdminGameListItem,
  AdminVenueListItem,
  AdminAuditEntry,
  SkillLevel,
} from "../api";
import { Icon, IconName } from "../Icon";
import { Photo } from "../Photo";
import "./Admin.css";

type Tab = "stats" | "users" | "games" | "venues" | "audit";

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: "stats", label: "Stats", icon: "chart-line-data-01" },
  { id: "users", label: "Users", icon: "user-account" },
  { id: "games", label: "Games", icon: "tennis-ball" },
  { id: "venues", label: "Venues", icon: "building-01" },
  { id: "audit", label: "Audit", icon: "security" },
];

export function AdminPage() {
  const api = useApi();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("stats");

  return (
    <div className="adminPage">
      <header className="adminHeader">
        <div className="adminHeader-icon">
          <Icon name="crown" size={22} />
        </div>
        <div>
          <h1 className="adminHeader-title">Admin panel</h1>
          <p className="adminHeader-sub">Manage users, games, and venues.</p>
        </div>
      </header>

      <nav className="adminTabs" aria-label="Admin sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`adminTab ${tab === t.id ? "adminTab-active" : ""}`}
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
          >
            <Icon name={t.icon} size={14} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      <div className="adminContent">
        {tab === "stats" && <StatsTab />}
        {tab === "users" && <UsersTab />}
        {tab === "games" && <GamesTab />}
        {tab === "venues" && <VenuesTab />}
        {tab === "audit" && <AuditTab />}
      </div>
    </div>
  );
}

/* ============================================================
   Stats tab
   ============================================================ */
function StatsTab() {
  const api = useApi();
  const q = useQuery<AdminStats>(["admin", "stats"], () => api.adminStats());

  if (q.isLoading) {
    return <AdminSkeleton lines={4} />;
  }
  if (q.isError) {
    return (
      <div className="error">
        <Icon name="bell-dot" size={16} />
        <span>{(q.error as Error).message}</span>
      </div>
    );
  }
  if (!q.data) return null;

  const items = [
    { label: "Total users", value: q.data.users, icon: "user-account" as IconName, color: "cool" },
    { label: "Total games", value: q.data.games, icon: "tennis-ball" as IconName, color: "brand" },
    { label: "Total venues", value: q.data.venues, icon: "building-01" as IconName, color: "success" },
    { label: "Signups (24h)", value: q.data.signupsLast24h, icon: "user-add-01" as IconName, color: "warn" },
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

/* ============================================================
   Users tab
   ============================================================ */
function UsersTab() {
  const api = useApi();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const q = useQuery<AdminUserListItem>(
    ["admin", "users", search],
    () => api.adminListUsers({ take: 100, q: search || undefined }),
  );

  const updateRole = useMutation(
    ({ id, role }: { id: string; role: "USER" | "ADMIN" }) =>
      api.adminUpdateUser(id, { role }),
    { onSuccess: () => qc.invalidateQueries(["admin", "users"]) },
  );

  const del = useMutation(
    (id: string) => api.adminDeleteUser(id),
    {
      onSuccess: () => qc.invalidateQueries(["admin", "users"]),
    },
  );

  return (
    <div className="adminList">
      <div className="adminList-search">
        <Icon name="search-01" size={14} />
        <input
          type="text"
          placeholder="Search users…"
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
              </div>
              <div className="adminItem-sub">
                {u.username ? `@${u.username}` : "—"} · {u.city}
                {u.skillLevel && (
                  <span className="adminItem-tag">{u.skillLevel.replace("_", " ")}</span>
                )}
              </div>
              <div className="adminItem-meta">
                ID: {u.id} · TG: {u.telegramId} · Joined {new Date(u.createdAt).toLocaleDateString()}
              </div>
            </div>
            <div className="adminItem-actions">
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
    </div>
  );
}

/* ============================================================
   Games tab
   ============================================================ */
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
                  <Icon name="check-unread-01" size={14} />
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

/* ============================================================
   Venues tab
   ============================================================ */
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

/* ============================================================
   Audit tab
   ============================================================ */
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

/* ============================================================
   Skeleton placeholder
   ============================================================ */
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