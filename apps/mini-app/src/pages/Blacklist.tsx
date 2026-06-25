import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useApi, BlacklistEntry } from '../api';
import { useI18n } from '../i18n';
import { Icon } from '../Icon';
import { Photo } from '../Photo';
import { SkillBadge } from '../SkillBadge';

export function BlacklistPage() {
  const api = useApi();
  const qc = useQueryClient();
  const { t } = useI18n();
  const [telegramId, setTelegramId] = useState('');
  const [reason, setReason] = useState('');

  const listQ = useQuery(['blacklist'], () => api.listBlacklist());

  const addMut = useMutation(
    () =>
      api.addBlacklist({
        telegramId: telegramId.trim() || undefined,
        reason: reason.trim() || undefined,
      }),
    {
      onSuccess: () => {
        setTelegramId('');
        setReason('');
        qc.invalidateQueries(['blacklist']);
      },
    },
  );

  const removeMut = useMutation((blockedId: string) => api.removeBlacklist(blockedId), {
    onSuccess: () => qc.invalidateQueries(['blacklist']),
  });

  const count = listQ.data?.length ?? 0;
  const maxed = count >= 10;

  return (
    <div className="blacklistPage">
      <header className="page-header">
        <div className="page-header-icon">
          <Icon name="user-block" size={20} />
        </div>
        <div>
          <h1 className="page-header-title">{t('blacklist.title')}</h1>
          <p className="page-header-sub">
            {count} / 10
          </p>
        </div>
      </header>

      <section className="card formSection">
        <h2 className="formSection-title">
          <span className="formSection-num"><Icon name="plus-sign" size={12} /></span>
          {t('blacklist.add')}
        </h2>
        <div className="field">
          <label className="field-label">
            Telegram ID
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={telegramId}
            placeholder="123456789"
            onChange={(e) => setTelegramId(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="field-label">{t('blacklist.reason')}</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <button
          className="btn"
          disabled={!telegramId.trim() || maxed || addMut.isLoading}
          onClick={() => addMut.mutate()}
        >
          <Icon name="user-block" size={16} />
          {t('blacklist.add')}
        </button>
        {addMut.isError && (
          <div className="error">
            <Icon name="bell-dot" size={14} />
            <span>{(addMut.error as Error).message}</span>
          </div>
        )}
        {maxed && (
          <div className="field-hint" style={{ color: 'var(--text-warning, orange)' }}>
            {t('blacklist.maxed')}
          </div>
        )}
      </section>

      {listQ.isLoading && <div className="skeleton" style={{ height: 120, borderRadius: 12 }} />}

      {!listQ.isLoading && (listQ.data ?? []).length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Icon name="user-account" size={24} />
          </div>
          <div className="empty-state-title">{t('blacklist.empty')}</div>
        </div>
      )}

      <div className="blacklistList">
        {(listQ.data ?? []).map((entry: BlacklistEntry) => (
          <article key={entry.id} className="blacklistItem">
            <Photo
              src={entry.user.photoUrl}
              name={entry.user.firstName}
              size={44}
            />
            <div className="blacklistItem-info">
              <div className="blacklistItem-name">
                {entry.user.firstName}
                {entry.user.lastName ? ` ${entry.user.lastName}` : ''}
                {entry.user.username && (
                  <span className="blacklistItem-handle">@{entry.user.username}</span>
                )}
              </div>
              <div className="blacklistItem-meta">
                {entry.user.skillLevel && (
                  <SkillBadge level={entry.user.skillLevel} size="sm" />
                )}
                {entry.reason && <span className="blacklistItem-reason">{entry.reason}</span>}
              </div>
            </div>
            <button
              className="btn btn-ghost"
              onClick={() => removeMut.mutate(entry.blockedId)}
              disabled={removeMut.isLoading}
            >
              <Icon name="cancel-01" size={14} />
              {t('blacklist.remove')}
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}