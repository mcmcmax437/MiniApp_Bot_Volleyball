import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from 'react-query';
import { useApi } from '../api';
import { EvaluatePlayersModal } from '../pages/EvaluatePlayersModal';
import { isEvalDone, markEvalDone } from '../lib/eval-done';

/**
 * Global post-game rating prompt.
 *
 * Every participant of a FINISHED game (not just the host) should be asked
 * to rate co-players the next time they open the app. This component lives
 * at the App shell so it fires on Home / Games / Profile / etc., not only
 * when someone happens to open that game's detail page.
 *
 * Dismiss (X / Skip) or a successful submit marks the game done locally
 * via `markEvalDone`, so we never re-prompt for it.
 *
 * When the user is already on `/games/:id` for the pending game, we stay
 * out of the way — GameDetail owns the modal there (including the host's
 * immediate post-finish prompt).
 */
export function PendingEvaluationsPrompt() {
  const api = useApi();
  const qc = useQueryClient();
  const location = useLocation();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dismissedThisSession, setDismissedThisSession] = useState<string[]>([]);

  const pendingQ = useQuery(
    ['evaluations', 'pending'],
    () => api.listPendingEvaluations(),
    {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
    },
  );

  const nextId = useMemo(() => {
    const games = pendingQ.data?.games ?? [];
    return (
      games.find(
        (g) => !isEvalDone(g.id) && !dismissedThisSession.includes(g.id),
      )?.id ?? null
    );
  }, [pendingQ.data, dismissedThisSession]);

  useEffect(() => {
    if (nextId && nextId !== activeId) {
      setActiveId(nextId);
    }
    if (!nextId && activeId) {
      setActiveId(null);
    }
  }, [nextId, activeId]);

  if (!activeId) return null;
  // GameDetail already shows the evaluate modal for this game.
  if (location.pathname === `/games/${activeId}`) return null;

  const finish = () => {
    markEvalDone(activeId);
    setDismissedThisSession((prev) =>
      prev.includes(activeId) ? prev : [...prev, activeId],
    );
    setActiveId(null);
    qc.invalidateQueries(['evaluations', 'pending']);
    qc.invalidateQueries(['me']);
  };

  return (
    <EvaluatePlayersModal
      open
      gameId={activeId}
      onClose={finish}
    />
  );
}
