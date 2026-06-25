import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "react-query";
import {
  useApi,
  ApiUser,
  SkillLevel,
  SKILL_LEVELS,
  SKILL_LEVEL_LABELS,
  SKILL_LEVEL_DESCRIPTIONS,
} from "../api";
import { Icon, IconName } from "../Icon";
import { Photo } from "../Photo";
import "./Profile.css";

const REMINDER_PRESETS: {
  label: string;
  description: string;
  icon: string;
  offsets: number[];
}[] = [
  { label: "24h + 2h + 30m", description: "All the reminders", icon: "bell-dot", offsets: [1440, 120, 30] },
  { label: "2h + 30m", description: "Just before the game", icon: "clock-01", offsets: [120, 30] },
  { label: "1h only", description: "Last-minute heads-up", icon: "clock-01", offsets: [60] },
  { label: "Off", description: "Don't notify me", icon: "cancel-01", offsets: [] },
];

const SKILL_ICONS: Record<SkillLevel, IconName> = {
  LEVEL_1: "tennis-ball",
  LEVEL_2: "user-account",
  LEVEL_3: "user-group",
  LEVEL_4: "award-01",
  LEVEL_5: "crown",
  LEVEL_6: "fire",
};

export function ProfilePage() {
  const api = useApi();
  const qc = useQueryClient();
  const meQ = useQuery<ApiUser | null>(["me"], () => api.me());

  const [age, setAge] = useState<number | "">("");
  const [skill, setSkill] = useState<SkillLevel | "">("");
  const [city, setCity] = useState("");
  const [offsets, setOffsets] = useState<number[]>([]);

  useEffect(() => {
    if (!meQ.data) return;
    setAge(meQ.data.age ?? "");
    setSkill(meQ.data.skillLevel ?? "");
    setCity(meQ.data.city);
    setOffsets(meQ.data.reminderOffsets ?? []);
  }, [meQ.data]);

  const save = useMutation(
    () =>
      api.updateMe({
        age: age === "" ? undefined : Number(age),
        skillLevel: skill === "" ? undefined : skill,
        city: city || undefined,
        reminderOffsets: offsets,
      }),
    {
      onSuccess: () => {
        qc.invalidateQueries(["me"]);
      },
    },
  );

  if (meQ.isLoading) {
    return (
      <div className="profilePage">
        <div className="skeleton" style={{ width: "60%", height: 24, marginBottom: 24 }} />
        <div className="skeleton" style={{ width: "100%", height: 80, marginBottom: 16, borderRadius: 16 }} />
        <div className="skeleton" style={{ width: "100%", height: 200, borderRadius: 16 }} />
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

  const canSave = !save.isLoading;
  const fullName =
    `${meQ.data.firstName}${meQ.data.lastName ? " " + meQ.data.lastName : ""}`;
  const isAdmin = meQ.data.role === "ADMIN";

  return (
    <div className="profilePage">
      {/* === Hero: real photo + name === */}
      <header className="profileHero">
        <Photo src={meQ.data.photoUrl} name={fullName} size={84} />
        <div className="profileHero-info">
          <h1 className="profileHero-name">
            {meQ.data.firstName} {meQ.data.lastName ?? ""}
          </h1>
          <div className="profileHero-meta">
            {meQ.data.username && (
              <span className="profileHero-username">@{meQ.data.username}</span>
            )}
            {isAdmin && (
              <span className="profileHero-badge profileHero-badge-admin">
                <Icon name="crown" size={11} />
                Admin
              </span>
            )}
          </div>
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
              onChange={(e) => setAge(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="Optional"
            />
          </div>

          <div className="field">
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

      {/* === Section: Skill (6 levels) === */}
      <section className="formSection">
        <h2 className="formSection-title">
          <span className="formSection-num">
            <Icon name="award-01" size={12} />
          </span>
          Your skill
        </h2>
        <p className="formSection-hint">Tap a level to see its description.</p>
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
        {skill && (
          <div className="skillDescription">
            <Icon name="information-circle" size={14} />
            <span>{SKILL_LEVEL_DESCRIPTIONS[skill as SkillLevel]}</span>
          </div>
        )}
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

      {/* === Admin panel (only for admins) === */}
      {isAdmin && (
        <section className="formSection profileAdminSection">
          <h2 className="formSection-title">
            <span className="formSection-num formSection-num-admin">
              <Icon name="crown" size={12} />
            </span>
            Admin
          </h2>
          <Link
            to="/admin"
            className="adminPanelLink"
          >
            <div className="adminPanelLink-icon">
              <Icon name="security" size={20} />
            </div>
            <div className="adminPanelLink-text">
              <div className="adminPanelLink-title">Admin panel</div>
              <div className="adminPanelLink-desc">Manage users, games, and venues.</div>
            </div>
            <Icon name="arrow-right-01" size={18} />
          </Link>
        </section>
      )}

      <button
        type="button"
        className="btn profileLogout"
        onClick={async () => {
          try {
            await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" });
          } catch {}
          window.location.reload();
        }}
      >
        <Icon name="logout-01" size={18} />
        Sign out
      </button>
    </div>
  );
}