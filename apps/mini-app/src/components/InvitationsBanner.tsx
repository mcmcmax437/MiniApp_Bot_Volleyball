import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../api';
import { useI18n } from '../i18n';
import { Icon } from '../Icon';
import { Photo } from '../Photo';
import './InvitationsBanner.css';

/**
 * Sticky banner that surfaces pending game invitations app-wide (mounted in
 * App.tsx above the bottom-nav but only when the user is not already on the
 * invitations page or the game detail page for the same game).
 *
 * Polls every 60s and refetches on window focus so the banner appears even
 * when the user has been idle in the Mini App for a while — important since
 * the bot itself doesn't push real-time updates to the webview yet.
 */
export function InvitationsBanner() {
  const api = useApi();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { t } = useI18n();

  // Show at most one invitation at a time to avoid stacking banners.
  // The list still refreshes behind the scenes, so dismissing advances to
  // the next pending one without a refresh.
  const listQ = useQuery(['invitations', 'mine', 'banner'], () => api.listMyInvitations(), {
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [dismissedThisSession, setDismissedThisSession] = useState(false);

  const allInvites = listQ.data ?? [];
  // The banner is dismissed for the whole session as soon as the user clicks
  // the close button — they don't need to see the count again until the
  // next pending invitation arrives.
  const visibleInvite =
    !dismissedThisSession
      ? allInvites.find((inv) => !dismissedIds.includes(inv.id))
      : undefined;

  // When the underlying list changes (new invite arrived), un-dismiss so the
  // new one shows up.
  useEffect(() => {
    if (dismissedThisSession && allInvites.length > 0) {
      setDismissedThisSession(false);
    }
  }, [allInvites.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const respondMut = useMutation(
    ({ id, accept }: { id: string; accept: boolean }) =>
      api.respondInvitation(id, accept),
    {
      onSuccess: (_data, vars) => {
        // Drop this card from the banner so the next one (if any) shows up.
        setDismissedIds((prev) => [...prev, vars.id]);
        // Refresh the user's pending list AND the underlying game data so
        // when they navigate to the game detail it shows their fresh state.
        qc.invalidateQueries(['invitations', 'mine']);
        qc.invalidateQueries(['games']);
        // Find the game id so we can drop just the matching cache entry.
        const inv = (listQ.data ?? []).find((i) => i.id === vars.id);
        if (inv) qc.invalidateQueries(['game', inv.game.id]);
      },
    },
  );

  const dismiss = () => {
    setDismissedThisSession(true);
  };

  if (!visibleInvite) return null;

  const inv = visibleInvite;
  const inviterName = inv.inviter.lastName
    ? `${inv.inviter.firstName} ${inv.inviter.lastName}`
    : inv.inviter.firstName;
  const when = new Date(inv.game.startAt).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="inviteBanner" role="region" aria-label={t('invite.bannerTitle')}>
      <button
        type="button"
        className="inviteBanner-photo"
        onClick={() => {
          dismiss();
          navigate(`/games/${inv.game.id}`);
        }}
        aria-label={t('invite.openGame')}
        data-analytics-label="invite-banner-open"
      >
        <Photo src={inv.inviter.photoUrl} name={inviterName} size={40} variant="rounded" />
        <span className="inviteBanner-badge" aria-hidden="true">
          <Icon name="mail-01" size={12} />
        </span>
      </button>

      <button
        type="button"
        className="inviteBanner-body"
        onClick={() => {
          dismiss();
          navigate(`/games/${inv.game.id}`);
        }}
        data-analytics-label="invite-banner-tap"
      >
        <span className="inviteBanner-title">
          {t('invite.bannerTitle')}
        </span>
        <span className="inviteBanner-meta">
          <strong>{inviterName}</strong>
          {' · '}
          <span className="inviteBanner-venue">{inv.game.venue.name}</span>
          {' · '}
          <span className="inviteBanner-when">{when}</span>
        </span>
      </button>

      <div className="inviteBanner-actions">
        <button
          type="button"
          className="inviteBanner-btn inviteBanner-btn-accept"
          onClick={() => respondMut.mutate({ id: inv.id, accept: true })}
          disabled={respondMut.isLoading}
          aria-label={t('invite.accept')}
          data-analytics-label="invite-banner-accept"
        >
          <Icon name="checkmark-square-01" size={14} />
        </button>
        <button
          type="button"
          className="inviteBanner-btn inviteBanner-btn-decline"
          onClick={() => respondMut.mutate({ id: inv.id, accept: false })}
          disabled={respondMut.isLoading}
          aria-label={t('invite.decline')}
          data-analytics-label="invite-banner-decline"
        >
          <Icon name="cancel-01" size={14} />
        </button>
        <button
          type="button"
          className="inviteBanner-btn inviteBanner-btn-close"
          onClick={dismiss}
          aria-label={t('common.close')}
          data-analytics-label="invite-banner-dismiss"
        >
          <Icon name="cancel-01" size={12} />
        </button>
      </div>
    </div>
  );
}