import { useQuery } from 'react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApi } from '../api';
import { useI18n } from '../i18n';
import { Icon } from '../Icon';
import { Photo } from '../Photo';
import { AdminCrownBadge, isAdminUser } from '../AdminCrownBadge';
import './MessageNotify.css';

/**
 * Floating top-right message tab. Appears (and shakes) whenever the user
 * has pending game invitations. Shows the latest inviter's profile photo
 * so the notification reads as a person, not a generic mail icon.
 */
export function MessageNotify() {
  const api = useApi();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();

  const listQ = useQuery(
    ['invitations', 'mine', 'notify'],
    () => api.listMyInvitations(),
    {
      refetchInterval: 5_000,
      refetchOnWindowFocus: true,
      staleTime: 0,
    },
  );

  const invites = listQ.data ?? [];
  const count = invites.length;
  if (count === 0) return null;
  // Already in the inbox — no need for the floating tab.
  if (location.pathname === '/invitations') return null;

  const latest = invites[0];
  const inviterName = latest.inviter.lastName
    ? `${latest.inviter.firstName} ${latest.inviter.lastName}`
    : latest.inviter.firstName;

  return (
    <button
      type="button"
      className="msgNotify"
      onClick={() => navigate('/invitations')}
      aria-label={t('invite.notifyAria', { count })}
      data-analytics-label="msg-notify-open"
    >
      <Photo
        src={latest.inviter.photoUrl}
        name={inviterName}
        size={36}
        variant="rounded"
        topLeftBadge={
          isAdminUser(latest.inviter) ? (
            <AdminCrownBadge title={t('profile.status.admin')} size="sm" />
          ) : null
        }
      />
      <span className="msgNotify-mail" aria-hidden="true">
        <Icon name="mail-01" size={10} />
      </span>
      <span className="msgNotify-count">{count > 9 ? '9+' : count}</span>
    </button>
  );
}
