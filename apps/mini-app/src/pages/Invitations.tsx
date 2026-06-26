import { useMutation, useQuery, useQueryClient } from 'react-query';
import { Link } from 'react-router-dom';
import { useApi } from '../api';
import { useI18n } from '../i18n';
import { Icon } from '../Icon';

export function InvitationsPage() {
  const api = useApi();
  const qc = useQueryClient();
  const { t } = useI18n();

  const listQ = useQuery(['invitations', 'mine'], () => api.listMyInvitations());

  const respondMut = useMutation(
    ({ id, accept }: { id: string; accept: boolean }) =>
      api.respondInvitation(id, accept),
    {
      onSuccess: () => {
        qc.invalidateQueries(['invitations', 'mine']);
        qc.invalidateQueries(['games']);
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
        {(listQ.data ?? []).map((inv) => (
          <article key={inv.id} className="invitationItem card">
            <div className="invitationItem-meta">
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
              <div className="invitationItem-from">
                {inv.inviter.firstName}{inv.inviter.lastName ? ' ' + inv.inviter.lastName : ''}
              </div>
            </div>
            <div className="invitationItem-actions">
              <button
                className="btn btn-primary"
                onClick={() => respondMut.mutate({ id: inv.id, accept: true })}
                disabled={respondMut.isLoading}
              >
                <Icon name="check" size={14} />
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
                {t('common.search')}
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}