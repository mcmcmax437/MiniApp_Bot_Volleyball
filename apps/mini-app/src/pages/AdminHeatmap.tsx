import { useMemo, useState } from "react";
import { useQuery } from "react-query";
import { useApi, HeatmapBucket } from "../api";
import { Icon } from "../Icon";
import { useI18n } from "../i18n";

export function AdminHeatmapPage() {
  const api = useApi();
  const { t } = useI18n();
  const [screen, setScreen] = useState("");

  const q = useQuery<HeatmapBucket[]>(
    ["admin", "heatmap", screen],
    () => api.adminHeatmap({ screen: screen || undefined }),
    { keepPreviousData: true },
  );

  const items = q.data ?? [];
  const max = items[0]?.count ?? 1;

  const screens = useMemo(() => {
    const set = new Set<string>();
    for (const b of items) if (b.screen && b.screen !== "_") set.add(b.screen);
    return Array.from(set).sort();
  }, [items]);

  return (
    <div className="adminHeatmap">
      <div className="adminList-search">
        <Icon name="search-01" size={14} />
        <input
          type="search"
          value={screen}
          onChange={(e) => setScreen(e.target.value)}
          placeholder={t("admin.heatmapFilter")}
          aria-label={t("admin.heatmapFilter")}
          list="admin-heatmap-screens"
        />
        <datalist id="admin-heatmap-screens">
          {screens.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>

      {q.isLoading && (
        <div className="skeleton" style={{ height: 160, borderRadius: 12 }} />
      )}

      {!q.isLoading && items.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Icon name="chart-bar" size={24} />
          </div>
          <div className="empty-state-title">{t("admin.heatmapEmpty")}</div>
        </div>
      )}

      <ul className="adminHeatmap-list">
        {items.map((b) => {
          const avgX = b.n > 0 ? Math.round(b.xSum / b.n) : null;
          const avgY = b.n > 0 ? Math.round(b.ySum / b.n) : null;
          return (
            <li key={`${b.screen}|${b.target}`} className="adminHeatmap-row card">
              <div className="adminHeatmap-head">
                <span className="adminHeatmap-target">{b.target}</span>
                <span className="adminHeatmap-count">{b.count}</span>
              </div>
              <div className="adminHeatmap-sub">
                {b.screen}
                {avgX !== null && avgY !== null
                  ? ` · ${t("admin.heatmapAvgPos", { x: avgX, y: avgY })}`
                  : ""}
              </div>
              <div className="adminRank-barTrack">
                <div
                  className="adminRank-barFill"
                  style={{ width: `${Math.max(4, (b.count / max) * 100)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
