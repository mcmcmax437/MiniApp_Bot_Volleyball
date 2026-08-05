import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from 'react-query';
import { useApi } from '../api';
import { EvaluatePlayersModal } from '../pages/EvaluatePlayersModal';
import { isEvalDone, markEvalDone } from '../lib/eval-done';

/**
 * Global post-game rating prompt.
 *
 * Opens automatically for every participant of a FINISHED game (host Finish
 * or auto-finish at startAt + 5h) the next time they open the Mini App —
 * on Home / Games / Profile, not only on GameDetail.
 *
 * Waits for `/auth/me` before fetching — a cold start used to hit
 * `/evaluations/pending` before the JWT existed, get 401, and never retry.
 */
export function PendingEvaluationsPrompt() {
  const api = useApi();
  const qc = useQueryClient();
  const location = useLocation();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dismissedThisSession, setDismissedThisSession] = useState<string[]>([]);

  const meQ = useQuery(['me'], () => api.me(), {
    retry: false,
    staleTime: 60_000,
  });

  const pendingQ = useQuery(
    ['evaluations', 'pending'],
    () => api.listPendingEvaluations(),
    {
      enabled: !!meQ.data?.id,
      staleTime: 0,
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
      refetchInterval: 30_000,
      retry: 2,
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
