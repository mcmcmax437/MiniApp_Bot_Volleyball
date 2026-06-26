import { useQuery } from "react-query";
import { useApi, AdminStats } from "../api";
import { Icon, IconName } from "../Icon";
import { useI18n } from "../i18n";

export function AdminStatsPage() {
  const api = useApi();
  const { t } = useI18n();
  const q = useQuery<AdminStats>(["admin", "stats"], () => api.adminStats());

  if (q.isLoading) {
    return (
      <div className="statsGrid">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="statCard skeleton" style={{ height: 100 }} />
        ))}
      </div>
    );
  }
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
