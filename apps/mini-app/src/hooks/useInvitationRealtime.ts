import { useEffect, useRef } from 'react';
import { useQueryClient } from 'react-query';

const BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api/v1';

/**
 * Opens an SSE stream so pending invitations appear as soon as the host
 * invites — without waiting for the MessageNotify poll. Cookie JWT auth
 * works same-origin (EventSource sends cookies automatically).
 *
 * On each `invite` event we invalidate the invitations react-query cache.
 * Heartbeats are ignored. On error we reconnect with exponential backoff.
 */
export function useInvitationRealtime(enabled: boolean) {
  const qc = useQueryClient();
  const backoffRef = useRef(1000);

  useEffect(() => {
    if (!enabled) return;

    let es: EventSource | null = null;
    let closed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const invalidate = () => {
      qc.invalidateQueries(['invitations', 'mine']);
    };

    const connect = () => {
      if (closed) return;
      const url = new URL(`${BASE}/invitations/stream`, window.location.origin);
      es = new EventSource(url.toString(), { withCredentials: true });

      es.addEventListener('invite', () => {
        backoffRef.current = 1000;
        invalidate();
      });

      // Some proxies strip named events; also handle generic messages.
      es.onmessage = (ev) => {
        try {
          const raw = typeof ev.data === 'string' ? ev.data : '';
          if (!raw || raw === '[DONE]') return;
          // Heartbeat / connected payloads — ignore unless they look like invites.
          if (raw.includes('invitationId') || raw.includes('"ok"')) {
            // connected hello has ok:true — don't invalidate on that.
            if (raw.includes('invitationId')) invalidate();
          }
        } catch {
          // ignore parse noise
        }
      };

      es.onopen = () => {
        backoffRef.current = 1000;
      };

      es.onerror = () => {
        es?.close();
        es = null;
        if (closed) return;
        const delay = backoffRef.current;
        backoffRef.current = Math.min(delay * 2, 30_000);
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      es?.close();
    };
  }, [enabled, qc]);
}
