import { Link } from "react-router-dom";
import { Icon, IconName } from "../Icon";
import { useI18n } from "../i18n";

const SUB_PAGES: { to: string; titleKey: string; icon: IconName; descKey: string }[] = [
  { to: "/admin/stats", titleKey: "admin.stats", icon: "chart-line-data-01", descKey: "admin.index.stats" },
  { to: "/admin/users", titleKey: "admin.users", icon: "user-account", descKey: "admin.index.users" },
  { to: "/admin/games", titleKey: "admin.games", icon: "tennis-ball", descKey: "admin.index.games" },
  { to: "/admin/venues", titleKey: "admin.venues", icon: "building-01", descKey: "admin.index.venues" },
  { to: "/admin/reports", titleKey: "admin.reports", icon: "flag-01", descKey: "admin.index.reports" },
];

export function AdminIndexPage() {
  const { t } = useI18n();
  return (
    <div className="adminIndex">
      {SUB_PAGES.map((p) => (
        <Link key={p.to} to={p.to} className="adminIndexCard">
          <span className="adminIndexCard-icon"><Icon name={p.icon} size={18} /></span>
          <div className="adminIndexCard-text">
            <div className="adminIndexCard-title">{t(p.titleKey)}</div>
            <div className="adminIndexCard-desc">{t(p.descKey)}</div>
          </div>
          <span className="adminIndexCard-arrow"><Icon name="arrow-right-01" size={16} /></span>
        </Link>
      ))}
    </div>
  );
}
