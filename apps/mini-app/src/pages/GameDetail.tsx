import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useApi, SKILL_LEVEL_LABELS, SkillLevel, CURRENCY_SYMBOLS } from '../api';
import { Icon } from '../Icon';
import { Photo } from '../Photo';
import { SkillBadge } from '../SkillBadge';
import { useI18n } from '../i18n';
import { Modal } from '../Modal';
import { ReportUserModal } from './ReportUserModal';
import { EvaluatePlayersModal } from './EvaluatePlayersModal';
import { InvitePlayerModal } from './InvitePlayerModal';
import './GameDetail.css';

function formatGameTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMoney(minor: number, currency: string): string {
  return `${CURRENCY_SYMBOLS[currency as keyof typeof CURRENCY_SYMBOLS] ?? currency}${(minor / 100).toFixed(2)}`;
}

export function GameDetailPage() {
  const { id } = useParams<{ id: string }>();
  const api = useApi();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { t } = useI18n();

  const meQ = useQuery(['me'], () => api.me());
  const gameQ = useQuery(['game', id], () => api.getGame(id!), { enabled: !!id });

  // Pending join-request for closed lobbies
  const myJoinRequest = useMemo(() => {
    if (!gameQ.data || !meQ.data) return null;
    return gameQ.data.joinRequests?.find((r) => r.userId === meQ.data!.id && r.status === 'PENDING') ?? null;
  }, [gameQ.data, meQ.data]);

  const [pendingJoinBlockedWarn, setPendingJoinBlockedWarn] = useState<string[] | null>(null);

  const joinMut = useMutation(() => api.joinGame(id!), {
    onSuccess: () => qc.invalidateQueries(['game', id]),
  });
  const leaveMut = useMutation(() => api.leaveGame(id!), {
    onSuccess: () => qc.invalidateQueries(['game', id]),
  });
  const cancelMut = useMutation(() => api.cancelGame(id!), {
    onSuccess: () => qc.invalidateQueries(['game', id]),
  });
  const finishMut = useMutation(() => api.finishGame(id!), {
    onSuccess: () => qc.invalidateQueries(['game', id]),
  });

  const [reportTarget, setReportTarget] = useState<{ id: string; name: string } | null>(null);
  const [showEvaluate, setShowEvaluate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showPayments, setShowPayments] = useState(false);

  // Check for blacklisted players in the game
  const participantIds = useMemo(() => {
    if (!gameQ.data) return [] as string[];
    const ids = new Set<string>();
    if (gameQ.data.host?.id) ids.add(gameQ.data.host.id);
    gameQ.data.participants.forEach((p) => ids.add(p.userId));
    ids.delete(meQ.data?.id ?? '');
    return Array.from(ids);
  }, [gameQ.data, meQ.data]);

  const intersectQ = useQuery(
    ['blacklist', 'intersect', id, participantIds.join(',')],
    () => api.intersectBlacklist(participantIds),
    { enabled: !!gameQ.data && !!meQ.data && participantIds.length > 0 },
  );

  const blockedInThisGame = useMemo(() => {
    if (!intersectQ.data || !gameQ.data) return [] as { id: string; name: string }[];
    return intersectQ.data.blocked
      .map((bid) => {
        if (bid === gameQ.data!.host.id) {
          return { id: bid, name: `${gameQ.data!.host.firstName}` };
        }
        const p = gameQ.data!.participants.find((p) => p.userId === bid);
        return p ? { id: bid, name: `${p.user.firstName}` } : null;
      })
      .filter((x): x is { id: string; name: string } => !!x);
  }, [intersectQ.data, gameQ.data]);

  // Auto-show the warning dialog on first load if there are blocked players
  useEffect(() => {
    if (pendingJoinBlockedWarn) return;
    if (blockedInThisGame.length === 0) return;
    setPendingJoinBlockedWarn(blockedInThisGame.map((b) => b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockedInThisGame.length]);

  if (gameQ.isLoading) return <div className="empty">{t('common.loading')}</div>;
  if (gameQ.isError) return <div className="error">{(gameQ.error as Error).message}</div>;
  if (!gameQ.data) return null;

  const g = gameQ.data;
  const myId = meQ.data?.id;
  const isHost = myId && g.host.id === myId;
  const isJoined = !!g.participants.find((p) => p.userId === myId);
  const isFull = g.participantsCount >= g.spotsTotal;
  const isClosed = g.status === 'CANCELLED' || g.status === 'FINISHED';
  const isFinished = g.status === 'FINISHED';

  const handleJoinClick = () => {
    if (blockedInThisGame.length > 0) {
      setPendingJoinBlockedWarn(blockedInThisGame.map((b) => b.name));
      return;
    }
    joinMut.mutate();
  };

  return (
    <>
      <div className="detailCard">
        {g.coverImageUrl && (
          <div className="coverPreview" style={{ marginBottom: 12, aspectRatio: '16/9' }}>
            <img src={g.coverImageUrl} alt="" />
          </div>
        )}
        <h3>{g.venue.name}</h3>
        <div className="detailRow">
          <span><Icon name="calendar-01" className="icon-inline" /> {formatGameTime(g.startAt)}</span>
        </div>
        <div className="detailRow">
          <span>
            <Icon name="user-group" className="icon-inline" /> {g.participantsCount}/{g.spotsTotal} players
          </span>
          <strong>{formatMoney(g.perPlayerCost, g.currency)} / player</strong>
        </div>
        <div className="detailRow">
          <span>
            <Icon name="map-pin" className="icon-inline" />
            {g.venue.address}
            {g.addressHint ? ` · ${g.addressHint}` : ''}
          </span>
        </div>
        <div className="detailRow">
          <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <SkillBadge level={g.skillLevel} size="sm" />
            <span className="tag info">{g.venue.indoor ? 'Indoor' : 'Outdoor'}</span>
            {g.isPaid && <span className="tag warning">{t('game.paid')}</span>}
            {g.isClosed && (
              <span className="tag" style={{ background: 'var(--surface-3)' }}>
                <Icon name="lock" size={10} /> {t('game.closed')}
              </span>
            )}
            {g.status === 'CANCELLED' && <span className="tag warn">{t('game.cancel')}</span>}
            {g.status === 'FULL' && <span className="tag warn">{t('game.spotsFull')}</span>}
            {g.status === 'FINISHED' && <span className="tag">{t('game.finish')}</span>}
          </span>
        </div>
        {g.notes && (
          <div className="detailRow" style={{ marginTop: 8 }}>
            <span style={{ color: 'var(--text)' }}>
              <Icon name="note-01" className="icon-inline" /> {g.notes}
            </span>
          </div>
        )}
      </div>

      {/* Closed-lobby pending-request banner */}
      {g.isClosed && myJoinRequest && (
        <div className="requestBanner">
          <Icon name="clock-01" size={14} />
          <span>{t('game.requestPending')}</span>
        </div>
      )}

      {g.isClosed && !isJoined && !myJoinRequest && g.status === 'OPEN' && (
        <div className="requestBanner">
          <Icon name="information-circle" size={14} />
          <span>{t('game.closedHint')}</span>
        </div>
      )}

      {/* Players */}
      <div className="detailCard">
        <h3>{t('gameDetail.players')}</h3>
        <div className="detailPlayer">
          <Photo src={g.host.photoUrl} name={g.host.firstName} size={32} />
          <span style={{ flex: 1 }}>
            {g.host.firstName} {g.host.lastName ?? ''} <em style={{ color: 'var(--brand-300)', fontStyle: 'normal', fontSize: 12 }}>· host</em>
          </span>
          {g.host.skillLevel && <SkillBadge level={g.host.skillLevel} size="sm" />}
          {!isHost && meQ.data && g.host.id !== meQ.data.id && (
            <button
              className="btn btn-ghost"
              onClick={() => setReportTarget({ id: g.host.id, name: g.host.firstName })}
              aria-label="Report host"
              title="Report"
              data-analytics-label="game-report-host"
            >
              <Icon name="report" size={12} />
            </button>
          )}
        </div>
        {g.participants
          .filter((p) => p.userId !== g.host.id)
          .map((p) => (
            <div className="detailPlayer" key={p.id}>
              <Photo
                src={p.user.photoUrl}
                name={`${p.user.firstName}${p.user.lastName ?? ''}`}
                size={32}
              />
              <span style={{ flex: 1 }}>
                {p.user.firstName}{p.user.lastName ? ` ${p.user.lastName}` : ''}
              </span>
              {p.user.skillLevel && <SkillBadge level={p.user.skillLevel as SkillLevel} size="sm" />}
              {meQ.data && p.userId !== meQ.data.id && (
                <button
                  className="btn btn-ghost"
                  onClick={() => setReportTarget({ id: p.userId, name: p.user.firstName })}
                  aria-label={`Report ${p.user.firstName}`}
                  title="Report"
                  data-analytics-label="game-report-player"
                >
                  <Icon name="report" size={12} />
                </button>
              )}
            </div>
          ))}
        {g.participants.length === 1 && (
          <div className="empty" style={{ padding: '12px 0' }}>{t('gameDetail.noPlayers')}</div>
        )}
      </div>

      {/* Action area */}
      {!isClosed && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {isHost ? (
            <>
              <button
                className="btn"
                onClick={() => setShowInvite(true)}
                data-analytics-label="game-invite"
              >
                <Icon name="send-01" size={16} /> {t('game.invitePlayers')}
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => setShowPayments(true)}
                data-analytics-label="game-payments"
              >
                <Icon name="wallet-01" size={16} /> {t('game.managePayments')}
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => finishMut.mutate()}
                disabled={finishMut.isLoading}
                data-analytics-label="game-finish"
              >
                <Icon name="check" size={16} /> {t('game.finish')}
              </button>
              <button
                className="btn danger"
                onClick={() => {
                  if (window.confirm('Cancel this game?')) cancelMut.mutate();
                }}
                disabled={cancelMut.isLoading}
              >
                <Icon name="cancel-01" size={16} /> {t('game.cancel')}
              </button>
            </>
          ) : isJoined ? (
            <>
              <button
                className="btn btn-ghost"
                onClick={() => leaveMut.mutate()}
                disabled={leaveMut.isLoading}
                data-analytics-label="game-leave"
              >
                <Icon name="logout-01" size={16} /> {t('game.leave')}
              </button>
              {isFinished && (
                <button
                  className="btn"
                  onClick={() => setShowEvaluate(true)}
                  data-analytics-label="game-evaluate"
                >
                  <Icon name="award-01" size={16} /> {t('game.evaluations')}
                </button>
              )}
            </>
          ) : g.isClosed && !myJoinRequest && g.status === 'OPEN' ? (
            <button
              className="btn"
              onClick={handleJoinClick}
              disabled={joinMut.isLoading}
              data-analytics-label="game-request-join"
            >
              <Icon name="send-01" size={16} /> {t('game.requestToJoin')}
            </button>
          ) : myJoinRequest ? (
            <button className="btn" disabled>
              <Icon name="clock-01" size={16} /> {t('game.requestPending')}
            </button>
          ) : (
            <button
              className="btn"
              onClick={handleJoinClick}
              disabled={isFull || joinMut.isLoading}
              data-analytics-label="game-join"
            >
              {isFull ? t('game.spotsFull') : t('game.join')}
            </button>
          )}
        </div>
      )}

      {/* Evaluate (only after finished) */}
      {!isClosed && isJoined && isFinished && (
        <button
          className="btn"
          style={{ marginTop: 10 }}
          onClick={() => setShowEvaluate(true)}
        >
          <Icon name="award-01" size={16} /> {t('game.evaluations')}
        </button>
      )}

      {(joinMut.isError || leaveMut.isError || cancelMut.isError) && (
        <div className="error">
          {(joinMut.error as Error)?.message ??
            (leaveMut.error as Error)?.message ??
            (cancelMut.error as Error)?.message}
        </div>
      )}

      <button className="btn secondary" style={{ marginTop: 12 }} onClick={() => navigate(-1)}>
        <Icon name="arrow-left-01" size={16} /> {t('common.close')}
      </button>

      {/* Modals */}
      <Modal open={pendingJoinBlockedWarn !== null} onClose={() => setPendingJoinBlockedWarn(null)} title={t('blacklist.warning.title')}>
        <p style={{ color: 'var(--text-secondary)' }}>
          {t('blacklist.warning.body', { name: (pendingJoinBlockedWarn ?? []).join(', ') })}
        </p>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => setPendingJoinBlockedWarn(null)}>
            {t('blacklist.warning.cancel')}
          </button>
          <button
            className="btn danger"
            onClick={() => {
              setPendingJoinBlockedWarn(null);
              joinMut.mutate();
            }}
          >
            {t('blacklist.warning.confirm')}
          </button>
        </div>
      </Modal>

      <ReportUserModal
        open={!!reportTarget}
        target={reportTarget}
        gameId={g.id}
        onClose={() => setReportTarget(null)}
      />

      <EvaluatePlayersModal
        open={showEvaluate}
        gameId={g.id}
        onClose={() => {
          setShowEvaluate(false);
          qc.invalidateQueries(['game', id]);
        }}
      />

      <InvitePlayerModal
        open={showInvite}
        gameId={g.id}
        onClose={() => setShowInvite(false)}
      />

      <PaymentsModal
        open={showPayments}
        gameId={g.id}
        onClose={() => {
          setShowPayments(false);
          qc.invalidateQueries(['game', id]);
        }}
      />
    </>
  );
}

