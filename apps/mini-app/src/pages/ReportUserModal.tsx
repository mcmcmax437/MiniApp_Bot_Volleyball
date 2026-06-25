import { useState } from 'react';
import { useMutation, useQueryClient } from 'react-query';
import { useApi } from '../api';
import { useI18n } from '../i18n';
import { Icon } from '../Icon';
import { Modal } from '../Modal';

const REASONS = [
  { id: 'TOXIC', icon: 'cancel-01' as const },
  { id: 'SKIPPED_GAME', icon: 'calendar-01' as const },
  { id: 'HARASSMENT', icon: 'user-warning' as const },
  { id: 'CHEATING', icon: 'shield-01' as const },
  { id: 'OTHER', icon: 'note-01' as const },
];

interface Props {
  open: boolean;
  target: { id: string; name: string } | null;
  gameId: string;
  onClose: () => void;
}

export function ReportUserModal({ open, target, gameId, onClose }: Props) {
  const api = useApi();
  const { t } = useI18n();
  const qc = useQueryClient();
  const [reason, setReason] = useState<string>('');
  const [details, setDetails] = useState('');
  const [done, setDone] = useState(false);

  const submitMut = useMutation(
    () =>
      api.fileReport({
        targetId: target!.id,
        reason,
        gameId,
        details: details.trim() || undefined,
      }),
    {
      onSuccess: () => {
        setDone(true);
        setTimeout(() => {
          setDone(false);
          setReason('');
          setDetails('');
          onClose();
        }, 1400);
      },
    },
  );

  if (!target) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={done ? t('report.thanks') : t('report.title')}
    >
      {done ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0' }}>
          <Icon name="check" size={36} style={{ color: 'var(--success)' }} />
          <p style={{ marginTop: 8, color: 'var(--text-tertiary)' }}>{target.name}</p>
        </div>
      ) : (
        <>
          <p style={{ color: 'var(--text-tertiary)', marginBottom: 12 }}>
            {target.name}
          </p>
          <div className="optionList">
            {REASONS.map((r) => (
              <button
                type="button"
                key={r.id}
                className={`optionItem ${reason === r.id ? 'isSelected' : ''}`}
                onClick={() => setReason(r.id)}
              >
                <Icon name={r.icon} size={16} />
                <span>{t(`report.reason.${r.id.toLowerCase()}`)}</span>
              </button>
            ))}
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label className="field-label">{t('report.details')}</label>
            <textarea
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={1000}
            />
          </div>
          {submitMut.isError && (
            <div className="error">
              <Icon name="bell-dot" size={14} />
              <span>{(submitMut.error as Error).message}</span>
            </div>
          )}
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={onClose} type="button">
              {t('common.cancel')}
            </button>
            <button
              className="btn danger"
              onClick={() => submitMut.mutate()}
              disabled={!reason || submitMut.isLoading}
              type="button"
            >
              <Icon name="report" size={14} />
              {t('report.submit')}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}