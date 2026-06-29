import { Link } from "react-router-dom";
import { Icon } from "../Icon";
import { Photo } from "../Photo";
import { CURRENCY_SYMBOLS } from "../api";
import type { ApiGame, ApiGameParticipantUser } from "../api";
import { SkillBadge } from "../SkillBadge";
import { useI18n } from "../i18n";
import { effectiveSkillLevel } from "../lib/skill";
import { coverForPlayType } from "../lib/play-type";
import "./GameCard.css";

function statusToBadgeClass(status: ApiGame["status"]): string {
  return `badge badge-${status.toLowerCase()}`;
}

function statusLabel(status: ApiGame["status"], t: (key: string) => string): string {
  switch (status) {
    case "OPEN": return t('status.open');
    case "FULL": return t('status.full');
    case "CANCELLED": return t('status.cancelled');
    case "FINISHED": return t('status.finished');
    default: return status;
  }
}

function playTypeIcon(playType: ApiGame["playType"]) {
  switch (playType) {
    case "INDOOR": return "building-01";
    case "BEACH": return "tennis-ball";
    case "OUTDOOR":
    default: return "globe";
  }
}

/**
 * Normalize a participant entry from the games list payload to a
 * `ApiGameParticipantUser`. The list endpoint ships the public user shape
 * directly (`{id, firstName, ...}`), but a stale React Query cache (from
 * the previous build where `participants` was a richer join row) can
 * briefly hand us rows shaped like `{id, userId, user: {...}}`. We unwrap
 * `.user` when present so the avatar row keeps working across the cache
 * transition until the user reloads.
 */
function toParticipant(u: any): ApiGameParticipantUser {
  if (u && typeof u === 'object' && 'user' in u && u.user) {
    return u.user as ApiGameParticipantUser;
  }
  return u as ApiGameParticipantUser;
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
  const { t } = useI18n();
  const spotsLeft = game.spotsTotal - game.participantsCount;

  return (
    <Link to={`/games/${game.id}`} className="gameCard-link">
      <article className="card card-hover gameCard">
        {/* Hero: cover image as background, info overlaid on a dark
            bottom gradient. Modeled on the Flutter `GameHeroCard`
            reference — keeps the card compact so the feed scrolls
            further per screen. */}
        <div className="gameCard-hero">
          <img
            className="gameCard-heroImg"
            src={coverForPlayType(game.playType)}
            alt=""
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).classList.add('gameCard-heroImg-fallback');
            }}
          />
          <div className="gameCard-heroOverlay" aria-hidden />

          {/* Top row: status badge (left) + capacity pill (right) */}
          <div className="gameCard-heroTop">
            <div className="gameCard-heroStatus">
              <div className={statusToBadgeClass(game.status)}>
                <span className="badge-dot" />
                {statusLabel(game.status, t)}
              </div>
              {game.isClosed && (
                <span className="closedPill" title={t('game.closed')}>
                  <Icon name="lock" size={10} /> {t('game.closed')}
                </span>
              )}
            </div>
            <div className="gameCard-heroPill" aria-label={`${game.participantsCount} of ${game.spotsTotal}`}>
              {game.participantsCount}/{game.spotsTotal}
            </div>
          </div>

          {/* Bottom: title + meta */}
          <div className="gameCard-heroBody">
            <div className="gameCard-heroTitle">
              <Icon name={playTypeIcon(game.playType)} size={14} className="gameCard-heroTitleIcon" />
              <span>{t(`game.playType.${game.playType.toLowerCase()}`)}</span>
            </div>
            <div className="gameCard-heroMeta">
              <span>
                <Icon name="calendar-01" size={12} />
                {formatGameTime(game.startAt)}
              </span>
              <span>
                <Icon name="map-pin" size={12} />
                {game.venue.name}
              </span>
            </div>
          </div>
        </div>

        {/* Compact info row beneath the hero: a horizontal strip of
            participant avatars (host first, then the rest) with the
            weighted skill badge anchored to each photo, plus the
            per-player price on the right. */}
        <div className="gameCard-info">
          <div className="gameCard-playersRow">
            {(() => {
              // The list endpoint ships the full participant array
              // (id-only join on the query side, expanded on the server).
              // We render the host first (so the organizer is always
              // visible), then the other participants in their joinedAt
              // order.
              //
              // `participants` and `host` may both be undefined for one
              // render cycle if a stale React Query cache is feeding us
              // an older payload shape. We default to empty arrays so
              // the card still renders something sensible (the host
              // avatar) until the cache catches up.
              const allRaw: any[] = Array.isArray(game.participants)
                ? game.participants
                : [];
              const hostUser: ApiGameParticipantUser = toParticipant(game.host);
              const rest = allRaw
                .map(toParticipant)
                .filter((u) => u && u.id && u.id !== hostUser.id);
              const ordered = [hostUser, ...rest].filter(Boolean);
              // Cap the visible avatars so the row stays compact on
              // phones. 5 is the sweet spot — fits inside 14px padding
              // on a 360px viewport, with a `+N` overflow chip for the
              // rest.
              const maxAvatars = 5;
              const visible = ordered.slice(0, maxAvatars);
              const overflow = ordered.length - visible.length;
              return (
                <>
                  {visible.map((u) => {
                    const lvl = effectiveSkillLevel(u);
                    return (
                      <Photo
                        key={u.id}
                        src={u.photoUrl ?? null}
                        name={u.firstName ?? null}
                        size={28}
                        bottomRightBadge={lvl ? <SkillBadge level={lvl} size="sm" /> : null}
                      />
                    );
                  })}
                  {overflow > 0 && (
                    <span
                      className="gameCard-playersMore"
                      title={t('game.playersMore', { count: overflow })}
                    >
                      +{overflow}
                    </span>
                  )}
                </>
              );
            })()}
          </div>

          <div className="gameCard-right">
            <div className="gameCard-hostSub">
              <strong>{game.participantsCount}</strong>/{game.spotsTotal} {t('game.playersShort')}
              {spotsLeft > 0 && (
                <span className="gameCard-capacityFree"> · {t('game.spotsLeftShort', { count: spotsLeft })}</span>
              )}
            </div>
            {game.totalCost > 0 && (
              <div className="gameCard-price">
                <span className="gameCard-priceValue">
                  {CURRENCY_SYMBOLS[game.currency] ?? game.currency}
                  {formatMoney(game.perPlayerCost)}
                </span>
                <span className="gameCard-priceLabel">{t('game.perPlayerShort')}</span>
              </div>
            )}
          </div>
        </div>

        {spotsLeft > 0 && spotsLeft <= 3 && game.status === "OPEN" && (
          <div className="gameCard-urgent">
            <Icon name="bell-dot" size={12} />
            <span>{t(spotsLeft === 1 ? 'game.spotsOneLeft' : 'game.spotsLeft', { n: spotsLeft })}</span>
          </div>
        )}
      </article>
    </Link>
  );
}
