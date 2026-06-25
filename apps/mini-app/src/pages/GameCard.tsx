import { Link } from "react-router-dom";
import { Icon } from "../Icon";
import type { ApiGame } from "../api";
import "./GameCard.css";

/**
 * Status → badge class. Mirrors the reference design's per-card accent.
 */
function badgeClass(status: ApiGame["status"]): string {
  switch (status) {
    case "OPEN":
      return "badge badge-status-OPEN";
    case "FULL":
      return "badge badge-status-FULL";
    case "CANCELLED":
      return "badge badge-status-CANCELLED";
    case "FINISHED":
      return "badge badge-status-FINISHED";
    default:
      return "badge";
  }
}

function formatGameTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(minor: number): string {
  // assume minor units; 100 = 1.00
  return (minor / 100).toFixed(2);
}

interface GameCardProps {
  game: ApiGame;
}

/**
 * One game card. Used by Home (next 3) and Games (full list).
 * Wrapped in a <Link> so clicking anywhere on the card opens the detail page.
 */
export function GameCard({ game }: GameCardProps) {
  const extraPlayers = Math.max(game.participantsCount - 4, 0);
  const shownPlayers = Math.min(game.participantsCount, 4);

  return (
    <Link to={`/games/${game.id}`} className="gameCard-link">
      <article className="gameCard">
        <div className="cardTop">
          <div>
            <div className="date">
              <Icon name="calendar-01" size={14} />
              <span>{formatGameTime(game.startAt)}</span>
            </div>
            <h3 className="title">{game.venue.name}</h3>
            <div className="location">
              <Icon name="map-pin" size={14} />
              <span>{game.venue.address}</span>
            </div>
          </div>
          <div className={badgeClass(game.status)}>
            {game.participantsCount}/{game.spotsTotal}
          </div>
        </div>

        <div className="avatars">
          {Array.from({ length: shownPlayers }).map((_, i) => (
            <div key={i} className="avatar" aria-hidden="true">
              {i + 1}
            </div>
          ))}
          {extraPlayers > 0 && <span className="more">+{extraPlayers}</span>}
        </div>

        <div className="meta">
          <span className="tag accent">{game.skillLevel}</span>
          <span className="tag info">{game.venue.indoor ? "Indoor" : "Outdoor"}</span>
          <span className="price">{formatMoney(game.perPlayerCost)} / player</span>
        </div>
      </article>
    </Link>
  );
}