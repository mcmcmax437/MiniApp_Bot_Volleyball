import { useState } from "react";
import { useQuery } from "react-query";
import { useApi } from "../api";
import { GameCard } from "./GameCard";
import "./Games.css";

const SKILL_OPTIONS = ["ALL", "BEGINNER", "INTERMEDIATE", "ADVANCED", "PRO"] as const;
type SkillFilter = (typeof SKILL_OPTIONS)[number];

/**
 * Full list of upcoming games with a skill-level filter.
 * Route: /games
 */
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

  return (
    <div className="gamesPage">
      <div className="skillPills" role="tablist" aria-label="Skill level">
        {SKILL_OPTIONS.map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={skill === s}
            className={`pill ${skill === s ? "pill-active" : ""}`}
            onClick={() => setSkill(s)}
          >
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {gamesQ.isLoading && <div className="empty">Loading games…</div>}
      {gamesQ.isError && <div className="error">{(gamesQ.error as Error).message}</div>}
      {gamesQ.data && gamesQ.data.length === 0 && (
        <div className="empty">
          No {skill === "ALL" ? "open" : skill.toLowerCase()} games in your city yet. Be the first to
          create one!
        </div>
      )}

      {gamesQ.data?.map((g) => (
        <GameCard key={g.id} game={g} />
      ))}
    </div>
  );
}