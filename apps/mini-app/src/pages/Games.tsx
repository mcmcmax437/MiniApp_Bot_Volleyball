import { useState } from "react";
import { useQuery } from "react-query";
import {
  useApi,
  SkillLevel,
  SKILL_LEVELS,
  SKILL_LEVEL_LABELS,
} from "../api";
import { GameCard } from "./GameCard";
import { Icon, IconName } from "../Icon";
import "./Games.css";

type SkillFilter = "ALL" | SkillLevel;

const SKILL_ICONS: Record<SkillFilter, IconName> = {
  ALL: "tennis-ball",
  LEVEL_1: "tennis-ball",
  LEVEL_2: "play",
  LEVEL_3: "medal-01",
  LEVEL_4: "award-01",
  LEVEL_5: "star",
  LEVEL_6: "crown",
};

const FILTER_OPTIONS: SkillFilter[] = ["ALL", ...SKILL_LEVELS];

function skillFilterLabel(s: SkillFilter): string {
  if (s === "ALL") return "All";
  return SKILL_LEVEL_LABELS[s];
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
        {FILTER_OPTIONS.map((s) => {
          const isActive = skill === s;
          return (
            <button
              key={s}
              role="tab"
              aria-selected={isActive}
              className={`chip ${isActive ? "chip-active" : ""}`}
              onClick={() => setSkill(s)}
            >
              <Icon name={SKILL_ICONS[s]} size={14} />
              <span>{skillFilterLabel(s)}</span>
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
              <div className="skeleton" style={{ width: "50%", height: 14, marginBottom: 12 }} />
              <div className="skeleton" style={{ width: "80%", height: 20, marginBottom: 16 }} />
              <div className="skeleton" style={{ width: "100%", height: 32, borderRadius: 10 }} />
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
            <Icon name={SKILL_ICONS[skill]} size={24} />
          </div>
          <div className="empty-state-title">
            {skill === "ALL" ? "No open games" : `No ${skillFilterLabel(skill)} games`}
          </div>
          <div className="empty-state-text">
            {skill === "ALL"
              ? "Be the first to create one in your city!"
              : "Try another skill level, or create the first one."}
          </div>
        </div>
      )}

      {gamesQ.data?.map((g) => (
        <GameCard key={g.id} game={g} />
      ))}
    </div>
  );
}