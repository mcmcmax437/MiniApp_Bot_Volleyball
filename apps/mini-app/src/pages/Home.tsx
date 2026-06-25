import { useQuery } from "react-query";
import { useNavigate } from "react-router-dom";
import { useApi } from "../api";
import { useTelegram } from "../tg";
import { Icon } from "../Icon";
import { Photo } from "../Photo";
import { GameCard } from "./GameCard";
import "./Home.css";

export function HomePage() {
  const api = useApi();
  const { user, webApp, photoUrl } = useTelegram();
  const meQ = useQuery(["me"], () => api.me());
  const cityQ = useQuery(["default-city"], () => api.defaultCity());
  const gamesQ = useQuery(
    ["games", cityQ.data?.city, "HOME"],
    () => api.listGames({ city: cityQ.data?.city ?? undefined }),
    { enabled: !!cityQ.data },
  );
  const navigate = useNavigate();

  const firstName = meQ.data?.firstName ?? user?.first_name ?? "friend";
  const city = meQ.data?.city ?? cityQ.data?.city ?? "your city";
  const openGames = (gamesQ.data ?? []).filter((g) => g.status === "OPEN");
  const nextGames = (gamesQ.data ?? []).slice(0, 3);
  const needsOnboarding = meQ.data != null && meQ.data.skillLevel == null;

  const goCreate = () => {
    webApp?.HapticFeedback?.impactOccurred?.("medium");
    navigate("/create");
  };
  const goGames = () => navigate("/games");
  const goWelcome = () => {
    webApp?.HapticFeedback?.impactOccurred?.("light");
    navigate("/welcome");
  };

  return (
    <div className="home">
      {/* === Hero === */}
      <header className="home-hero">
        <div className="home-hero-text">
          <div className="home-hero-eyebrow">
            <Icon name="map-pin" size={12} />
            <span>{city}</span>
          </div>
          <h1 className="home-hero-title">
            Hi, {firstName}!
            <span className="wave" aria-hidden="true">👋</span>
          </h1>
          <p className="home-hero-sub">
            {openGames.length > 0
              ? `${openGames.length} open game${openGames.length === 1 ? "" : "s"} in your city.`
              : "No games yet — be the first to organize one."}
          </p>
        </div>
        {meQ.data?.photoUrl || photoUrl ? (
          <div className="home-hero-avatar">
            <Photo
              src={meQ.data?.photoUrl ?? photoUrl}
              name={firstName}
              size={56}
            />
          </div>
        ) : (
          <div className="home-hero-mascot" aria-hidden="true">
            <div className="mascot-glow" />
            <div className="mascot-orbit" />
            <img className="mascot-img" src="/robot.png" alt="" />
          </div>
        )}
      </header>

      {/* === Onboarding banner (only if user hasn't picked a level yet) === */}
      {needsOnboarding && (
        <button type="button" className="home-onboardBanner" onClick={goWelcome}>
          <div className="home-onboardBanner-icon">
            <Icon name="award-01" size={18} />
          </div>
          <div className="home-onboardBanner-text">
            <div className="home-onboardBanner-title">Pick your playing level</div>
            <div className="home-onboardBanner-sub">Get matched with the right games in 30 seconds</div>
          </div>
          <Icon name="arrow-right-01" size={16} />
        </button>
      )}

      {/* === Quick action card with robot's job === */}
      <button className="hero-cta" onClick={goCreate}>
        <div className="hero-cta-content">
          <div className="hero-cta-icon">
            <Icon name="plus-sign" size={22} />
          </div>
          <div>
            <div className="hero-cta-title">Create a game</div>
            <div className="hero-cta-sub">Invite players in seconds</div>
          </div>
        </div>
        <div className="hero-cta-arrow">
          <Icon name="calendar-01" size={18} />
        </div>
      </button>

      {/* === Stats strip === */}
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

      {/* === Upcoming Games section === */}
      <section className="section">
        <div className="section-header">
          <h2 className="section-title">
            <span className="section-title-icon">
              <Icon name="calendar-01" size={16} />
            </span>
            Upcoming Games
          </h2>
          <button className="section-action" onClick={goGames}>
            View all
            <Icon name="clock-01" size={12} />
          </button>
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
            <div className="empty-state-title">No games yet</div>
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