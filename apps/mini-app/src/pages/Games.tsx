import { useState } from "react";
import { useQuery } from "react-query";
import { Link } from "react-router-dom";
import {
  useApi,
  SkillLevel,
  SKILL_LEVELS,
} from "../api";
import { useI18n } from "../i18n";
import { GameCard } from "./GameCard";
import { Icon } from "../Icon";
import "./Games.css";

type SkillFilter = "ALL" | SkillLevel;

const FILTER_OPTIONS: SkillFilter[] = ["ALL", ...SKILL_LEVELS];

function skillChipLabel(s: SkillFilter): string {
  if (s === "ALL") return "All";
  return `S${SKILL_LEVELS.indexOf(s) + 1}`;
}

export function GamesPage() {
  const api = useApi();
  const { t } = useI18n();
  const [skill, setSkill] = useState<SkillFilter>("ALL");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [spotsMin, setSpotsMin] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  const cityQ = useQuery(["default-city"], () => api.defaultCity());

  const listArgs = {
    city: cityQ.data?.city ?? undefined,
    skillLevel: skill !== "ALL" ? skill : undefined,
    from: dateFrom ? new Date(dateFrom).toISOString() : undefined,
    to: dateTo ? new Date(dateTo + "T23:59:59").toISOString() : undefined,
    minSpots: spotsMin ? Number(spotsMin) : undefined,
    q: search.trim() || undefined,
    hasSpots: true,
  };

  const gamesQ = useQuery(
    ["games", "list", JSON.stringify(listArgs)],
    () => api.listGames(listArgs),
    { enabled: !!cityQ.data },
  );

  const count = gamesQ.data?.length ?? 0;
  const filtersActive =
    skill !== "ALL" || !!dateFrom || !!dateTo || !!spotsMin || !!search.trim();

  const clearAll = () => {
    setSkill("ALL");
    setDateFrom("");
    setDateTo("");
    setSpotsMin("");
    setSearch("");
  };

  return (
    <div className="gamesPage">
      <header className="page-header">
        <div className="page-header-icon">
          <Icon name="tennis-ball" size={20} />
        </div>
        <div style={{ flex: 1 }}>
          <h1 className="page-header-title">{t("games.title")}</h1>
          <p className="page-header-sub">
            {cityQ.data?.city ?? "your city"} · {count} game{count === 1 ? "" : "s"}
          </p>
        </div>
        {filtersActive && (
          <button
            type="button"
            className="btn btn-ghost btn-icon gamesHeader-clear"
            onClick={clearAll}
            data-analytics-label="games-clear-filters"
            aria-label={t("games.filter.clear")}
            title={t("games.filter.clear")}
          >
            <Icon name="cancel-01" size={14} />
          </button>
        )}
        <button
          type="button"
          className={`btn btn-ghost btn-icon gamesHeader-tool${showFilters || filtersActive ? " isActive" : ""}`}
          onClick={() => setShowFilters((s) => !s)}
          data-analytics-label="games-toggle-filters"
          aria-label={t("games.filter.apply")}
          title={t("games.filter.apply")}
        >
          <Icon name="filter" size={14} />
          {filtersActive && <span className="btn-icon-dot" aria-hidden="true" />}
        </button>
        <Link
          to="/calendar"
          className="btn btn-ghost btn-icon gamesHeader-tool"
          aria-label={t("calendar.title")}
          data-analytics-label="games-open-calendar"
          title={t("calendar.title")}
        >
          <Icon name="calendar-02" size={14} />
        </Link>
      </header>

      {/* One skill row: All + S1…S6. Re-tap an active level to clear. */}
      <div className="skillChips" role="tablist" aria-label={t("games.filter.skill")}>
        {FILTER_OPTIONS.map((s) => {
          const isActive = skill === s;
          return (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`chip ${isActive ? "chip-active" : ""}`}
              onClick={() =>
                setSkill((prev) => (prev === s && s !== "ALL" ? "ALL" : s))
              }
            >
              <span>{skillChipLabel(s)}</span>
            </button>
          );
        })}
      </div>

      {showFilters && (
        <section className="card gamesFilters">
          <h2 className="formSection-title">
            <span className="formSection-num">
              <Icon name="filter" size={12} />
            </span>
            {t("games.filter.apply")}
          </h2>

          <div className="field">
            <label className="field-label">{t("games.filter.dateFrom")}</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field-label">{t("games.filter.dateTo")}</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field-label">{t("games.filter.spots")}</label>
            <input
              type="number"
              min={0}
              value={spotsMin}
              onChange={(e) => setSpotsMin(e.target.value)}
              placeholder={t("games.filter.any")}
            />
          </div>
          <div className="field">
            <label className="field-label">{t("games.filter.search")}</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          <button className="btn btn-ghost" onClick={clearAll} type="button">
            <Icon name="cancel-01" size={14} />
            {t("games.filter.clear")}
          </button>
        </section>
      )}

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
            <Icon name="tennis-ball" size={24} />
          </div>
          <div className="empty-state-title">{t("games.empty")}</div>
        </div>
      )}

      {gamesQ.data?.map((g) => (
        <GameCard key={g.id} game={g} />
      ))}
    </div>
  );
}
