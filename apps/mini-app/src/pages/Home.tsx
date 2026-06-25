import { useEffect, useState } from "react";
import { useQuery } from "react-query";
import { Link, useNavigate } from "react-router-dom";
import { useApi } from "../api";
import { useTelegram } from "../tg";
import { Icon } from "../Icon";
import { Photo } from "../Photo";
import { SkillBadge } from "../SkillBadge";
import { useI18n } from "../i18n";
import { GameCard } from "./GameCard";
import "./Home.css";

function hasOnboardedLocally(): boolean {
  try {
    return localStorage.getItem("volley:onboarded:v1") === "1";
  } catch {
    return false;
  }
}

const STORAGE_LAT = 'volley:lat:v1';
const STORAGE_LNG = 'volley:lng:v1';

export function HomePage() {
  const api = useApi();
  const { user, webApp, photoUrl } = useTelegram();
  const { t } = useI18n();
  const meQ = useQuery(["me"], () => api.me(), {
    refetchOnMount: "always",
    staleTime: 0,
  });
  const cityQ = useQuery(["default-city"], () => api.defaultCity());
  const gamesQ = useQuery(
    ["games", cityQ.data?.city, "HOME"],
    () => api.listGames({ city: cityQ.data?.city ?? undefined }),
    { enabled: !!cityQ.data },
  );
  const navigate = useNavigate();

  const [locating, setLocating] = useState(false);
  const firstName = meQ.data?.firstName ?? user?.first_name ?? "friend";
  const city = meQ.data?.city ?? cityQ.data?.city ?? "your city";
  const openGames = (gamesQ.data ?? []).filter((g) => g.status === "OPEN");
  const nextGames = (gamesQ.data ?? []).slice(0, 3);
  const needsOnboarding =
    meQ.data != null &&
    meQ.data.skillLevel == null &&
    !hasOnboardedLocally();

  // Try to geolocate once on first mount, if user has not stored coords yet.
  useEffect(() => {
    if (!navigator.geolocation) return;
    try {
      if (localStorage.getItem(STORAGE_LAT)) return;
    } catch {}
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          localStorage.setItem(STORAGE_LAT, String(pos.coords.latitude));
          localStorage.setItem(STORAGE_LNG, String(pos.coords.longitude));
        } catch {}
        try {
          await api.updateMe({ lat: pos.coords.latitude, lng: pos.coords.longitude } as any);
          qcRefetchMe();
        } catch {}
      },
      () => undefined,
      { timeout: 6000, enableHighAccuracy: false, maximumAge: 600_000 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function qcRefetchMe() {
    // small wrapper — kept inline to avoid import bloat for a single call
    meQ.refetch?.();
  }

  const requestLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          localStorage.setItem(STORAGE_LAT, String(pos.coords.latitude));
          localStorage.setItem(STORAGE_LNG, String(pos.coords.longitude));
        } catch {}
        try {
          await api.updateMe({ lat: pos.coords.latitude, lng: pos.coords.longitude } as any);
        } finally {
          setLocating(false);
          meQ.refetch();
          cityQ.refetch();
          gamesQ.refetch();
        }
      },
      () => setLocating(false),
      { timeout: 8000, enableHighAccuracy: false, maximumAge: 60_000 },
    );
  };

  const goCreate = () => {
    webApp?.HapticFeedback?.impactOccurred?.("medium");
    navigate("/create");
  };
  const goGames = () => navigate("/games");
  const goCalendar = () => navigate("/calendar");
  const goWelcome = () => {
    webApp?.HapticFeedback?.impactOccurred?.("light");
    navigate("/welcome");
  };

  return (
    <div className="home">
      <header className="home-hero">
        <div className="home-hero-text">
          <div className="home-hero-eyebrow">
            <Icon name="map-pin" size={12} />
            <span>{city}</span>
            <button
              type="button"
              className="home-hero-locateBtn"
              onClick={requestLocation}
              disabled={locating}
              aria-label="Use my location"
              data-analytics-label="home-use-location"
            >
              <Icon name={locating ? "loading" : "target"} size={11} />
            </button>
          </div>
          <h1 className="home-hero-title">
            {t('home.hello', { name: firstName })}
            <span className="wave" aria-hidden="true">👋</span>
          </h1>
          <p className="home-hero-sub">
            {openGames.length > 0
              ? `${openGames.length} open game${openGames.length === 1 ? "" : "s"} in your city.`
              : "No games yet — be the first to organize one."}
          </p>
        </div>
        <div className="home-hero-photoWrap">
          {meQ.data?.photoUrl || photoUrl ? (
            <Photo
              src={meQ.data?.photoUrl ?? photoUrl}
              name={firstName}
              size={56}
            />
          ) : (
            <div className="home-hero-mascot" aria-hidden="true">
              <div className="mascot-glow" />
              <div className="mascot-orbit" />
              <img className="mascot-img" src="/robot.png" alt="" />
            </div>
          )}
          {meQ.data?.skillLevel && (
            <span className="skillBadge-on-photo">
              <SkillBadge level={meQ.data.skillLevel} size="md" />
            </span>
          )}
        </div>
      </header>

      {needsOnboarding && (
        <button type="button" className="home-onboardBanner" onClick={goWelcome}>
          <div className="home-onboardBanner-icon">
            <Icon name="award-01" size={18} />
          </div>
          <div className="home-onboardBanner-text">
            <div className="home-onboardBanner-title">{t('home.pickYourLevel')}</div>
            <div className="home-onboardBanner-sub">{t('home.pickYourLevelSub')}</div>
          </div>
          <Icon name="arrow-right-01" size={16} />
        </button>
      )}

      <button className="hero-cta" onClick={goCreate}>
        <div className="hero-cta-content">
          <div className="hero-cta-icon">
            <Icon name="plus-sign" size={22} />
          </div>
          <div>
            <div className="hero-cta-title">{t('home.createGame')}</div>
            <div className="hero-cta-sub">Invite players in seconds</div>
          </div>
        </div>
        <div className="hero-cta-arrow">
          <Icon name="calendar-01" size={18} />
        </div>
      </button>

      <button className="hero-cta hero-cta-secondary" onClick={goCalendar}>
        <div className="hero-cta-content">
          <div className="hero-cta-icon">
            <Icon name="calendar-02" size={20} />
          </div>
          <div>
            <div className="hero-cta-title">{t('calendar.title')}</div>
            <div className="hero-cta-sub">Plan your weeks</div>
          </div>
        </div>
        <div className="hero-cta-arrow">
          <Icon name="arrow-right-01" size={18} />
        </div>
      </button>

      <div className="stat-strip">
        <div className="stat">
          <div className="stat-value">{openGames.length}</div>
          <div className="stat-label">Open games</div>
        </div>
        <div className="stat-divider" />
        <div className="stat">
          <div className="stat-value">
            {openGames.reduce((sum, g) => sum + (g.spotsTotal - g.participantsCount), 0)}
          </div>
          <div className="stat-label">Free spots</div>
        </div>
        <div className="stat-divider" />
        <div className="stat">
          <div className="stat-value">{gamesQ.data?.length ?? 0}</div>
          <div className="stat-label">All games</div>
        </div>
      </div>

      <section className="section">
        <div className="section-header">
          <h2 className="section-title">
            <span className="section-title-icon">
              <Icon name="calendar-01" size={16} />
            </span>
            {t('home.upcomingGames')}
          </h2>
          <Link to="/calendar" className="section-action" data-analytics-label="home-see-calendar">
            {t('calendar.title')}
            <Icon name="arrow-right-01" size={12} />
          </Link>
        </div>

        {gamesQ.isLoading && (
          <>
            {[0, 1, 2].map((i) => (
              <div key={i} className="card" style={{ marginBottom: 12, height: 130 }}>
                <div className="skeleton" style={{ width: '60%', height: 18, marginBottom: 8 }} />
                <div className="skeleton" style={{ width: '40%', height: 14, marginBottom: 16 }} />
                <div className="skeleton" style={{ width: '100%', height: 32, borderRadius: 10 }} />
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
            <div className="empty-state-title">{t('home.noGames')}</div>
            <div className="empty-state-text">
              Be the first to organize a volleyball game in {city}. Tap "Create Game" to start.
            </div>
          </div>
        )}

        {nextGames.map((g) => (
          <GameCard key={g.id} game={g} />
        ))}
      </section>
    </div>
  );
}