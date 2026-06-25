import { useQuery } from "react-query";
import { useNavigate } from "react-router-dom";
import { useApi } from "../api";
import { useTelegram } from "../tg";
import { Icon } from "../Icon";
import { GameCard } from "./GameCard";
import "./Home.css";

/**
 * Greeting + "Create Game" CTA + the next 3 upcoming games.
 * Mirrors the reference design (greeting header, mascot, big primary CTA,
 * "Upcoming Games" section with "View all" link).
 */
export function HomePage() {
  const api = useApi();
  const { user, webApp } = useTelegram();
  const meQ = useQuery(["me"], () => api.me());
  const cityQ = useQuery(["default-city"], () => api.defaultCity());
  const gamesQ = useQuery(
    ["games", cityQ.data?.city, "HOME"],
    () => api.listGames({ city: cityQ.data?.city ?? undefined }),
    { enabled: !!cityQ.data },
  );
  const navigate = useNavigate();

  const firstName = meQ.data?.firstName ?? user?.first_name ?? "friend";
  const nextGames = (gamesQ.data ?? []).slice(0, 3);

  const handleCreate = () => {
    // Haptic feedback on the primary action (TG-only; no-op outside)
    webApp?.HapticFeedback?.impactOccurred?.("medium");
    navigate("/create");
  };

  return (
    <div className="home">
      <header className="homeHeader">
        <div className="homeHeader-text">
          <h1>
            Hi, {firstName}! <span className="wave" aria-hidden="true">👋</span>
          </h1>
          <p className="welcomeSub">
            {nextGames.length > 0
              ? `${nextGames.length} game${nextGames.length === 1 ? "" : "s"} waiting for you.`
              : "Ready to organize a game?"}
          </p>
        </div>
        <div className="robotWrap" aria-hidden="true">
          <div className="robotGlow" />
          <img className="robot" src="/robot.png" alt="" />
        </div>
      </header>

      <button className="createButton" onClick={handleCreate}>
        <Icon name="plus-sign" size={20} />
        <span>Create Game</span>
      </button>

      <section className="gamesSection">
        <div className="sectionTitle">
          <h2>Upcoming Games</h2>
          <button className="viewAll" onClick={() => navigate("/games")}>
            View all
          </button>
        </div>

        {gamesQ.isLoading && <div className="empty">Loading games…</div>}
        {gamesQ.isError && <div className="error">{(gamesQ.error as Error).message}</div>}

        {gamesQ.data && gamesQ.data.length === 0 && (
          <div className="empty">No open games in your city yet. Tap "Create Game" to start one!</div>
        )}

        {nextGames.map((g) => (
          <GameCard key={g.id} game={g} />
        ))}
      </section>
    </div>
  );
}