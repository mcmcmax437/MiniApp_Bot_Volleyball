import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { useApi, AdminGameListItem } from "../api";
import { Icon } from "../Icon";

export function AdminGamesPage() {
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

      {q.isLoading && (
        <div className="adminItems">
          {[0, 1, 2].map((i) => (
            <div key={i} className="adminItem">
              <div className="skeleton" style={{ width: 60, height: 24, borderRadius: 6 }} />
              <div className="adminItem-info">
                <div className="skeleton" style={{ width: "50%", height: 14, marginBottom: 6 }} />
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
