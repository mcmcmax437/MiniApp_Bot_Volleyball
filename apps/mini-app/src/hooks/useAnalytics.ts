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
const SESSION_KEY = 'volley:analytics:session:v1';
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

function loadSessionId(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function saveSessionId(id: string | null) {
  try {
    if (id) sessionStorage.setItem(SESSION_KEY, id);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Installs a global click listener that funnels events into a queue, plus a
 * screen-view recorder that fires on every route change. Also tracks Mini App
 * sessions (start / heartbeat / end) for admin activity trackers.
 */
export function useAnalytics() {
  const api = useApi();
  const queueRef = useRef<Event[]>(loadQueue());
  const screenRef = useRef<string>('');
  const sessionIdRef = useRef<string | null>(loadSessionId());
  const startingRef = useRef(false);
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

    // 3. Session start (once per Mini App open / tab)
    const ensureSession = async () => {
      if (sessionIdRef.current || startingRef.current) return;
      startingRef.current = true;
      try {
        const res = await api.startAnalyticsSession();
        sessionIdRef.current = res.sessionId;
        saveSessionId(res.sessionId);
      } catch {
        /* ignore — heartbeat can still bump lastActive without a session */
      } finally {
        startingRef.current = false;
      }
    };
    void ensureSession();

    // 4. Periodic flush + session heartbeat
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
      const sid = sessionIdRef.current;
      api.heartbeat(sid ?? undefined).catch(() => undefined);
    };

    const endSession = () => {
      const sid = sessionIdRef.current;
      if (!sid) return;
      // Prefer sendBeacon-style fire-and-forget; fall back to fetch.
      api.endAnalyticsSession(sid).catch(() => undefined);
      sessionIdRef.current = null;
      saveSessionId(null);
    };

    const interval = window.setInterval(() => {
      flush();
      if (!sessionIdRef.current) void ensureSession();
      else heartbeat();
    }, FLUSH_INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        flush();
        endSession();
      } else if (document.visibilityState === 'visible') {
        void ensureSession();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    const onBeforeUnload = () => {
      flush();
      endSession();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('pagehide', onBeforeUnload);

    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('pagehide', onBeforeUnload);
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);
}
