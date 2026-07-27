import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useApi, PublicUserProfile } from '../api';
import { Icon } from '../Icon';
import { Photo } from '../Photo';
import { SkillBadge } from '../SkillBadge';
import { AdminCrownBadge, isAdminUser } from '../AdminCrownBadge';
import { useI18n } from '../i18n';
import { effectiveSkillLevel } from '../lib/skill';
import { confirmDialog } from '../lib/confirm';
import './Profile.css';
import './UserProfile.css';

function openTelegramUser(username: string) {
  const handle = username.replace(/^@/, '');
  if (!handle) return;
  const url = `https://t.me/${handle}`;
  const tg = window.Telegram?.WebApp as
    | { openTelegramLink?: (u: string) => void }
    | null
    | undefined;
  if (tg && typeof tg.openTelegramLink === 'function') {
    tg.openTelegramLink(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const api = useApi();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t } = useI18n();

  const meQ = useQuery(['me'], () => api.me());
  const userQ = useQuery<PublicUserProfile>(
    ['user', id],
    () => api.getPublicUser(id!),
    { enabled: !!id && !!meQ.data && meQ.data.id !== id, retry: false },
  );

  const isSelf = !!meQ.data?.id && meQ.data.id === id;

  useEffect(() => {
    if (isSelf) navigate('/profile', { replace: true });
  }, [isSelf, navigate]);

  const blockMut = useMutation(
    () => api.addBlacklist({ blockedId: id! }),
    {
      onSuccess: () => {
        qc.invalidateQueries(['blacklist']);
        navigate(-1);
      },
    },
  );

  if (isSelf || meQ.isLoading || userQ.isLoading) {
    return (
      <div className="profilePage">
        <div className="skeleton" style={{ width: '40%', height: 20, marginBottom: 16 }} />
        <div className="skeleton" style={{ width: '100%', height: 96, marginBottom: 16, borderRadius: 16 }} />
        <div className="skeleton" style={{ width: '100%', height: 160, borderRadius: 16 }} />
      </div>
    );
  }

  if (userQ.isError || !userQ.data) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <Icon name="user-account" size={24} />
        </div>
        <div className="empty-state-title">{t('userProfile.notFound')}</div>
        <div className="empty-state-text">{t('userProfile.notFoundText')}</div>
        <button type="button" className="btn" onClick={() => navigate(-1)} style={{ marginTop: 16 }}>
          <Icon name="arrow-left-01" size={16} /> {t('common.back')}
        </button>
      </div>
    );
  }

  const u = userQ.data;
  const fullName = u.lastName ? `${u.firstName} ${u.lastName}` : u.firstName;
  const level = effectiveSkillLevel(u);
  const showAdmin = isAdminUser(u);

  return (
    <div className="profilePage userProfilePage">
      <button
        type="button"
        className="userProfile-back"
        onClick={() => navigate(-1)}
        data-analytics-label="user-profile-back"
      >
        <Icon name="arrow-left-01" size={16} />
        {t('common.back')}
      </button>

      <header className="profileHero">
        <div className="profileHero-photoWrap">
          <Photo
            src={u.photoUrl}
            name={fullName}
            size={84}
            topLeftBadge={
              showAdmin ? <AdminCrownBadge title={t('profile.status.admin')} /> : null
            }
          />
        </div>
        <div className="profileHero-info">
          <h1 className="profileHero-name">{fullName}</h1>
          {u.username && (
            <div className="profileHero-meta">
              <span className="profileHero-username">@{u.username}</span>
            </div>
          )}
          {level && (
            <div className="profileHero-skillBig" aria-label={t('profile.skill')}>
              <SkillBadge level={level} size="xl" withLabel />
            </div>
          )}
        </div>
      </header>

      <div className="card profileSummary">
        <div className="profileSummary-row">
          <span>{t('profile.city')}</span>
          <strong>{u.city || '—'}</strong>
        </div>
        <div className="profileSummary-row">
          <span>{t('profile.age')}</span>
          <strong>{u.age ?? '—'}</strong>
        </div>
      </div>

      <section className="formSection">
        <h2 className="formSection-title">{t('profile.activity')}</h2>
        <div className="card profileSummary">
          <div className="profileSummary-row">
            <span>{t('profile.gamesHosted')}</span>
            <strong>{u.gamesHosted}</strong>
          </div>
          <div className="profileSummary-row">
            <span>{t('profile.gamesJoined')}</span>
            <strong>{u.gamesJoined}</strong>
          </div>
        </div>
      </section>

      <div className="userProfile-actions">
        {u.username && (
          <button
            type="button"
            className="btn"
            onClick={() => openTelegramUser(u.username!)}
            data-analytics-label="user-profile-telegram"
          >
            <Icon name="message-01" size={16} />
            {t('userProfile.openTelegram')}
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost userProfile-block"
          disabled={blockMut.isLoading}
          onClick={async () => {
            const ok = await confirmDialog(t('userProfile.blockConfirm', { name: fullName }));
            if (ok) blockMut.mutate();
          }}
          data-analytics-label="user-profile-block"
        >
          <Icon name="user-remove-01" size={16} />
          {t('userProfile.block')}
        </button>
        <Link to="/blacklist" className="userProfile-blacklistLink">
          {t('profile.blacklist')}
        </Link>
      </div>
    </div>
  );
}
