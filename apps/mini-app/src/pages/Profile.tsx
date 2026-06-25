import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useApi, ApiUser } from '../api';
import { Icon } from '../Icon';
import './Profile.css';

const SKILLS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PRO'] as const;
type Skill = (typeof SKILLS)[number];

const REMINDER_PRESETS: { label: string; offsets: number[] }[] = [
  { label: '24h + 2h + 30m', offsets: [1440, 120, 30] },
  { label: '2h + 30m', offsets: [120, 30] },
  { label: '1h only', offsets: [60] },
  { label: 'Off', offsets: [] },
];

export function ProfilePage() {
  const api = useApi();
  const qc = useQueryClient();
  const meQ = useQuery<ApiUser | null>(['me'], () => api.me());

  const [age, setAge] = useState<number | ''>('');
  const [skill, setSkill] = useState<Skill | ''>('');
  const [city, setCity] = useState('');
  const [offsets, setOffsets] = useState<number[]>([]);

  useEffect(() => {
    if (!meQ.data) return;
    setAge(meQ.data.age ?? '');
    setSkill(meQ.data.skillLevel ?? '');
    setCity(meQ.data.city);
    setOffsets(meQ.data.reminderOffsets ?? []);
  }, [meQ.data]);

  const save = useMutation(
    () =>
      api.updateMe({
        age: age === '' ? undefined : Number(age),
        skillLevel: skill === '' ? undefined : (skill as Skill),
        city: city || undefined,
        reminderOffsets: offsets,
      }),
    { onSuccess: () => qc.invalidateQueries(['me']) },
  );

  if (meQ.isLoading) return <div className="empty">Loading…</div>;
  if (!meQ.data) return <div className="empty">Sign in first.</div>;

  return (
    <div className="profilePage">
      <h3>Your profile</h3>
      <div className="profileHeader">
        <span>
          {meQ.data.firstName} {meQ.data.lastName ?? ''}{' '}
          {meQ.data.username && <span className="tag">@{meQ.data.username}</span>}
        </span>
      </div>

      <div className="field">
        <label>Age</label>
        <input
          type="number"
          min={5}
          max={120}
          value={age}
          onChange={(e) => setAge(e.target.value === '' ? '' : Number(e.target.value))}
        />
      </div>

      <div className="field">
        <label>Skill level</label>
        <select value={skill} onChange={(e) => setSkill(e.target.value as Skill)}>
          <option value="">— select —</option>
          {SKILLS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>City</label>
        <input value={city} onChange={(e) => setCity(e.target.value)} />
      </div>

      <div className="field">
        <label>
          <Icon name="bell-dot" className="icon-inline" />
          Reminders
        </label>
        {REMINDER_PRESETS.map((p) => (
          <label key={p.label} style={{ display: 'block', padding: '6px 0' }}>
            <input
              type="radio"
              name="reminders"
              checked={JSON.stringify(offsets) === JSON.stringify(p.offsets)}
              onChange={() => setOffsets(p.offsets)}
            />{' '}
            {p.label}
          </label>
        ))}
      </div>

      <button className="btn" disabled={save.isLoading} onClick={() => save.mutate()}>
        Save
      </button>
      {save.isError && <div className="error">{(save.error as Error).message}</div>}
      {save.isSuccess && <div className="row" style={{ color: 'var(--good)', marginTop: 8 }}>Saved.</div>}
    </div>
  );
}
