import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useApi } from '../api';
import { Icon } from '../Icon';
import './GameDetail.css';

function formatGameTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMoney(minor: number): string {
  return `${(minor / 100).toFixed(2)}`;
}

export function GameDetailPage() {
  const { id } = useParams<{ id: string }>();
  const api = useApi();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const meQ = useQuery(['me'], () => api.me());

  const gameQ = useQuery(['game', id], () => api.getGame(id!), { enabled: !!id });

  const joinMut = useMutation(() => api.joinGame(id!), {
    onSuccess: () => qc.invalidateQueries(['game', id]),
  });
  const leaveMut = useMutation(() => api.leaveGame(id!), {
    onSuccess: () => qc.invalidateQueries(['game', id]),
  });
  const cancelMut = useMutation(() => api.cancelGame(id!), {
    onSuccess: () => qc.invalidateQueries(['game', id]),
  });

  if (gameQ.isLoading) return <div className="empty">Loading…</div>;
  if (gameQ.isError) return <div className="error">{(gameQ.error as Error).message}</div>;
  if (!gameQ.data) return null;
  const g = gameQ.data;
  const myId = meQ.data?.id;
  const isHost = myId && g.host.id === myId;
  const isJoined = !!g.participants.find((p) => p.userId === myId);
  const isFull = g.participantsCount >= g.spotsTotal;
  const isClosed = g.status === 'CANCELLED' || g.status === 'FINISHED';

  return (
    <>
      <div className="detailCard">
        <h3>{g.venue.name}</h3>
        <div className="detailRow">
          <span>
            <Icon name="calendar-01" className="icon-inline" />
            {formatGameTime(g.startAt)}
          </span>
          <span>
            <Icon name="user-group" className="icon-inline" />
            {g.participantsCount}/{g.spotsTotal} players
          </span>
        </div>
        <div className="detailRow">
          <span>
            <Icon name="map-pin" className="icon-inline" />
            {g.venue.address}
          </span>
        </div>
        <div className="detailRow">
          <span>
            <span className="tag accent">{g.skillLevel}</span>
            <span className="tag">{g.venue.indoor ? 'Indoor' : 'Outdoor'}</span>
            {g.status === 'CANCELLED' && <span className="tag warn">Cancelled</span>}
            {g.status === 'FULL' && <span className="tag warn">Full</span>}
          </span>
          <strong>{formatMoney(g.perPlayerCost)} / player</strong>
        </div>
        {g.notes && (
          <div className="detailRow" style={{ marginTop: 8 }}>
            <span style={{ color: 'var(--text)' }}>
              <Icon name="note-01" className="icon-inline" />
              {g.notes}
            </span>
          </div>
        )}
      </div>

      <div className="detailMap">
        <Icon name="map-pin" size={28} className="icon-inline" />
        <span>{g.venue.lat.toFixed(4)}, {g.venue.lng.toFixed(4)}</span>
      </div>

      <div className="detailCard">
        <h3>Players</h3>
        <div className="detailRow">
          <span>
            <Icon name="user-account" className="icon-inline" />
            {g.host.firstName} (host)
          </span>
        </div>
        {g.participants
          .filter((p) => p.userId !== g.host.id)
          .map((p) => (
            <div className="detailRow" key={p.id}>
              <span>
                <Icon name="user-account" className="icon-inline" />
                {p.user.firstName}{p.user.lastName ? ` ${p.user.lastName}` : ''}
              </span>
            </div>
          ))}
        {g.participants.length === 1 && (
          <div className="empty" style={{ padding: '12px 0' }}>
            No other players yet.
          </div>
        )}
      </div>

      {!isClosed && (
        <div style={{ display: 'flex', gap: 8 }}>
          {isHost ? (
            <button
              className="btn danger"
              onClick={() => cancelMut.mutate()}
              disabled={cancelMut.isLoading}
            >
              Cancel game
            </button>
          ) : isJoined ? (
            <button
              className="btn secondary"
              onClick={() => leaveMut.mutate()}
              disabled={leaveMut.isLoading}
            >
              Leave game
            </button>
          ) : (
            <button
              className="btn"
              onClick={() => joinMut.mutate()}
              disabled={isFull || joinMut.isLoading}
            >
              {isFull ? 'Full' : 'Join game'}
            </button>
          )}
        </div>
      )}

      {(joinMut.isError || leaveMut.isError || cancelMut.isError) && (
        <div className="error">
          {(joinMut.error as Error)?.message ??
            (leaveMut.error as Error)?.message ??
            (cancelMut.error as Error)?.message}
        </div>
      )}

      <button
        className="btn secondary"
        style={{ marginTop: 12 }}
        onClick={() => navigate(-1)}
      >
        ← Back
      </button>
    </>
  );
}
