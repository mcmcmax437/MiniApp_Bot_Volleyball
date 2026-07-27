import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable, Subject, interval, merge, map, finalize } from 'rxjs';

/**
 * In-process fan-out for invitation SSE streams.
 * Enough for a single API process (PM2 fork / one Nest instance on the VPS).
 */
@Injectable()
export class InvitationsRealtimeService {
  private readonly channels = new Map<string, Subject<MessageEvent>>();
  private readonly refs = new Map<string, number>();

  /** Publish a new/updated pending invite to the invitee's open streams. */
  publishInvite(inviteeId: string, payload: { invitationId: string; gameId: string }) {
    const channel = this.channels.get(inviteeId);
    if (!channel) return;
    channel.next({
      type: 'invite',
      data: payload,
    } as MessageEvent);
  }

  /** Tell the host their invite was accepted / declined / ignored / read. */
  publishInviteUpdate(
    inviterId: string,
    payload: {
      invitationId: string;
      gameId: string;
      status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'IGNORED';
      readAt?: string | null;
      kind: 'response' | 'read';
    },
  ) {
    const channel = this.channels.get(inviterId);
    if (!channel) return;
    channel.next({
      type: 'invite_update',
      data: payload,
    } as MessageEvent);
  }

  /**
   * Subscribe the current user to invite push events. Includes a heartbeat
   * every 25s so nginx / Telegram WebView proxies don't idle-close the pipe.
   */
  subscribe(userId: string): Observable<MessageEvent> {
    let channel = this.channels.get(userId);
    if (!channel) {
      channel = new Subject<MessageEvent>();
      this.channels.set(userId, channel);
    }
    this.refs.set(userId, (this.refs.get(userId) ?? 0) + 1);

    const heartbeats$ = interval(25_000).pipe(
      map(
        () =>
          ({
            type: 'heartbeat',
            data: { t: Date.now() },
          }) as MessageEvent,
      ),
    );

    // Immediate hello so the client knows the stream is live.
    const hello$ = new Observable<MessageEvent>((subscriber) => {
      subscriber.next({
        type: 'connected',
        data: { ok: true },
      } as MessageEvent);
      subscriber.complete();
    });

    return merge(hello$, channel.asObservable(), heartbeats$).pipe(
      finalize(() => {
        const left = (this.refs.get(userId) ?? 1) - 1;
        if (left <= 0) {
          this.refs.delete(userId);
          const existing = this.channels.get(userId);
          existing?.complete();
          this.channels.delete(userId);
        } else {
          this.refs.set(userId, left);
        }
      }),
    );
  }
}
