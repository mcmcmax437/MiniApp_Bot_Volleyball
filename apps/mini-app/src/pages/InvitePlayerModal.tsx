import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useApi, InviteSearchUser, GameSentInvitation } from '../api';
import { useI18n } from '../i18n';
import { Icon } from '../Icon';
import { Modal } from '../Modal';
import { Photo } from '../Photo';
import { SkillBadge } from '../SkillBadge';
import { AdminCrownBadge, isAdminUser } from '../AdminCrownBadge';
import { effectiveSkillLevel } from '../lib/skill';
import { useTelegram } from '../tg';
import './InvitePlayerModal.css';

interface Props {
  open: boolean;
  gameId: string;
  onClose: () => void;
}

type InviteFeedback = {
  userId: string;
  name: string;
  kind: 'success' | 'error';
  message?: string;
  resent?: boolean;
};

const RESEND_AFTER_MS = 24 * 60 * 60 * 1000;

function inviteeIdOf(inv: GameSentInvitation): string {
  return inv.userId || inv.inviteeId;
}

function canResendInvite(inv: GameSentInvitation): boolean {
  if (inv.status === 'DECLINED' || inv.status === 'IGNORED') return true;
  if (inv.status !== 'PENDING') return false;
  if (inv.readAt) return false;
  return Date.now() - new Date(inv.createdAt).getTime() >= RESEND_AFTER_MS;
}

function ReadTicks({ read }: { read: boolean }) {
  return (
    <span
      className={`inviteTicks${read ? ' isRead' : ''}`}
      title={read ? 'Read' : 'Sent'}
      aria-hidden="true"
    >
      {read ? '✓✓' : '✓'}
    </span>
  );
}

/**
 * Host picks who to invite from a searchable list of players instead of
 * pasting a Telegram ID. The API exposes `GET /users/search?q=&exclude=…`
 * which returns up to 30 public profiles (name, username, photo, skill) —
 * banned users and anyone already in the game is filtered server-side.
 */
