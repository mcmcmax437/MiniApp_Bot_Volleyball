import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../api';
import './CreateGame.css';

const SKILLS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PRO'] as const;
type Skill = (typeof SKILLS)[number];

function toIsoLocal(value: string): string {
  // value like "2025-09-12T19:00" -> ISO
  return new Date(value).toISOString();
}

function defaultStartAt(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 24);
  // local datetime-local format
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
  const [skill, setSkill] = useState<Skill>('INTERMEDIATE');
  const [spotsTotal, setSpotsTotal] = useState(10);
  const [totalCost, setTotalCost] = useState(0); // in minor units
  const [notes, setNotes] = useState('');

  const selectedVenue = useMemo(
    () => venuesQ.data?.find((v) => v.id === venueId),
    [venuesQ.data, venueId],
  );

  // Suggest totalCost when venue or duration changes (only if user hasn't edited).
  const [costTouched, setCostTouched] = useState(false);
  const suggestedCost = selectedVenue
    ? selectedVenue.hourlyPrice * durationHours
    : 0;

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
        totalCost: costTouched ? totalCost : suggestedCost,
        notes: notes || undefined,
      }),
    {
      onSuccess: (g) => {
        qc.invalidateQueries(['games']);
        navigate(`/games/${g.id}`);
      },
    },
  );

  if (venuesQ.isLoading) return <div className="empty">Loading venues…</div>;

  return (
    <>
      <div className="createPage">
        <h3>New game</h3>

        <div className="field">
          <label>Venue</label>
          <select value={venueId} onChange={(e) => setVenueId(e.target.value)}>
            <option value="">— select a venue —</option>
            {venuesQ.data?.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.address})
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Start</label>
          <input
            type="datetime-local"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
          />
        </div>

        <div className="field">
          <label>Duration (hours)</label>
          <input
            type="number"
            min={1}
            max={6}
            value={durationHours}
            onChange={(e) => setDurationHours(Number(e.target.value) || 2)}
          />
        </div>

        <div className="field">
          <label>Skill level</label>
          <div className="skill-radio">
            {SKILLS.map((s) => (
              <label key={s}>
                <input
                  type="radio"
                  name="skill"
                  checked={skill === s}
                  onChange={() => setSkill(s)}
                />
                <span>{s}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Spots</label>
          <input
            type="number"
            min={2}
            max={selectedVenue?.capacity ?? 40}
            value={spotsTotal}
            onChange={(e) => setSpotsTotal(Number(e.target.value) || 2)}
          />
          {selectedVenue && (
            <div className="sub" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              Venue capacity: {selectedVenue.capacity}
            </div>
          )}
        </div>

        <div className="field">
          <label>Total court cost (minor units; 100 = 1.00)</label>
          <input
            type="number"
            min={0}
            value={costTouched ? totalCost : suggestedCost}
            onChange={(e) => {
              setCostTouched(true);
              setTotalCost(Number(e.target.value) || 0);
            }}
          />
          {!costTouched && selectedVenue && (
            <div className="sub" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              Suggested based on venue hourly price × duration.
            </div>
          )}
        </div>

        <div className="field">
          <label>Notes</label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Bring a light/dark shirt for teams"
          />
        </div>

        <button
          className="btn"
          disabled={!venueId || createMut.isLoading}
          onClick={() => createMut.mutate()}
        >
          Create game
        </button>
        {createMut.isError && <div className="error">{(createMut.error as Error).message}</div>}
      </div>
    </>
  );
}
