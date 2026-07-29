import { useQuery } from "react-query";
import { useApi, AdminStats } from "../api";
import { Icon, IconName } from "../Icon";
import { useI18n } from "../i18n";

function formatDurationMs(ms: number): string {
  if (!ms || ms < 1000) return "0s";
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function RankList({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: Array<{ label: string; count: number }>;
}) {
  const max = items[0]?.count ?? 1;
  return (
    <section className="adminRank">
      <h3 className="adminRank-title">{title}</h3>
      {items.length === 0 ? (
        <p className="adminRank-empty">{empty}</p>
      ) : (
        <ul className="adminRank-list">
          {items.map((it) => (
            <li key={it.label} className="adminRank-row">
              <div className="adminRank-meta">
                <span className="adminRank-label">{it.label}</span>
                <span className="adminRank-count">{it.count}</span>
              </div>
              <div className="adminRank-barTrack">
                <div
                  className="adminRank-barFill"
                  style={{ width: `${Math.max(4, (it.count / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function AdminStatsPage() {
  const api = useApi();
  const { t } = useI18n();
  const q = useQuery<AdminStats>(["admin", "stats"], () => api.adminStats());

  if (q.isLoading) {
    return (
      <div className="statsGrid">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="statCard skeleton" style={{ height: 100 }} />
        ))}
      </div>
    );
  }
  if (q.isError || !q.data) {
    return (
      <div className="error">
        <Icon name="bell-dot" size={16} />
        <span>{q.isError ? (q.error as Error).message : t("error.unknown")}</span>
      </div>
    );
  }

  const d = q.data;
  const items: Array<{
    label: string;
    value: string | number;
    icon: IconName;
    color: string;
  }> = [
    { label: t("admin.users"), value: d.users, icon: "user-account", color: "cool" },
    { label: t("admin.stat.dau"), value: d.dau, icon: "user-account", color: "brand" },
    { label: t("admin.stat.wau"), value: d.wau, icon: "user-account", color: "brand" },
    { label: t("admin.stat.mau"), value: d.mau, icon: "user-account", color: "brand" },
    {
      label: t("admin.stat.sessionsToday"),
      value: d.sessionsToday,
      icon: "clock-01",
      color: "cool",
    },
    {
      label: t("admin.stat.avgSession"),
      value: formatDurationMs(d.avgSessionMs),
      icon: "clock-01",
      color: "success",
    },
    { label: t("admin.games"), value: d.games, icon: "tennis-ball", color: "brand" },
    { label: t("admin.venues"), value: d.venues, icon: "building-01", color: "success" },
    {
      label: t("admin.stat.signups24h"),
      value: d.signupsLast24h,
      icon: "user-add-01",
      color: "warn",
    },
    { label: t("admin.reports"), value: d.pendingReports, icon: "flag-01", color: "warn" },
    {
      label: t("admin.filterBanned"),
      value: d.bannedUsers,
      icon: "user-remove-01",
      color: "cool",
    },
    {
      label: t("admin.stat.finishedGames"),
      value: d.finishedGames,
      icon: "checkmark-circle-01",
      color: "success",
    },
  ];

  return (
    <div className="adminStats">
      <div className="statsGrid">
        {items.map((s) => (
          <div key={s.label} className={`statCard statCard-${s.color}`}>
            <div className="statCard-icon">
              <Icon name={s.icon} size={20} />
            </div>
            <div className="statCard-value">
              {typeof s.value === "number" ? s.value.toLocaleString() : s.value}
            </div>
            <div className="statCard-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="adminStats-ranks">
        <RankList
          title={t("admin.stat.topScreens")}
          empty={t("admin.stat.rankEmpty")}
          items={d.topScreens.map((r) => ({ label: r.screen, count: r.count }))}
        />
        <RankList
          title={t("admin.stat.topActions")}
          empty={t("admin.stat.rankEmpty")}
          items={d.topActions.map((r) => ({ label: r.type, count: r.count }))}
        />
        <RankList
          title={t("admin.stat.topClicks")}
          empty={t("admin.stat.rankEmpty")}
          items={d.topClicks.map((r) => ({ label: r.target, count: r.count }))}
        />
        <RankList
          title={t("admin.stat.platforms")}
          empty={t("admin.stat.rankEmpty")}
          items={d.platforms.map((r) => ({ label: r.platform, count: r.count }))}
        />
        <RankList
          title={t("admin.stat.languages")}
          empty={t("admin.stat.rankEmpty")}
          items={d.languages.map((r) => ({ label: r.language, count: r.count }))}
        />
      </div>
    </div>
  );
}
