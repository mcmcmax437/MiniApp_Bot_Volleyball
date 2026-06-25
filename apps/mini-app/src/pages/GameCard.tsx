import { Link } from "react-router-dom";
import { Icon } from "../Icon";
import type { ApiGame } from "../api";
import "./GameCard.css";

/**
 * Status → badge colour. Mirrors the reference design's per-card accent.
 * Falls back to neutral if status is unknown.
 */
function badgeColor(status: ApiGame["status"]): string {
  switch (status) {
    case "OPEN":
      return "#4ade80"; // green
    case "FULL":
      return "#f59e0b"; // amber
    case "CANCELLED":
      return "#f87171"; // red
    case "FINISHED":
      return "#94a3b8"; // dim
    default:
      return "#38bdf8"; // blue
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
  return `${(minor / 100).toFixed(2)}`;
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
              <Icon name="calendar-01" className="icon-inline" />
              <span>{formatGameTime(game.startAt)}</span>
            </div>
            <h3 className="title">{game.venue.name}</h3>
            <div className="location">
              <Icon name="map-pin" className="icon-inline" />
              <span>{game.venue.address}</span>
            </div>
          </div>
          <div className="badge" style={{ background: badgeColor(game.status) }}>
            {game.participantsCount}/{game.spotsTotal}
          </div>
        </div>

        <div className="avatars">
          {Array.from({ length: shownPlayers }).map((_, i) => (
            <div key={i} className="avatar" aria-hidden="true">
              <Icon name="user-account" size={16} />
            </div>
          ))}
          {extraPlayers > 0 && <span className="more">+{extraPlayers}</span>}
        </div>

        <div className="meta">
          <span className="tag accent">{game.skillLevel}</span>
          <span className="tag">{game.venue.indoor ? "Indoor" : "Outdoor"}</span>
          <span className="price">{formatMoney(game.perPlayerCost)} / player</span>
        </div>
      </article>
    </Link>
  );
}