export function InvitePlayerModal({ open, gameId, onClose }: Props) {
  const api = useApi();
  const { t } = useI18n();
  const { webApp } = useTelegram();
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [feedback, setFeedback] = useState<InviteFeedback | null>(null);
  /** Locally marked invited this session so the + flips to ✓ before refetch. */
  const [justInvitedIds, setJustInvitedIds] = useState<string[]>([]);
  const [pressingId, setPressingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setFeedback(null);
      setJustInvitedIds([]);
      setPressingId(null);
      setQuery('');
    }
  }, [open]);

  const gameQ = useQuery(['game', gameId], () => api.getGame(gameId), {
    enabled: open,
    refetchInterval: open ? 4_000 : false,
  });

  const sentInvites = useMemo(() => {
    const list = gameQ.data?.invitations ?? [];
    return [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [gameQ.data?.invitations]);

  // Exclude host, seated players, and pending invites that cannot be resent yet.
  const excludeIds = useMemo(() => {
    const ids = new Set<string>();
    const g = gameQ.data;
    if (!g) return [] as string[];
    if (g.host?.id) ids.add(g.host.id);
    g.participants.forEach((p) => ids.add(p.userId));
    g.invitations?.forEach((i) => {
      if (i.status === 'ACCEPTED') ids.add(inviteeIdOf(i));
      if (i.status === 'PENDING' && !canResendInvite(i)) ids.add(inviteeIdOf(i));
    });
    return Array.from(ids);
  }, [gameQ.data]);

  const searchQ = useQuery(
    ['invite-search', gameId, query, excludeIds.join(',')],
    () => api.searchInvitees(query, excludeIds),
    {
      enabled: open && !!gameQ.data,
      keepPreviousData: true,
      staleTime: 30_000,
    },
  );

  const inviteMut = useMutation(
    ({ userId }: { userId: string; name: string; resent?: boolean }) =>
      api.invitePlayer(gameId, userId),
    {
      onSuccess: (_data, vars) => {
        setJustInvitedIds((prev) =>
          prev.includes(vars.userId) ? prev : [...prev, vars.userId],
        );
        setFeedback({
          userId: vars.userId,
          name: vars.name,
          kind: 'success',
          resent: vars.resent,
        });
        webApp?.HapticFeedback?.notificationOccurred('success');
        qc.invalidateQueries(['game', gameId]);
      },
      onError: (err, vars) => {
        setFeedback({
          userId: vars.userId,
          name: vars.name,
          kind: 'error',
          message: (err as Error).message,
        });
        webApp?.HapticFeedback?.notificationOccurred('error');
      },
      onSettled: () => {
        setPressingId(null);
      },
    },
  );

  const users = searchQ.data?.users ?? [];
  const blockedPendingIds = (gameQ.data?.invitations ?? [])
    .filter((i) => i.status === 'PENDING' && !canResendInvite(i))
    .map(inviteeIdOf);

  const sendInvite = (u: InviteSearchUser, resent = false) => {
    const name = u.lastName ? `${u.firstName} ${u.lastName}` : u.firstName;
    setFeedback(null);
    setPressingId(u.id);
    webApp?.HapticFeedback?.impactOccurred('light');
    inviteMut.mutate({ userId: u.id, name, resent });
  };

  const statusLabel = (inv: GameSentInvitation) => {
    const gameStatus = gameQ.data?.status;
    if (
      inv.status === 'PENDING' &&
      gameStatus &&
      (gameStatus === 'FULL' || gameStatus === 'CANCELLED' || gameStatus === 'FINISHED')
    ) {
      return t('invite.statusInactive');
    }
    switch (inv.status) {
      case 'ACCEPTED':
        return t('invite.statusAccepted');
      case 'DECLINED':
        return t('invite.statusDeclined');
      case 'IGNORED':
        return t('invite.statusIgnored');
      default:
        return inv.readAt ? t('invite.statusRead') : t('invite.statusSent');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('invite.invitePlayer')}
      className="modal-compact inviteModal"
    >
      <div className="inviteSearch">
        <Icon name="search-01" size={14} className="inviteSearch-icon" />
        <input
          className="inviteSearch-input"
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('invite.searchPlaceholder')}
        />
        {query && (
          <button
            type="button"
            className="btn-icon inviteSearch-clear"
            onClick={() => setQuery('')}
            aria-label={t('common.cancel')}
          >
            <Icon name="cancel-01" size={12} />
          </button>
        )}
      </div>

      {feedback && (
        <div
          className={`inviteToast inviteToast-${feedback.kind}`}
          role="status"
          key={`${feedback.kind}:${feedback.userId}:${feedback.message ?? 'ok'}`}
        >
          <Icon
            name={feedback.kind === 'success' ? 'checkmark-square-01' : 'bell-dot'}
            size={14}
          />
          <span>
            {feedback.kind === 'success'
              ? feedback.resent
                ? t('invite.resentTo', { name: feedback.name })
                : t('invite.invitedTo', { name: feedback.name })
              : t('invite.inviteFailed', { name: feedback.name })}
            {feedback.kind === 'error' && feedback.message
              ? ` — ${feedback.message}`
              : null}
          </span>
        </div>
      )}

      {sentInvites.length > 0 && (
        <div className="inviteSent">
          <div className="inviteSent-title">{t('invite.sentTitle')}</div>
          <div className="inviteList inviteList-sent" role="list">
            {sentInvites.slice(0, 10).map((inv) => {
              const u = inv.invitee;
              const name = u
                ? u.lastName
                  ? `${u.firstName} ${u.lastName}`
                  : u.firstName
                : inviteeIdOf(inv);
              const resendable = canResendInvite(inv);
              const isResending =
                inviteMut.isLoading && inviteMut.variables?.userId === inviteeIdOf(inv);
              return (
                <div className="inviteRow inviteRow-sent" key={inv.id} role="listitem">
                  <Photo
                    src={u?.photoUrl ?? null}
                    name={name}
                    size={32}
                    variant="rounded"
                  />
                  <div className="inviteRow-body">
                    <span className="inviteRow-name">{name}</span>
                    <span className="inviteRow-sub">
                      <span
                        className={`inviteRow-badge inviteRow-badge-${inv.status.toLowerCase()}${
                          inv.status === 'PENDING' && inv.readAt ? ' isRead' : ''
                        }`}
                      >
                        {statusLabel(inv)}
                      </span>
                      {inv.status === 'PENDING' && <ReadTicks read={!!inv.readAt} />}
                    </span>
                  </div>
                  {resendable && (
                    <button
                      type="button"
                      className="inviteResend"
                      disabled={inviteMut.isLoading}
                      onClick={() => {
                        setFeedback(null);
                        setPressingId(inviteeIdOf(inv));
                        webApp?.HapticFeedback?.impactOccurred('light');
                        inviteMut.mutate({
                          userId: inviteeIdOf(inv),
                          name,
                          resent: true,
                        });
                      }}
                      aria-label={t('invite.resendAria', { name })}
                      data-analytics-label="invite-resend"
                    >
                      {isResending ? '…' : t('invite.resend')}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {searchQ.isLoading && (
        <div className="inviteList">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="inviteRow skeleton" style={{ height: 56 }} />
          ))}
        </div>
      )}

      {!searchQ.isLoading && users.length === 0 && (
        <div className="inviteEmpty">
          <Icon name="user-account" size={24} />
          <p>{query ? t('invite.noResults') : t('invite.emptySearch')}</p>
        </div>
      )}

      {!searchQ.isLoading && users.length > 0 && (
        <div className="inviteList" role="list">
          {users.map((u: InviteSearchUser) => {
            const name = u.lastName ? `${u.firstName} ${u.lastName}` : u.firstName;
            const isPending =
              blockedPendingIds.includes(u.id) || justInvitedIds.includes(u.id);
            const pendingInv = (gameQ.data?.invitations ?? []).find(
              (i) => i.status === 'PENDING' && inviteeIdOf(i) === u.id,
            );
            const lvl = effectiveSkillLevel(u);
            const isInviting =
              inviteMut.isLoading && inviteMut.variables?.userId === u.id;
            const rowFlash =
              feedback?.userId === u.id
                ? feedback.kind === 'success'
                  ? ' isSuccess'
                  : ' isError'
                : '';
            const btnState = isPending
              ? ' isSent'
              : isInviting || pressingId === u.id
                ? ' isSending'
                : '';

            return (
              <div
                className={`inviteRow${rowFlash}`}
                key={u.id}
                role="listitem"
              >
                <Photo
                  src={u.photoUrl}
                  name={u.firstName}
                  size={36}
                  variant="rounded"
                  topLeftBadge={
                    isAdminUser(u) ? (
                      <AdminCrownBadge title={t('profile.status.admin')} size="sm" />
                    ) : null
                  }
                  bottomRightBadge={
                    lvl ? <SkillBadge level={lvl} size="sm" className="skillBadge-on-photo" /> : null
                  }
                />
                <div className="inviteRow-body">
                  <span className="inviteRow-name">{name}</span>
                  <span className="inviteRow-sub">
                    {u.username ? <span>@{u.username}</span> : null}
                    {isPending && (
                      <>
                        <span className="inviteRow-badge inviteRow-badge-pending">
                          {t('invite.invited')}
                        </span>
                        <ReadTicks read={!!pendingInv?.readAt} />
                      </>
                    )}
                  </span>
                </div>
                <button
                  type="button"
                  className={`inviteAdd${btnState}`}
                  onClick={() => sendInvite(u)}
                  disabled={isPending || inviteMut.isLoading}
                  aria-label={t('invite.inviteAction', { name: u.firstName })}
                  data-analytics-label="invite-add"
                >
                  {isPending ? (
                    <Icon name="checkmark-square-01" size={16} />
                  ) : (
                    <Icon name="plus-sign" size={16} />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="modal-actions" style={{ marginTop: 12 }}>
        <button className="btn btn-ghost detailActions-secondary" onClick={onClose}>
          <Icon name="cancel-01" size={14} />
          {t('common.cancel')}
        </button>
      </div>
    </Modal>
  );
}
