import { Link } from "react-router-dom";
import { Icon } from "../Icon";
import type { ApiGame } from "../api";
import "./GameCard.css";

function statusToBadgeClass(status: ApiGame["status"]): string {
  return `badge badge-${status.toLowerCase()}`;
}

function statusLabel(status: ApiGame["status"]): string {
  switch (status) {
    case "OPEN": return "Open";
    case "FULL": return "Full";
    case "CANCELLED": return "Cancelled";
    case "FINISHED": return "Finished";
    default: return status;
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
  return (minor / 100).toFixed(2);
}

function timeUntil(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms < 0) return "Started";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) {
    const mins = Math.floor(ms / (1000 * 60));
    return `in ${mins} min`;
  }
  if (hours < 24) return `in ${hours}h`;
  const days = Math.floor(hours / 24);
  return `in ${days}d`;
}

interface GameCardProps {
  game: ApiGame;
}

export function GameCard({ game }: GameCardProps) {
  const spotsLeft = game.spotsTotal - game.participantsCount;
  const fillPercent = Math.min((game.participantsCount / game.spotsTotal) * 100, 100);
  const shownPlayers = Math.min(game.participantsCount, 4);
  const extraPlayers = Math.max(game.participantsCount - 4, 0);

  return (
    <Link to={`/games/${game.id}`} className="gameCard-link">
      <article className="card card-hover gameCard">
        {/* Top row: time + status */}
        <div className="gameCard-top">
          <div className="gameCard-time">
            <Icon name="calendar-01" size={14} />
            <span>{formatGameTime(game.startAt)}</span>
            <span className="gameCard-timeUntil">· {timeUntil(game.startAt)}</span>
          </div>
          <div className={statusToBadgeClass(game.status)}>
            <span className="badge-dot" />
            {statusLabel(game.status)}
          </div>
        </div>

        {/* Title */}
        <h3 className="gameCard-title">{game.venue.name}</h3>

        {/* Location */}
        <div className="gameCard-location">
          <Icon name="map-pin" size={14} />
          <span>{game.venue.address}</span>
        </div>

        {/* Avatars + count */}
        <div className="gameCard-players">
          <div className="avatars">
            {Array.from({ length: shownPlayers }).map((_, i) => (
              <div key={i} className="avatar" aria-hidden="true">
                {i + 1}
              </div>
            ))}
            {extraPlayers > 0 && <span className="more">+{extraPlayers}</span>}
          </div>
          <div className="gameCard-playerCount">
            <span className="gameCard-playerCountNum">
              {game.participantsCount}
              <span className="gameCard-playerCountMax">/{game.spotsTotal}</span>
            </span>
            <span className="gameCard-playerCountLabel">players</span>
          </div>
        </div>

        {/* Capacity bar */}
        <div className="capacity-bar">
          <div
            className={`capacity-bar-fill capacity-bar-fill-${game.status.toLowerCase()}`}
            style={{ width: `${fillPercent}%` }}
          />
        </div>

        {/* Meta: tags + price */}
        <div className="gameCard-meta">
          <div className="gameCard-tags">
            <span className="tag accent">{game.skillLevel}</span>
            <span className="tag info">
              <Icon name="building-01" size={10} className="icon-inline" style={{ marginRight: 2 }} />
              {game.venue.indoor ? "Indoor" : "Outdoor"}
            </span>
          </div>
          <div className="gameCard-price">
            <span className="gameCard-priceValue">{formatMoney(game.perPlayerCost)}</span>
            <span className="gameCard-priceLabel"> / player</span>
          </div>
        </div>

        {spotsLeft > 0 && spotsLeft <= 3 && game.status === "OPEN" && (
          <div className="gameCard-urgent">
            <Icon name="bell-dot" size={12} />
            <span>Only {spotsLeft} spot{spotsLeft === 1 ? "" : "s"} left</span>
          </div>
        )}
      </article>
    </Link>
  );
}