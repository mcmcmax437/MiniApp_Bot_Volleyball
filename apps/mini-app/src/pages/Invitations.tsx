import { useMutation, useQuery, useQueryClient } from 'react-query';
import { Link } from 'react-router-dom';
import { useApi } from '../api';
import { useI18n } from '../i18n';
import { Icon } from '../Icon';
import { Photo } from '../Photo';
import { AdminCrownBadge, isAdminUser } from '../AdminCrownBadge';

export function InvitationsPage() {
  const api = useApi();
  const qc = useQueryClient();
  const { t } = useI18n();

  const listQ = useQuery(['invitations', 'mine'], () => api.listMyInvitations());

  const respondMut = useMutation(
    ({ id, accept }: { id: string; accept: boolean }) =>
      api.respondInvitation(id, accept),
    {
      onSuccess: (_data, vars) => {
        qc.invalidateQueries(['invitations', 'mine']);
        qc.invalidateQueries(['games']);
        // Also drop the specific game's cache so navigating to /games/:id
        // right after accepting doesn't show the stale pre-join state.
        const inv = (listQ.data ?? []).find((i) => i.id === vars.id);
        if (inv) qc.invalidateQueries(['game', inv.game.id]);
      },
    },
  );

  return (
    <div className="invitationsPage">
      <header className="page-header">
        <div className="page-header-icon">
          <Icon name="mail-01" size={20} />
        </div>
        <div>
          <h1 className="page-header-title">{t('invite.title')}</h1>
        </div>
      </header>

      {listQ.isLoading && (
        <div className="skeleton" style={{ height: 120, borderRadius: 12 }} />
      )}

      {!listQ.isLoading && (listQ.data ?? []).length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Icon name="message-01" size={24} />
          </div>
          <div className="empty-state-title">{t('invite.empty')}</div>
        </div>
      )}

      <div className="invitationsList">
        {(listQ.data ?? []).map((inv) => {
          const inviterName = inv.inviter.lastName
            ? `${inv.inviter.firstName} ${inv.inviter.lastName}`
            : inv.inviter.firstName;
          return (
            <article key={inv.id} className="invitationItem card">
              <div className="invitationItem-head">
                <Photo
                  src={inv.inviter.photoUrl}
                  name={inviterName}
                  size={48}
                  variant="rounded"
                  topLeftBadge={
                    isAdminUser(inv.inviter) ? (
                      <AdminCrownBadge title={t('profile.status.admin')} size="sm" />
                    ) : null
                  }
                />
                <div className="invitationItem-meta">
                  <div className="invitationItem-from">
                    <strong>{inviterName}</strong>
                    {inv.inviter.username ? (
                      <span className="invitationItem-username">@{inv.inviter.username}</span>
                    ) : null}
                  </div>
                  <div className="invitationItem-when">
                    {new Date(inv.game.startAt).toLocaleString(undefined, {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  <div className="invitationItem-venue">
                    {inv.game.venue.name} · {inv.game.venue.address}
                  </div>
                </div>
              </div>
              <div className="invitationItem-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => respondMut.mutate({ id: inv.id, accept: true })}
                  disabled={respondMut.isLoading}
                >
                  <Icon name="checkmark-square-01" size={14} />
                  {t('invite.accept')}
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => respondMut.mutate({ id: inv.id, accept: false })}
                  disabled={respondMut.isLoading}
                >
                  <Icon name="cancel-01" size={14} />
                  {t('invite.decline')}
                </button>
                <Link to={`/games/${inv.game.id}`} className="btn btn-ghost">
                  {t('invite.openGame')}
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
