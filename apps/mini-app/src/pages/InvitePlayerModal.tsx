import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useApi, InviteSearchUser } from '../api';
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
};

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

  const gameQ = useQuery(['game', gameId], () => api.getGame(gameId), { enabled: open });

  // IDs to exclude: host, current participants, anyone with a pending
  // invitation. Computed once the game data is available so the search
  // query doesn't return players already in the lobby.
  const excludeIds = useMemo(() => {
    const ids = new Set<string>();
    const g = gameQ.data;
    if (!g) return [] as string[];
    if (g.host?.id) ids.add(g.host.id);
    g.participants.forEach((p) => ids.add(p.userId));
    g.invitations?.forEach((i) => ids.add(i.userId));
    return Array.from(ids);
  }, [gameQ.data]);

  const searchQ = useQuery(
    ['invite-search', gameId, query, excludeIds.join(',')],
    () => api.searchInvitees(query, excludeIds),
    {
      enabled: open && !!gameQ.data,
      // Keep the previous list visible while a new search loads so the UI
      // doesn't flash empty.
      keepPreviousData: true,
      staleTime: 30_000,
    },
  );

  const inviteMut = useMutation(
    ({ userId }: { userId: string; name: string }) => api.invitePlayer(gameId, userId),
    {
      onSuccess: (_data, vars) => {
        setJustInvitedIds((prev) =>
          prev.includes(vars.userId) ? prev : [...prev, vars.userId],
        );
        setFeedback({ userId: vars.userId, name: vars.name, kind: 'success' });
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
  const pendingIds = gameQ.data?.invitations?.map((i) => i.userId) ?? [];

  const sendInvite = (u: InviteSearchUser) => {
    const name = u.lastName ? `${u.firstName} ${u.lastName}` : u.firstName;
    setFeedback(null);
    setPressingId(u.id);
    webApp?.HapticFeedback?.impactOccurred('light');
    inviteMut.mutate({ userId: u.id, name });
  };

  return (
    <Modal open={open} onClose={onClose} title={t('invite.invitePlayer')}>
      <div className="inviteSearch">
        <Icon name="search-01" size={14} className="inviteSearch-icon" />
        <input
          className="inviteSearch-input"
          type="text"
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
              ? t('invite.invitedTo', { name: feedback.name })
              : t('invite.inviteFailed', { name: feedback.name })}
            {feedback.kind === 'error' && feedback.message
              ? ` — ${feedback.message}`
              : null}
          </span>
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
          <p>{query ? t('invite.noResults') : t('invite.empty')}</p>
        </div>
      )}

      {!searchQ.isLoading && users.length > 0 && (
        <div className="inviteList" role="list">
          {users.map((u: InviteSearchUser) => {
            const name = u.lastName ? `${u.firstName} ${u.lastName}` : u.firstName;
            const isPending =
              pendingIds.includes(u.id) || justInvitedIds.includes(u.id);
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
                      <span className="inviteRow-status">{t('invite.invited')}</span>
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
                  ) : isInviting ? (
                    <Icon name="loading" size={16} />
                  ) : (
                    <Icon name="plus-sign" size={16} />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="modal-actions" style={{ marginTop: 16 }}>
        <button className="btn btn-ghost detailActions-secondary" onClick={onClose}>
          <Icon name="cancel-01" size={14} />
          {t('common.cancel')}
        </button>
      </div>
    </Modal>
  );
}