function PaymentsModal({ open, gameId, onClose }: { open: boolean; gameId: string; onClose: () => void }) {
  const api = useApi();
  const { t } = useI18n();
  const qc = useQueryClient();
  const listQ = useQuery(['payments', 'game', gameId], () => api.listGamePayments(gameId), { enabled: open });
  const setPaidMut = useMutation(
    ({ userId, isPaid }: { userId: string; isPaid: boolean }) =>
      api.setGamePayment(gameId, { userId, isPaid }),
    { onSuccess: () => qc.invalidateQueries(['payments', 'game', gameId]) },
  );

  return (
    <Modal open={open} onClose={onClose} title={t('payments.title')}>
      {listQ.isLoading && <div className="skeleton" style={{ height: 80, borderRadius: 10 }} />}
      {listQ.data && (
        <>
          <div className="costRow">
            <span>{t('payments.totalCost')}</span>
            <strong>
              {CURRENCY_SYMBOLS[listQ.data.currency as keyof typeof CURRENCY_SYMBOLS] ?? listQ.data.currency}
              {(listQ.data.totalCost / 100).toFixed(2)}
            </strong>
          </div>
          <div className="costRow" style={{ marginBottom: 12 }}>
            <span>{t('payments.perPlayer')}</span>
            <strong>
              {CURRENCY_SYMBOLS[listQ.data.currency as keyof typeof CURRENCY_SYMBOLS] ?? listQ.data.currency}
              {listQ.data.perPlayer.toFixed(2)}
            </strong>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {listQ.data.participants.map((p) => (
              <div
                key={p.userId}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  borderRadius: 10,
                  background: 'var(--surface-1)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <Photo src={p.user.photoUrl} name={p.user.firstName} size={28} />
                <span style={{ flex: 1 }}>
                  {p.user.firstName}
                  {p.user.lastName ? ` ${p.user.lastName}` : ''}
                </span>
                <span className={`paymentItem-pill ${p.isPaid ? 'isPaid' : 'isUnpaid'}`}>
                  {p.isPaid ? t('payments.paid') : t('payments.unpaid')}
                </span>
                <button
                  className="btn btn-ghost"
                  onClick={() => setPaidMut.mutate({ userId: p.userId, isPaid: !p.isPaid })}
                  disabled={setPaidMut.isLoading}
                  aria-label={p.isPaid ? t('payments.markUnpaid') : t('payments.markPaid')}
                >
                  <Icon name={p.isPaid ? 'cancel-01' : 'check'} size={12} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}