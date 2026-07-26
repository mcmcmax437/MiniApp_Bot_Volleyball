import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { useApi, AdminVenueListItem } from "../api";
import { Icon } from "../Icon";
import { confirmDialog } from "../lib/confirm";

export function AdminVenuesPage() {
  const api = useApi();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const q = useQuery<AdminVenueListItem>(
    ["admin", "venues", search],
    () => api.adminListVenues({ take: 100, q: search || undefined }),
  );

  const setStatus = useMutation(
    ({ id, status }: { id: string; status: "PUBLISHED" | "HIDDEN" }) =>
      api.adminUpdateVenue(id, { status }),
    {
      onSuccess: () => {
        setActionError(null);
        qc.invalidateQueries(["admin", "venues"]);
      },
      onError: (err) => setActionError((err as Error).message),
    },
  );

  const del = useMutation(
    (id: string) => api.adminDeleteVenue(id),
    {
      onSuccess: () => {
        setActionError(null);
        qc.invalidateQueries(["admin", "venues"]);
      },
      onError: (err) => setActionError((err as Error).message),
    },
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

      {q.isLoading && (
        <div className="adminItems">
          {[0, 1, 2].map((i) => (
            <div key={i} className="adminItem">
              <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 12 }} />
              <div className="adminItem-info">
                <div className="skeleton" style={{ width: "60%", height: 14, marginBottom: 6 }} />
                <div className="skeleton" style={{ width: "80%", height: 12 }} />
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
      {actionError && (
        <div className="error">
          <Icon name="bell-dot" size={16} />
          <span>{actionError}</span>
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
                onClick={async () => {
                  setActionError(null);
                  const games = v._count.games;
                  const ok = await confirmDialog(
                    games > 0
                      ? `Delete “${v.name}” and its ${games} game${games === 1 ? "" : "s"}? This cannot be undone.`
                      : `Delete “${v.name}”?`,
                  );
                  if (!ok) return;
                  del.mutate(v.id);
                }}
                disabled={del.isLoading}
                title={
                  v._count.games > 0
                    ? `Delete venue and ${v._count.games} linked game(s)`
                    : "Delete venue"
                }
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
