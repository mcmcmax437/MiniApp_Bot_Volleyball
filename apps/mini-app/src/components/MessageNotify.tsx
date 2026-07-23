import { useQuery } from 'react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApi } from '../api';
import { useI18n } from '../i18n';
import { Icon } from '../Icon';
import './MessageNotify.css';

/**
 * Floating top-right message tab. Appears (and shakes) whenever the user
 * has pending game invitations. Tapping opens the invitations inbox.
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
      refetchInterval: 60_000,
      refetchOnWindowFocus: true,
      staleTime: 30_000,
    },
  );

  const count = listQ.data?.length ?? 0;
  if (count === 0) return null;
  // Already in the inbox — no need for the floating tab.
  if (location.pathname === '/invitations') return null;

  return (
    <button
      type="button"
      className="msgNotify"
      onClick={() => navigate('/invitations')}
      aria-label={t('invite.notifyAria', { count })}
      data-analytics-label="msg-notify-open"
    >
      <Icon name="message-01" size={18} />
      {count > 1 && <span className="msgNotify-count">{count > 9 ? '9+' : count}</span>}
    </button>
  );
}
