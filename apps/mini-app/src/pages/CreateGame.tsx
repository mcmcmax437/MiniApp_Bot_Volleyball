import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import {
  useApi,
  SkillLevel,
  SKILL_LEVELS,
  SKILL_LEVEL_LABELS,
} from '../api';
import { Icon, IconName } from '../Icon';
import './CreateGame.css';

const SKILL_ICONS: Record<SkillLevel, IconName> = {
  LEVEL_1: "tennis-ball",
  LEVEL_2: "user-account",
  LEVEL_3: "user-group",
  LEVEL_4: "award-01",
  LEVEL_5: "crown",
  LEVEL_6: "fire",
};

function toIsoLocal(value: string): string {
  return new Date(value).toISOString();
}

function defaultStartAt(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 24);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CreateGamePage() {
  const api = useApi();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const cityQ = useQuery(['default-city'], () => api.defaultCity());
  const venuesQ = useQuery(['venues', cityQ.data?.city], () =>
    api.listVenues({ city: cityQ.data?.city ?? undefined }),
  );

  const [venueId, setVenueId] = useState('');
  const [startAt, setStartAt] = useState(defaultStartAt());
  const [durationHours, setDurationHours] = useState(2);
  const [skill, setSkill] = useState<SkillLevel>('LEVEL_3');
  const [spotsTotal, setSpotsTotal] = useState(10);
  const [totalCost, setTotalCost] = useState(0);
  const [notes, setNotes] = useState('');

  const selectedVenue = useMemo(
    () => venuesQ.data?.find((v) => v.id === venueId),
    [venuesQ.data, venueId],
  );

  const [costTouched, setCostTouched] = useState(false);
  const suggestedCost = selectedVenue ? selectedVenue.hourlyPrice * durationHours : 0;
  const finalCost = costTouched ? totalCost : suggestedCost;
  const perPlayer = spotsTotal > 0 ? (finalCost / spotsTotal / 100).toFixed(2) : '0.00';

  const endAtIso = useMemo(() => {
    const start = new Date(toIsoLocal(startAt));
    const end = new Date(start.getTime() + durationHours * 3600_000);
    return end.toISOString();
  }, [startAt, durationHours]);

  const createMut = useMutation(
    () =>
      api.createGame({
        venueId,
        startAt: toIsoLocal(startAt),
        endAt: endAtIso,
        skillLevel: skill,
        spotsTotal,
        totalCost: finalCost,
        notes: notes || undefined,
      }),
    {
      onSuccess: (g) => {
        qc.invalidateQueries(['games']);
        navigate(`/games/${g.id}`);
      },
    },
  );

  if (venuesQ.isLoading) {
    return (
      <div className="createPage">
        <div className="skeleton" style={{ width: '60%', height: 24, marginBottom: 24 }} />
        <div className="skeleton" style={{ width: '100%', height: 48, marginBottom: 16, borderRadius: 12 }} />
        <div className="skeleton" style={{ width: '100%', height: 48, marginBottom: 16, borderRadius: 12 }} />
        <div className="skeleton" style={{ width: '100%', height: 120, borderRadius: 12 }} />
      </div>
    );
  }

  const canSubmit = !!venueId && !createMut.isLoading;

  return (
    <form
      className="createForm"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) createMut.mutate();
      }}
    >
      {/* === Header === */}
      <header className="createHeader">
        <div className="createHeader-icon">
          <Icon name="plus-sign" size={20} />
        </div>
        <div>
          <h1 className="createHeader-title">New game</h1>
          <p className="createHeader-sub">Fill in the details and invite players</p>
        </div>
      </header>

      {/* === Section: Where === */}
      <section className="formSection">
        <h2 className="formSection-title">
          <span className="formSection-num">1</span>
          Where
        </h2>
        <div className="field">
          <label className="field-label" htmlFor="venue">
            <Icon name="building-01" size={12} className="icon-inline" />
            Venue
          </label>
          <select id="venue" value={venueId} onChange={(e) => setVenueId(e.target.value)}>
            <option value="">— select a venue —</option>
            {venuesQ.data?.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} · {v.address}
              </option>
            ))}
          </select>
          {selectedVenue && (
            <div className="venueSelected">
              <div className="venueSelected-icon">
                <Icon name={selectedVenue.indoor ? "building-01" : "maps"} size={16} />
              </div>
              <div className="venueSelected-info">
                <div className="venueSelected-name">{selectedVenue.name}</div>
                <div className="venueSelected-meta">
                  <span className="tag info">{selectedVenue.indoor ? "Indoor" : "Outdoor"}</span>
                  <span className="tag">Up to {selectedVenue.capacity} players</span>
                  <span className="venueSelected-price">
                    {(selectedVenue.hourlyPrice / 100).toFixed(2)} / hr
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* === Section: When === */}
      <section className="formSection">
        <h2 className="formSection-title">
          <span className="formSection-num">2</span>
          When
        </h2>
        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="start">
              <Icon name="calendar-01" size={12} className="icon-inline" />
              Start
            </label>
            <input
              id="start"
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
            />
          </div>
          <div className="field" style={{ maxWidth: 120 }}>
            <label className="field-label" htmlFor="duration">
              <Icon name="clock-01" size={12} className="icon-inline" />
              Hours
            </label>
            <input
              id="duration"
              type="number"
              min={1}
              max={6}
              value={durationHours}
              onChange={(e) => setDurationHours(Number(e.target.value) || 2)}
            />
          </div>
        </div>
      </section>

      {/* === Section: Who === */}
      <section className="formSection">
        <h2 className="formSection-title">
          <span className="formSection-num">3</span>
          Who
        </h2>

        <div className="field">
          <label className="field-label">
            <Icon name="award-01" size={12} className="icon-inline" />
            Skill level
          </label>
          <div className="skillGrid">
            {SKILL_LEVELS.map((s, i) => (
              <button
                type="button"
                key={s}
                className={`skillCard ${skill === s ? "skillCard-active" : ""}`}
                onClick={() => setSkill(s)}
                aria-pressed={skill === s}
              >
                <div className="skillCard-num">{i + 1}</div>
                <Icon name={SKILL_ICONS[s]} size={18} />
                <span className="skillCard-label">{SKILL_LEVEL_LABELS[s]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="spots">
            <Icon name="user-group" size={12} className="icon-inline" />
            Total spots
          </label>
          <div className="spotsStepper">
            <button
              type="button"
              className="stepperBtn"
              onClick={() => setSpotsTotal((s) => Math.max(2, s - 1))}
              aria-label="Decrease spots"
            >
              <Icon name="arrow-down-01" size={14} />
            </button>
            <input
              id="spots"
              type="number"
              min={2}
              max={selectedVenue?.capacity ?? 40}
              value={spotsTotal}
              onChange={(e) => setSpotsTotal(Math.max(2, Number(e.target.value) || 2))}
              className="stepperInput"
            />
            <button
              type="button"
              className="stepperBtn"
              onClick={() =>
                setSpotsTotal((s) => Math.min(selectedVenue?.capacity ?? 40, s + 1))
              }
              aria-label="Increase spots"
            >
              <Icon name="arrow-up-01" size={14} />
            </button>
          </div>
          {selectedVenue && (
            <div className="field-hint">Venue max: {selectedVenue.capacity} players</div>
          )}
        </div>
      </section>

      {/* === Section: Cost === */}
      <section className="formSection">
        <h2 className="formSection-title">
          <span className="formSection-num">4</span>
          Cost
        </h2>
        <div className="field">
          <label className="field-label" htmlFor="cost">
            <Icon name="dollar-01" size={12} className="icon-inline" />
            Total court cost (minor units)
          </label>
          <input
            id="cost"
            type="number"
            min={0}
            value={finalCost}
            onChange={(e) => {
              setCostTouched(true);
              setTotalCost(Number(e.target.value) || 0);
            }}
          />
          <div className="field-hint">
            {costTouched
              ? "You set a custom amount."
              : selectedVenue
                ? `Auto: ${selectedVenue.name} × ${durationHours}h.`
                : "Select a venue to auto-fill."}
          </div>
        </div>

        <div className="costSummary">
          <div className="costSummary-row">
            <span className="costSummary-label">Per player</span>
            <span className="costSummary-value">{perPlayer}</span>
          </div>
          <div className="costSummary-row costSummary-row-total">
            <span className="costSummary-label">Split between</span>
            <span className="costSummary-value">
              {spotsTotal} player{spotsTotal === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </section>

      {/* === Section: Notes === */}
      <section className="formSection">
        <h2 className="formSection-title">
          <span className="formSection-num">5</span>
          Notes
        </h2>
        <div className="field">
          <label className="field-label" htmlFor="notes">
            <Icon name="note-01" size={12} className="icon-inline" />
            Optional message to players
          </label>
          <textarea
            id="notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Bring a light/dark shirt for teams"
          />
        </div>
      </section>

      {createMut.isError && (
        <div className="error">
          <Icon name="bell-dot" size={16} />
          <span>{(createMut.error as Error).message}</span>
        </div>
      )}

      <button type="submit" className="btn" disabled={!canSubmit}>
        <Icon name="plus-sign" size={18} />
        {createMut.isLoading ? "Creating…" : "Create game"}
      </button>
    </form>
  );
}