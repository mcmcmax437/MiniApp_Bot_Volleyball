import { useState } from "react";
import { useQuery } from "react-query";
import { useApi } from "../api";
import { GameCard } from "./GameCard";
import { Icon, IconName } from "../Icon";
import "./Games.css";

const SKILL_OPTIONS = ["ALL", "BEGINNER", "INTERMEDIATE", "ADVANCED", "PRO"] as const;
type SkillFilter = (typeof SKILL_OPTIONS)[number];

function skillIcon(s: SkillFilter): IconName {
  switch (s) {
    case "ALL": return "tennis-ball";
    case "BEGINNER": return "user-account";
    case "INTERMEDIATE": return "user-group";
    case "ADVANCED": return "award-01";
    case "PRO": return "fire";
    default: return "tennis-ball";
  }
}

export function GamesPage() {
  const api = useApi();
  const [skill, setSkill] = useState<SkillFilter>("ALL");
  const cityQ = useQuery(["default-city"], () => api.defaultCity());
  const gamesQ = useQuery(
    ["games", cityQ.data?.city, skill],
    () =>
      api.listGames({
        city: cityQ.data?.city ?? undefined,
        skillLevel: skill !== "ALL" ? skill : undefined,
      }),
    { enabled: !!cityQ.data },
  );

  const count = gamesQ.data?.length ?? 0;

  return (
    <div className="gamesPage">
      {/* === Featured header === */}
      <header className="gamesHeader">
        <div className="gamesHeader-icon">
          <Icon name="tennis-ball" size={20} />
        </div>
        <div>
          <h1 className="gamesHeader-title">All games</h1>
          <p className="gamesHeader-sub">
            {cityQ.data?.city ?? "your city"} · {count} game{count === 1 ? "" : "s"}
          </p>
        </div>
      </header>

      {/* === Skill filter chips === */}
      <div className="skillChips" role="tablist" aria-label="Filter by skill level">
        {SKILL_OPTIONS.map((s) => {
          const isActive = skill === s;
          return (
            <button
              key={s}
              role="tab"
              aria-selected={isActive}
              className={`chip ${isActive ? "chip-active" : ""}`}
              onClick={() => setSkill(s)}
            >
              <Icon name={skillIcon(s)} size={14} />
              <span>{s.charAt(0) + s.slice(1).toLowerCase()}</span>
              {isActive && (
                <span className="chip-check" aria-hidden="true">
                  <Icon name="check-unread-01" size={10} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* === Results === */}
      {gamesQ.isLoading && (
        <>
          {[0, 1, 2].map((i) => (
            <div key={i} className="card" style={{ marginBottom: 12, height: 140 }}>
              <div className="skeleton" style={{ width: '50%', height: 14, marginBottom: 12 }} />
              <div className="skeleton" style={{ width: '80%', height: 20, marginBottom: 16 }} />
              <div className="skeleton" style={{ width: '100%', height: 32, borderRadius: 10 }} />
            </div>
          ))}
        </>
      )}

      {gamesQ.isError && (
        <div className="error">
          <Icon name="bell-dot" size={16} />
          <span>{(gamesQ.error as Error).message}</span>
        </div>
      )}

      {gamesQ.data && gamesQ.data.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Icon name={skillIcon(skill)} size={24} />
          </div>
          <div className="empty-state-title">
            No {skill === "ALL" ? "open" : skill.toLowerCase()} games
          </div>
          <div className="empty-state-text">
            {skill === "ALL"
              ? "Be the first to create one in your city!"
              : `Try another skill level, or create the first ${skill.toLowerCase()} game.`}
          </div>
        </div>
      )}

      {gamesQ.data?.map((g) => (
        <GameCard key={g.id} game={g} />
      ))}
    </div>
  );
}