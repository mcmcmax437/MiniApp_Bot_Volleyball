import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useApi, ApiUser } from '../api';
import { Icon, IconName } from '../Icon';
import './Profile.css';

const SKILLS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PRO'] as const;
type Skill = (typeof SKILLS)[number];

const REMINDER_PRESETS: {
  label: string;
  description: string;
  icon: string;
  offsets: number[];
}[] = [
  { label: '24h + 2h + 30m', description: 'All the reminders', icon: 'bell-dot', offsets: [1440, 120, 30] },
  { label: '2h + 30m', description: 'Just before the game', icon: 'clock-01', offsets: [120, 30] },
  { label: '1h only', description: 'Last-minute heads-up', icon: 'clock-01', offsets: [60] },
  { label: 'Off', description: "Don't notify me", icon: 'cancel-01', offsets: [] },
];

function skillIcon(s: Skill): IconName {
  switch (s) {
    case "BEGINNER": return "user-account";
    case "INTERMEDIATE": return "user-group";
    case "ADVANCED": return "award-01";
    case "PRO": return "fire";
  }
}

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
    {
      onSuccess: () => {
        qc.invalidateQueries(['me']);
      },
    },
  );

  if (meQ.isLoading) {
    return (
      <div className="profilePage">
        <div className="skeleton" style={{ width: '60%', height: 24, marginBottom: 24 }} />
        <div className="skeleton" style={{ width: '100%', height: 80, marginBottom: 16, borderRadius: 16 }} />
        <div className="skeleton" style={{ width: '100%', height: 200, borderRadius: 16 }} />
      </div>
    );
  }
  if (!meQ.data) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <Icon name="user-account" size={24} />
        </div>
        <div className="empty-state-title">Not signed in</div>
        <div className="empty-state-text">Open this Mini App from Telegram to set up your profile.</div>
      </div>
    );
  }

  const initials = `${meQ.data.firstName?.[0] ?? ''}${meQ.data.lastName?.[0] ?? ''}`.toUpperCase();
  const canSave = !save.isLoading;

  return (
    <div className="profilePage">
      {/* === Hero: avatar + name === */}
      <header className="profileHero">
        <div className="profileAvatar" aria-hidden="true">
          <span>{initials || <Icon name="user-account" size={28} />}</span>
        </div>
        <div className="profileHero-info">
          <h1 className="profileHero-name">
            {meQ.data.firstName} {meQ.data.lastName ?? ''}
          </h1>
          {meQ.data.username && (
            <div className="profileHero-username">
              <Icon name="user-account" size={12} className="icon-inline" />
              @{meQ.data.username}
            </div>
          )}
        </div>
      </header>

      {/* === Section: About you === */}
      <section className="formSection">
        <h2 className="formSection-title">
          <span className="formSection-num">
            <Icon name="user-account" size={12} />
          </span>
          About you
        </h2>

        <div className="card profileCard">
          <div className="field" style={{ marginBottom: 14 }}>
            <label className="field-label" htmlFor="age">
              <Icon name="calendar-01" size={12} className="icon-inline" />
              Age
            </label>
            <input
              id="age"
              type="number"
              min={5}
              max={120}
              value={age}
              onChange={(e) => setAge(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Optional"
            />
          </div>

          <div className="field" style={{ marginBottom: 14 }}>
            <label className="field-label" htmlFor="city">
              <Icon name="map-pin" size={12} className="icon-inline" />
              City
            </label>
            <input
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Kyiv"
            />
          </div>
        </div>
      </section>

      {/* === Section: Skill === */}
      <section className="formSection">
        <h2 className="formSection-title">
          <span className="formSection-num">
            <Icon name="award-01" size={12} />
          </span>
          Your skill
        </h2>
        <div className="skillGrid">
          {SKILLS.map((s) => (
            <button
              type="button"
              key={s}
              className={`skillCard ${skill === s ? "skillCard-active" : ""}`}
              onClick={() => setSkill(s)}
              aria-pressed={skill === s}
            >
              <Icon name={skillIcon(s)} size={18} />
              <span>{s.charAt(0) + s.slice(1).toLowerCase()}</span>
            </button>
          ))}
        </div>
      </section>

      {/* === Section: Reminders === */}
      <section className="formSection">
        <h2 className="formSection-title">
          <span className="formSection-num">
            <Icon name="bell-dot" size={12} />
          </span>
          Reminders
        </h2>

        <div className="reminderList">
          {REMINDER_PRESETS.map((p) => {
            const isActive = JSON.stringify(offsets) === JSON.stringify(p.offsets);
            return (
              <button
                type="button"
                key={p.label}
                className={`reminderOption ${isActive ? "reminderOption-active" : ""}`}
                onClick={() => setOffsets(p.offsets)}
                aria-pressed={isActive}
              >
                <div className="reminderOption-icon">
                  <Icon name={p.icon as any} size={18} />
                </div>
                <div className="reminderOption-text">
                  <div className="reminderOption-label">{p.label}</div>
                  <div className="reminderOption-desc">{p.description}</div>
                </div>
                <div className="reminderOption-radio">
                  <span className="radio-dot" />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {save.isError && (
        <div className="error">
          <Icon name="bell-dot" size={16} />
          <span>{(save.error as Error).message}</span>
        </div>
      )}

      {save.isSuccess && (
        <div className="success-banner">
          <Icon name="check-unread-01" size={16} />
          <span>Profile saved</span>
        </div>
      )}

      <button
        type="button"
        className="btn"
        disabled={!canSave}
        onClick={() => save.mutate()}
      >
        <Icon name="check-unread-01" size={18} />
        {save.isLoading ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}