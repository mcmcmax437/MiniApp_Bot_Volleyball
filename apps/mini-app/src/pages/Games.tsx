import { useState } from "react";
import { useQuery } from "react-query";
import {
  useApi,
  SkillLevel,
  SKILL_LEVELS,
  SKILL_LEVEL_LABELS,
} from "../api";
import { useI18n } from "../i18n";
import { GameCard } from "./GameCard";
import { Icon, IconName } from "../Icon";
import "./Games.css";

type SkillFilter = "ALL" | SkillLevel;
type BucketFilter = "ALL" | "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

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
  const { t } = useI18n();
  const [skill, setSkill] = useState<SkillFilter>("ALL");
  const [bucket, setBucket] = useState<BucketFilter>("ALL");
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [spotsMin, setSpotsMin] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  const cityQ = useQuery(["default-city"], () => api.defaultCity());

  const listArgs = {
    city: cityQ.data?.city ?? undefined,
    skillLevel: skill !== "ALL" ? skill : undefined,
    bucket: bucket !== "ALL" ? bucket : undefined,
    from: dateFrom ? new Date(dateFrom).toISOString() : undefined,
    to: dateTo ? new Date(dateTo + 'T23:59:59').toISOString() : undefined,
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
    skill !== "ALL" ||
    bucket !== "ALL" ||
    !!dateFrom ||
    !!dateTo ||
    !!spotsMin ||
    !!search.trim();

  const clearAll = () => {
    setSkill("ALL");
    setBucket("ALL");
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
          <h1 className="page-header-title">{t('games.title')}</h1>
          <p className="page-header-sub">
            {cityQ.data?.city ?? "your city"} · {count} game{count === 1 ? "" : "s"}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setShowFilters((s) => !s)}
          data-analytics-label="games-toggle-filters"
        >
          <Icon name="filter" size={14} />
          {filtersActive ? '•' : ''}
        </button>
      </header>

      {/* Skill filter chips */}
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
            </button>
          );
        })}
      </div>

      {/* Bucket quick filters */}
      <div className="skillChips" style={{ marginTop: 6 }}>
        {(['ALL', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as BucketFilter[]).map((b) => (
          <button
            key={b}
            className={`chip ${bucket === b ? 'chip-active' : ''}`}
            onClick={() => setBucket(b)}
          >
            {b === 'ALL' ? t('games.filter.any') : t(`games.filter.bucket.${b.toLowerCase()}`)}
          </button>
        ))}
      </div>

      {showFilters && (
        <section className="card gamesFilters">
          <h2 className="formSection-title">
            <span className="formSection-num"><Icon name="filter" size={12} /></span>
            {t('games.filter.apply')}
          </h2>

          <div className="field">
            <label className="field-label">{t('games.filter.dateFrom')}</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label">{t('games.filter.dateTo')}</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label">{t('games.filter.spots')}</label>
            <input
              type="number"
              min={0}
              value={spotsMin}
              onChange={(e) => setSpotsMin(e.target.value)}
              placeholder={t('games.filter.any')}
            />
          </div>
          <div className="field">
            <label className="field-label">{t('games.filter.search')}</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          {filtersActive && (
            <button className="btn btn-ghost" onClick={clearAll} type="button">
              <Icon name="cancel-01" size={14} />
              {t('games.filter.clear')}
            </button>
          )}
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
            <Icon name={SKILL_ICONS[skill]} size={24} />
          </div>
          <div className="empty-state-title">{t('games.empty')}</div>
        </div>
      )}

      {gamesQ.data?.map((g) => (
        <GameCard key={g.id} game={g} />
      ))}
    </div>
  );
}