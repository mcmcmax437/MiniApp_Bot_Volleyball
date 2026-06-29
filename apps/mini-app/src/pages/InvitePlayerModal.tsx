import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useApi, InviteSearchUser } from '../api';
import { useI18n } from '../i18n';
import { Icon } from '../Icon';
import { Modal } from '../Modal';
import { Photo } from '../Photo';
import { SkillBadge } from '../SkillBadge';
import { effectiveSkillLevel } from '../lib/skill';
import './InvitePlayerModal.css';

interface Props {
  open: boolean;
  gameId: string;
  onClose: () => void;
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
  const qc = useQueryClient();
  const [query, setQuery] = useState('');

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
    (userId: string) => api.invitePlayer(gameId, userId),
    {
      onSuccess: () => qc.invalidateQueries(['game', gameId]),
    },
  );

  const users = searchQ.data?.users ?? [];
  const pendingIds = gameQ.data?.invitations?.map((i) => i.userId) ?? [];

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
            const isPending = pendingIds.includes(u.id);
            const lvl = effectiveSkillLevel(u);
            const isInviting =
              inviteMut.isLoading && inviteMut.variables === u.id;
            return (
              <div className="inviteRow" key={u.id} role="listitem">
                <Photo src={u.photoUrl} name={u.firstName} size={36} variant="rounded" />
                <div className="inviteRow-body">
                  <span className="inviteRow-name">
                    {u.firstName}
                    {u.lastName ? ` ${u.lastName}` : ''}
                  </span>
                  <span className="inviteRow-sub">
                    {u.username ? <span>@{u.username}</span> : null}
                    {lvl ? <SkillBadge level={lvl} size="sm" /> : null}
                  </span>
                </div>
                <button
                  className="inviteAdd"
                  onClick={() => inviteMut.mutate(u.id)}
                  disabled={isPending || isInviting || inviteMut.isLoading}
                  aria-label={t('invite.inviteAction', { name: u.firstName })}
                  data-analytics-label="invite-add"
                >
                  {isPending ? (
                    <Icon name="clock-01" size={16} />
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

      {inviteMut.isError && (
        <div className="error">
          <Icon name="bell-dot" size={14} />
          <span>{(inviteMut.error as Error).message}</span>
        </div>
      )}

      {inviteMut.isSuccess && (
        <div className="success-banner">
          <Icon name="checkmark-square-01" size={14} />
          <span>{t('invite.invited')}</span>
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