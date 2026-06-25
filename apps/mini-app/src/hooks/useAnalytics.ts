import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useApi } from '../api';

type Event = {
  type: string;
  screen?: string;
  target?: string;
  meta?: Record<string, unknown>;
};

const QUEUE_KEY = 'volley:analytics:queue:v1';
const FLUSH_INTERVAL_MS = 8000;

function loadQueue(): Event[] {
  try {
    const raw = sessionStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as Event[]) : [];
  } catch {
    return [];
  }
}

function saveQueue(events: Event[]) {
  try {
    // Cap the queue so we never grow unbounded.
    const trimmed = events.slice(-200);
    sessionStorage.setItem(QUEUE_KEY, JSON.stringify(trimmed));
  } catch {
    /* ignore */
  }
}

/**
 * Installs a global click listener that funnels events into a queue, plus a
 * screen-view recorder that fires on every route change. The queue is
 * flushed to the server every `FLUSH_INTERVAL_MS` ms (or on visibility
 * change). The hook is idempotent — it can be mounted multiple times safely.
 */
export function useAnalytics() {
  const api = useApi();
  const queueRef = useRef<Event[]>(loadQueue());
  const screenRef = useRef<string>('');
  const location = useLocation();

  useEffect(() => {
    // 1. Screen view on route change
    const screen = location.pathname;
    if (screen !== screenRef.current) {
      screenRef.current = screen;
      queueRef.current.push({ type: 'screen_view', screen });
    }

    // 2. Global click listener — capture target text / data-attr
    function onClick(ev: MouseEvent) {
      const el = ev.target as HTMLElement | null;
      if (!el) return;
      // Walk up to find a labeled element
      let cur: HTMLElement | null = el;
      let label = '';
      let depth = 0;
      while (cur && depth < 6) {
        const t =
          cur.getAttribute('data-analytics-label') ??
          cur.getAttribute('aria-label') ??
          cur.textContent?.trim().slice(0, 64);
        if (t) {
          label = t;
          break;
        }
        cur = cur.parentElement;
        depth++;
      }
      if (!label) return;
      queueRef.current.push({
        type: 'click',
        screen: screenRef.current,
        target: label,
        meta: { x: ev.clientX, y: ev.clientY },
      });
    }
    document.addEventListener('click', onClick, true);

    // 3. Periodic flush
    const flush = async () => {
      if (queueRef.current.length === 0) return;
      const batch = queueRef.current.slice(-100);
      queueRef.current = [];
      saveQueue(queueRef.current);
      try {
        await api.ingestAnalytics(batch);
      } catch {
        // Re-queue on failure (capped)
        queueRef.current = batch.concat(queueRef.current).slice(-200);
        saveQueue(queueRef.current);
      }
    };

    const heartbeat = () => {
      api.heartbeat().catch(() => undefined);
    };

    const interval = window.setInterval(() => {
      flush();
      heartbeat();
    }, FLUSH_INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVisibility);
    const onBeforeUnload = () => flush();
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);
}