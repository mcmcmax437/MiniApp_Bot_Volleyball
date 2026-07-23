import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "react-query";
import {
  useApi,
  ApiUser,
  Language,
  SUPPORTED_LANGUAGES,
} from "../api";
import { useTelegram } from "../tg";
import { Icon, IconName } from "../Icon";
import { Photo } from "../Photo";
import { SkillBadge } from "../SkillBadge";
import { useI18n, LANG_LABELS, LANG_FLAGS } from "../i18n";
import { reverseGeocode } from "../geo";
import { effectiveSkillLevel } from "../lib/skill";
import "./Profile.css";

function scrollIntoViewSafe(el: HTMLElement) {
  setTimeout(() => {
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, 280);
}

const REMINDER_PRESETS: {
  label: string;
  description: string;
  icon: IconName;
  offsets: number[];
}[] = [
  { label: "1h only", description: "Last-minute heads-up", icon: "clock-01", offsets: [60] },
  { label: "2h + 30m", description: "Just before the game", icon: "clock-01", offsets: [120, 30] },
  { label: "24h + 2h + 30m", description: "All the reminders", icon: "bell-dot", offsets: [1440, 120, 30] },
  { label: "Off", description: "Don't notify me", icon: "cancel-01", offsets: [] },
];

function formatOffsetsSummary(offsets: number[]): string {
  if (offsets.length === 0) return "Off";
  const sorted = [...offsets].sort((a, b) => b - a);
  return sorted
    .map((m) => {
      if (m >= 60 && m % 60 === 0) {
        const h = m / 60;
        return `${h}h`;
      }
      return `${m}m`;
    })
    .join(" + ");
}

export function ProfilePage() {
  const api = useApi();
  const qc = useQueryClient();
  const { t, lang, setLang } = useI18n();
  const meQ = useQuery<ApiUser | null>(["me"], () => api.me(), {
    refetchOnMount: "always",
    staleTime: 0,
  });
  const { photoUrl: tgPhotoUrl } = useTelegram();

  const [age, setAge] = useState<number | "">("");
  const [city, setCity] = useState("");
  // Reminders default to "1h only" (matches the first preset). The section is
  // also collapsed by default — the user only sees a small chip with the
  // current summary, and taps to expand the picker if they want to change.
  const [offsets, setOffsets] = useState<number[]>([60]);
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [language, setLanguageState] = useState<Language>(lang);

  useEffect(() => {
    if (!meQ.data) return;
    setAge(meQ.data.age ?? "");
    setCity(meQ.data.city);
    setOffsets(meQ.data.reminderOffsets ?? []);
    if (meQ.data.language && SUPPORTED_LANGUAGES.includes(meQ.data.language)) {
      setLanguageState(meQ.data.language);
    }
  }, [meQ.data]);

  const save = useMutation(
    () =>
      api.updateMe({
        age: age === "" ? undefined : Number(age),
        city: city || undefined,
        reminderOffsets: offsets,
        language,
      }),
    {
      onSuccess: (updated) => {
        qc.setQueryData(["me"], updated);
        qc.invalidateQueries(["me"]);
      },
    },
  );

  // Geolocation request — best-effort, non-blocking
  const requestLocation = async () => {
    if (!navigator.geolocation) return;
    return new Promise<{ lat: number; lng: number } | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 8000, enableHighAccuracy: false, maximumAge: 600_000 },
      );
    });
  };

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
        <div className="empty-state-title">{t('empty.notSignedIn')}</div>
        <div className="empty-state-text">{t('empty.notSignedInText')}</div>
      </div>
    );
  }

  const canSave = !save.isLoading;
  const fullName =
    `${meQ.data.firstName}${meQ.data.lastName ? " " + meQ.data.lastName : ""}`;
  const isAdmin = meQ.data.isSuperAdmin;

  return (
    <div className="profilePage">
      <header className="profileHero">
        <div className="profileHero-photoWrap">
          <Photo
            src={meQ.data.photoUrl ?? tgPhotoUrl}
            name={fullName}
            size={84}
            topLeftBadge={
              isAdmin ? (
                <span className="profilePhotoStatus profilePhotoStatus-admin" title={t('profile.status.admin')}>
                  <Icon name="crown" size={10} />
                </span>
              ) : null
            }
            bottomRightBadge={
              effectiveSkillLevel(meQ.data) ? (
                <SkillBadge
                  level={effectiveSkillLevel(meQ.data)!}
                  size="sm"
                  className="skillBadge-on-photo"
                />
              ) : null
            }
          />
        </div>
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
                {t('profile.status.admin')}
              </span>
            )}
          </div>
          {effectiveSkillLevel(meQ.data) && (
            // Display-only — level is set at first onboarding, then adjusted
            // by peer ratings. No tap-to-change from Profile either.
            <div className="profileHero-skillBig" aria-label={t('profile.skill')}>
              <SkillBadge level={effectiveSkillLevel(meQ.data)!} size="md" withLabel />
            </div>
          )}
          {meQ.data.evaluatedSkillLevel && meQ.data.skillLevel &&
            meQ.data.evaluatedSkillLevel !== meQ.data.skillLevel && (
            <div className="profileHero-eval">
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                {t('profile.skillFromEvaluations', { n: 1 })}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* === Section: Quick links === */}
      <div className="profileLinks">
        <Link to="/calendar" className="profileLink" data-analytics-label="profile-calendar">
          <span className="profileLink-icon"><Icon name="calendar-02" size={16} /></span>
          {t('calendar.title')}
          <span className="profileLink-arrow"><Icon name="arrow-right-01" size={16} /></span>
        </Link>
        <Link to="/invitations" className="profileLink" data-analytics-label="profile-invitations">
          <span className="profileLink-icon"><Icon name="mail-01" size={16} /></span>
          {t('profile.invitations')}
          <span className="profileLink-arrow"><Icon name="arrow-right-01" size={16} /></span>
        </Link>
        <Link to="/blacklist" className="profileLink" data-analytics-label="profile-blacklist">
          <span className="profileLink-icon"><Icon name="user-remove-01" size={16} /></span>
          {t('profile.blacklist')}
          <span className="profileLink-arrow"><Icon name="arrow-right-01" size={16} /></span>
        </Link>
      </div>

      {/* === Section: About you === */}
      <section className="formSection">
        <h2 className="formSection-title">
          <span className="formSection-num"><Icon name="user-account" size={12} /></span>
          {t('profile.about')}
        </h2>

        <div className="card profileCard">
          <div className="field" style={{ marginBottom: 14 }}>
            <label className="field-label" htmlFor="age">
              <Icon name="calendar-01" size={12} className="icon-inline" />
              {t('profile.age')}
            </label>
            <input
              id="age"
              type="number"
              min={5}
              max={120}
              value={age}
              onChange={(e) => setAge(e.target.value === "" ? "" : Number(e.target.value))}
              onFocus={(e) => scrollIntoViewSafe(e.currentTarget)}
              placeholder={t('common.optional')}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="city">
              <Icon name="map-pin" size={12} className="icon-inline" />
              {t('profile.city')}
            </label>
            <div className="cityRow">
              <input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                onFocus={(e) => scrollIntoViewSafe(e.currentTarget)}
                placeholder="e.g. Kyiv"
                className="cityRow-input"
              />
              <button
                type="button"
                className="cityRow-locateBtn"
                onClick={async () => {
                  const pos = await requestLocation();
                  if (!pos) return;
                  const patch: Record<string, unknown> = {
                    lat: pos.lat,
                    lng: pos.lng,
                  };
                  // Try to resolve the city name from the coordinates so the
                  // city field updates — otherwise the user just sees the old
                  // default (e.g. "Kyiv") next to their real location.
                  const resolved = await reverseGeocode(pos.lat, pos.lng);
                  if (resolved) {
                    patch.city = resolved;
                    setCity(resolved);
                  }
                  await api.updateMe(patch as any);
                  qc.invalidateQueries(['me']);
                }}
                title="Use my location"
                aria-label="Use my location"
                data-analytics-label="profile-use-location"
              >
                <Icon name="map-pin" size={14} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Skill is set once during first onboarding (/welcome) and then
          adjusted only by peer ratings after games. No picker here. */}

      {/* === Section: Language === */}
      <section className="formSection">
        <h2 className="formSection-title">
          <span className="formSection-num"><Icon name="globe" size={12} /></span>
          {t('profile.language')}
        </h2>
        <div className="langGrid">
          {SUPPORTED_LANGUAGES.map((l) => (
            <button
              type="button"
              key={l}
              className={`langOption ${language === l ? "langOption-active" : ""}`}
              onClick={() => {
                setLanguageState(l);
                setLang(l); // optimistic local switch
              }}
              aria-pressed={language === l}
            >
              <span className="langOption-flag">{LANG_FLAGS[l]}</span>
              <span className="langOption-label">{LANG_LABELS[l]}</span>
            </button>
          ))}
        </div>
      </section>

      {/* === Section: Reminders (collapsible) === */}
      <section className={`formSection ${remindersOpen ? 'isOpen' : 'formSection-collapsible'}`}>
        <h2 className="formSection-title">
          <span className="formSection-num"><Icon name="bell-dot" size={12} /></span>
          Reminders
          <button
            type="button"
            className="formSection-toggle"
            onClick={() => setRemindersOpen((v) => !v)}
            aria-expanded={remindersOpen}
            aria-label="Toggle reminders"
            style={{ marginLeft: 'auto' }}
          >
            <Icon name={remindersOpen ? 'minus-sign' : 'plus-sign'} size={12} />
            {remindersOpen ? 'Hide' : 'Change'}
          </button>
        </h2>

        {!remindersOpen && (
          <button
            type="button"
            className="reminderSummary"
            onClick={() => setRemindersOpen(true)}
            aria-label="Open reminders"
          >
            <span className="reminderSummary-icon">
              <Icon name="clock-01" size={12} />
            </span>
            <span>{formatOffsetsSummary(offsets)}</span>
          </button>
        )}

        {remindersOpen && (
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
                    <Icon name={p.icon} size={18} />
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
        )}
      </section>

      {save.isError && (
        <div className="error">
          <Icon name="bell-dot" size={16} />
          <span>{(save.error as Error).message}</span>
        </div>
      )}
      {save.isSuccess && (
        <div className="success-banner">
          <Icon name="checkmark-square-01" size={16} />
          <span>{t('profile.saved')}</span>
        </div>
      )}

      <button
        type="button"
        className="btn"
        disabled={!canSave}
        onClick={() => save.mutate()}
      >
        <Icon name="checkmark-square-01" size={18} />
        {save.isLoading ? t('common.loading') : t('profile.save')}
      </button>

      <button
        type="button"
        className="btn profileLogout"
        onClick={async () => {
          if (!window.confirm(t('profile.signOutConfirm'))) return;
          try {
            await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" });
          } catch {}
          try {
            localStorage.removeItem("volley:onboarded:v1");
            localStorage.removeItem("volley:lang:v1");
            sessionStorage.removeItem("volley:analytics:queue:v1");
          } catch {}
          // Clear react-query cache so a fresh login doesn't see stale data
          qc.clear();
          // Tell Telegram WebApp we're done — this closes the mini-app.
          try {
            const tg = (window as any).Telegram?.WebApp;
            if (tg?.close) tg.close();
          } catch {}
          // Fallback reload if WebApp.close isn't available
          setTimeout(() => window.location.reload(), 250);
        }}
      >
        <Icon name="logout-01" size={18} />
        {t('profile.signOut')}
      </button>
    </div>
  );
}
