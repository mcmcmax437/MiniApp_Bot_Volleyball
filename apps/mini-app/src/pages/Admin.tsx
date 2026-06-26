import { Link, useLocation } from "react-router-dom";
import { Icon, IconName } from "../Icon";
import { useI18n } from "../i18n";
import { AdminIndexPage } from "./AdminIndex";
import { AdminStatsPage } from "./AdminStats";
import { AdminUsersPage } from "./AdminUsers";
import { AdminGamesPage } from "./AdminGames";
import { AdminVenuesPage } from "./AdminVenues";
import { AdminReportsPage } from "./AdminReports";
import "./Admin.css";

type SubPage = "stats" | "users" | "games" | "venues" | "reports";

const SUB_PAGE_META: Record<SubPage, { labelKey: string; icon: IconName }> = {
  stats:   { labelKey: "admin.stats",   icon: "chart-line-data-01" },
  users:   { labelKey: "admin.users",   icon: "user-account" },
  games:   { labelKey: "admin.games",   icon: "tennis-ball" },
  venues:  { labelKey: "admin.venues",  icon: "building-01" },
  reports: { labelKey: "admin.reports", icon: "report" },
};

/**
 * /admin landing page. With no `subPage` prop it shows the index of cards
 * linking to the 5 admin sub-pages. With a `subPage` prop it shows the
 * matching sub-page (and a "back to admin" link in the header).
 */
export function AdminPage({ subPage }: { subPage?: SubPage }) {
  const { t } = useI18n();
  const location = useLocation();

  // /admin and /admin/stats etc. — when subPage is set, render the matching page.
  if (subPage) {
    const meta = SUB_PAGE_META[subPage];
    const label = t(meta.labelKey);
    return (
      <div className="adminPage">
        <header className="page-header">
          <Link
            to="/admin"
            className="btn btn-ghost btn-icon"
            aria-label="Back to admin"
            data-analytics-label="admin-back"
            state={{ from: location.pathname }}
          >
            <Icon name="arrow-left-01" size={16} />
          </Link>
          <div className="page-header-icon">
            <Icon name={meta.icon} size={20} />
          </div>
          <div>
            <h1 className="page-header-title">{label}</h1>
            <p className="page-header-sub">{t('admin.subtitleSection', { section: label })}</p>
          </div>
        </header>
        {subPage === "stats"   && <AdminStatsPage />}
        {subPage === "users"   && <AdminUsersPage />}
        {subPage === "games"   && <AdminGamesPage />}
        {subPage === "venues"  && <AdminVenuesPage />}
        {subPage === "reports" && <AdminReportsPage />}
      </div>
    );
  }

  return (
    <div className="adminPage">
      <header className="page-header">
        <div className="page-header-icon">
          <Icon name="crown" size={20} />
        </div>
        <div>
          <h1 className="page-header-title">{t('admin.title')}</h1>
          <p className="page-header-sub">{t('admin.subtitle')}</p>
        </div>
      </header>
      <AdminIndexPage />
    </div>
  );
}
