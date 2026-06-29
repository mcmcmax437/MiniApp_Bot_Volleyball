import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useApi, SKILL_LEVEL_LABELS, SkillLevel, CURRENCY_SYMBOLS } from '../api';
import { Icon } from '../Icon';
import { Photo } from '../Photo';
import { SkillBadge } from '../SkillBadge';
import { useI18n } from '../i18n';
import { effectiveSkillLevel } from '../lib/skill';
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

interface PlayerRowProps {
  userId: string;
  photoUrl: string | null;
  firstName: string;
  lastName: string | null | undefined;
  isHost: boolean;
  isYou: boolean;
  roleLabel: string;
  onReport: () => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
}

/**
 * One row of the Players list. Layout matches the reference:
 *   [Photo]  [Name + role label]            [⋯ menu]
 * Report is hidden inside the overflow menu instead of a wide button in every
 * row — that was the "huge button next to every player" you saw on the old
 * build (a padded `.btn-ghost` rendering as a pill, not the icon-only button
 * it was supposed to be).
 */
function PlayerRow({
  userId,
  photoUrl,
  firstName,
  lastName,
  isHost,
  isYou,
  roleLabel,
  onReport,
  menuOpen,
  onToggleMenu,
}: PlayerRowProps) {
  const { t } = useI18n();
  const fullName = lastName ? `${firstName} ${lastName}` : firstName;
  const showMenu = !isYou;
  return (
    <li className="detailPlayer" data-user-id={userId}>
      <Photo src={photoUrl} name={fullName} size={44} variant="rounded" />
      <span className="detailPlayer-body">
        <span className="detailPlayer-name">
          <span className="detailPlayer-nameText">{fullName}</span>
          {isYou && (
            <span className="detailPlayer-tag detailPlayer-tag-you">
              {t('gameDetail.tagYou')}
            </span>
          )}
        </span>
        <span className="detailPlayer-sub">
          {isHost && (
            <span className="detailPlayer-tag detailPlayer-tag-host">
              {t('gameDetail.tagHost')}
            </span>
          )}
          <span>{roleLabel}</span>
        </span>
      </span>
      {showMenu && (
        <div className="detailPlayer-menu">
          <button
            className="btn-icon detailPlayer-menuBtn"
            onClick={onToggleMenu}
            aria-label={t('gameDetail.actionsFor', { name: fullName })}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            data-analytics-label="game-player-menu"
          >
            <Icon name="more-horizontal" size={16} />
          </button>
          {menuOpen && (
            <div className="detailPlayer-menuPop" role="menu">
              <button
                className="detailPlayer-menuItem"
                onClick={() => {
                  onToggleMenu();
                  onReport();
                }}
                role="menuitem"
                data-analytics-label="game-report-player"
              >
                <Icon name="flag-01" size={14} /> {t('gameDetail.reportAction')}
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
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
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
  const [showEvaluate, setShowEvaluate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showPayments, setShowPayments] = useState(false);
  const [activeTab, setActiveTab] = useState<'players' | 'info'>('players');

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
      {/* Hero card — venue image with gradient overlay, big venue name,
          green capacity pill anchored top-right, date + location at the
          bottom. Matches the `GameHeroCard` Flutter reference. */}
      <div className="detailHero">
        {g.coverImageUrl ? (
          <img className="detailHero-img" src={g.coverImageUrl} alt="" />
        ) : (
          <div className="detailHero-img detailHero-img-fallback" aria-hidden>
            <Icon name="image-01" size={48} />
          </div>
        )}
        <div className="detailHero-overlay" aria-hidden />
        <div className="detailHero-body">
          <div className="detailHero-top">
            <h2 className="detailHero-title">{g.venue.name}</h2>
            <span className="detailHero-pill">
              {g.participantsCount}/{g.spotsTotal}
              {isJoined && (
                <span className="detailHero-pillJoined"> · {t('gameDetail.joined')}</span>
              )}
            </span>
          </div>
          <div className="detailHero-meta">
            <span>
              <Icon name="calendar-01" size={14} /> {formatGameTime(g.startAt)}
            </span>
            <span>
              <Icon name="map-pin" size={14} /> {g.venue.address}
              {g.addressHint ? ` · ${g.addressHint}` : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Tab strip — Players / Info */}
      <div className="detailTabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'players'}
          className={`detailTab${activeTab === 'players' ? ' isActive' : ''}`}
          onClick={() => setActiveTab('players')}
          data-analytics-label="game-tab-players"
        >
          <Icon name="user-group" size={16} />
          <span>{t('gameDetail.tabPlayers')}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'info'}
          className={`detailTab${activeTab === 'info' ? ' isActive' : ''}`}
          onClick={() => setActiveTab('info')}
          data-analytics-label="game-tab-info"
        >
          <Icon name="information-circle" size={16} />
          <span>{t('gameDetail.tabInfo')}</span>
        </button>
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

      {/* Players tab body */}
      {activeTab === 'players' && (
        <div className="detailCard detailCard-players" role="tabpanel">
          <div className="detailPlayers-header">
            <h3>{t('gameDetail.confirmedPlayers', { n: g.participantsCount })}</h3>
            <span className="detailPlayers-count">
              {g.participantsCount}/{g.spotsTotal}
            </span>
          </div>

          {/* Confirmed players */}
          <ul className="detailPlayerList">
            <PlayerRow
              key={`host:${g.host.id}`}
              userId={g.host.id}
              photoUrl={g.host.photoUrl}
              firstName={g.host.firstName}
              lastName={g.host.lastName}
              isHost
              isYou={myId === g.host.id}
              roleLabel={t('gameDetail.roleOrganizer')}
              onReport={() => setReportTarget({ id: g.host.id, name: g.host.firstName })}
              menuOpen={openMenuFor === g.host.id}
              onToggleMenu={() =>
                setOpenMenuFor(openMenuFor === g.host.id ? null : g.host.id)
              }
            />
            {g.participants
              .filter((p) => p.userId !== g.host.id)
              .map((p) => (
                <PlayerRow
                  key={p.id}
                  userId={p.userId}
                  photoUrl={p.user.photoUrl}
                  firstName={p.user.firstName}
                  lastName={p.user.lastName}
                  isHost={false}
                  isYou={myId === p.userId}
                  roleLabel={t('gameDetail.rolePlayer')}
                  onReport={() =>
                    setReportTarget({ id: p.userId, name: p.user.firstName })
                  }
                  menuOpen={openMenuFor === p.userId}
                  onToggleMenu={() =>
                    setOpenMenuFor(openMenuFor === p.userId ? null : p.userId)
                  }
                />
              ))}
            {g.participants.length <= 1 && (
              <li className="detailPlayer-empty">{t('gameDetail.noPlayers')}</li>
            )}
          </ul>

          {/* Spots left as filled placeholder avatars */}
          {g.spotsTotal - g.participantsCount > 0 && (
            <>
              <div className="detailPlayers-subheader">
                <span>
                  {t('game.spotsLeft', { n: g.spotsTotal - g.participantsCount })}
                </span>
              </div>
              <div
                className="detailPlayers-spots"
                aria-label={t('game.spotsLeft', { n: g.spotsTotal - g.participantsCount })}
              >
                {Array.from({ length: g.spotsTotal - g.participantsCount }).map((_, i) => (
                  <span key={i} className="detailPlayers-spotSlot">
                    <Icon name="user-account" size={18} />
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Info tab body — venue, time, tags, notes, pricing */}
      {activeTab === 'info' && (
        <div className="detailCard detailCard-info" role="tabpanel">
          <div className="detailInfo-row">
            <Icon name="calendar-01" className="icon-inline" />
            <span>
              <strong>{t('gameDetail.startsAt')}:</strong> {formatGameTime(g.startAt)}
            </span>
          </div>
          <div className="detailInfo-row">
            <Icon name="map-pin" className="icon-inline" />
            <span>
              <strong>{t('gameDetail.address')}:</strong> {g.venue.address}
              {g.addressHint ? ` · ${g.addressHint}` : ''}
            </span>
          </div>
          {g.isPaid && (
            <div className="detailInfo-row">
              <Icon name="dollar-01" className="icon-inline" />
              <span>
                <strong>{t('gameDetail.pricePerPlayer')}:</strong>{' '}
                {formatMoney(g.perPlayerCost, g.currency)}
              </span>
            </div>
          )}
          <div className="detailInfo-tags">
            <SkillBadge level={g.skillLevel} size="sm" />
            <span className="tag info">
              {g.venue.indoor ? t('venue.indoor') : t('venue.outdoor')}
            </span>
            {g.isPaid && <span className="tag warning">{t('game.paid')}</span>}
            {g.isClosed && (
              <span className="tag" style={{ background: 'var(--surface-3)' }}>
                <Icon name="lock" size={10} /> {t('game.closed')}
              </span>
            )}
            {g.status === 'CANCELLED' && <span className="tag warn">{t('game.cancel')}</span>}
            {g.status === 'FULL' && <span className="tag warn">{t('game.spotsFull')}</span>}
            {g.status === 'FINISHED' && <span className="tag">{t('game.finish')}</span>}
          </div>
          {g.notes && (
            <div className="detailInfo-notes">
              <Icon name="note-01" className="icon-inline" /> {g.notes}
            </div>
          )}
        </div>
      )}

      {/* Action area */}
      {!isClosed && (
        <div className="detailActions">
          {isHost ? (
            <>
              <button
                className="btn detailActions-primary"
                onClick={() => setShowInvite(true)}
                data-analytics-label="game-invite"
              >
                <Icon name="mail-01" size={16} /> {t('game.invitePlayers')}
              </button>
              <button
                className="btn btn-ghost detailActions-secondary"
                onClick={() => setShowPayments(true)}
                data-analytics-label="game-payments"
              >
                <Icon name="wallet-01" size={16} /> {t('game.managePayments')}
              </button>
              <button
                className="btn btn-ghost detailActions-secondary"
                onClick={() => finishMut.mutate()}
                disabled={finishMut.isLoading}
                data-analytics-label="game-finish"
              >
                <Icon name="checkmark-square-01" size={16} /> {t('game.finish')}
              </button>
              <button
                className="btn btn-ghost detailActions-danger"
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
                className="btn detailActions-primary"
                onClick={() => setShowInvite(true)}
                data-analytics-label="game-invite"
              >
                <Icon name="mail-01" size={16} /> {t('game.invitePlayers')}
              </button>
              <button
                className="btn btn-ghost detailActions-secondary"
                onClick={() => leaveMut.mutate()}
                disabled={leaveMut.isLoading}
                data-analytics-label="game-leave"
              >
                <Icon name="logout-01" size={16} /> {t('game.leave')}
              </button>
            </>
          ) : g.isClosed && !myJoinRequest && g.status === 'OPEN' ? (
            <button
              className="btn detailActions-primary detailActions-full"
              onClick={handleJoinClick}
              disabled={joinMut.isLoading}
              data-analytics-label="game-request-join"
            >
              <Icon name="mail-01" size={16} /> {t('game.requestToJoin')}
            </button>
          ) : myJoinRequest ? (
            <button className="btn detailActions-primary detailActions-full" disabled>
              <Icon name="clock-01" size={16} /> {t('game.requestPending')}
            </button>
          ) : (
            <button
              className="btn detailActions-primary detailActions-full"
              onClick={handleJoinClick}
              disabled={isFull || joinMut.isLoading}
              data-analytics-label="game-join"
            >
              {isFull ? t('game.spotsFull') : t('game.join')}
            </button>
          )}
        </div>
      )}

      {/* Evaluate (only after finished and joined) */}
      {!isClosed && isJoined && isFinished && (
        <button
          className="btn detailActions-primary detailActions-full"
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
                  <Icon name={p.isPaid ? 'cancel-01' : 'checkmark-square-01'} size={12} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
