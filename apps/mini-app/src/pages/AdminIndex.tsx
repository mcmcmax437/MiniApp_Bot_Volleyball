import { Link } from "react-router-dom";
import { Icon, IconName } from "../Icon";

const SUB_PAGES: { to: string; title: string; icon: IconName; desc: string }[] = [
  { to: "/admin/stats", title: "Stats", icon: "chart-line-data-01", desc: "Users, games, venues, signups" },
  { to: "/admin/users", title: "Users", icon: "user-account", desc: "Manage roles, ban, unban" },
  { to: "/admin/games", title: "Games", icon: "tennis-ball", desc: "Cancel or finish any game" },
  { to: "/admin/venues", title: "Venues", icon: "building-01", desc: "Publish, hide, delete venues" },
  { to: "/admin/reports", title: "Reports", icon: "report", desc: "Review and resolve user reports" },
];

export function AdminIndexPage() {
  return (
    <div className="adminIndex">
      {SUB_PAGES.map((p) => (
        <Link key={p.to} to={p.to} className="adminIndexCard">
          <span className="adminIndexCard-icon"><Icon name={p.icon} size={18} /></span>
          <div className="adminIndexCard-text">
            <div className="adminIndexCard-title">{p.title}</div>
            <div className="adminIndexCard-desc">{p.desc}</div>
          </div>
          <span className="adminIndexCard-arrow"><Icon name="arrow-right-01" size={16} /></span>
        </Link>
      ))}
    </div>
  );
}
