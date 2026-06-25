import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useApi, SkillLevel, SKILL_LEVELS } from '../api';
import { useI18n } from '../i18n';
import { Icon, IconName } from '../Icon';
import { Photo } from '../Photo';
import { Modal } from '../Modal';

const SKILL_ICONS: Record<SkillLevel, IconName> = {
  LEVEL_1: 'tennis-ball',
  LEVEL_2: 'play',
  LEVEL_3: 'medal-01',
  LEVEL_4: 'award-01',
  LEVEL_5: 'star',
  LEVEL_6: 'crown',
};

interface Props {
  open: boolean;
  gameId: string;
  onClose: () => void;
}

export function EvaluatePlayersModal({ open, gameId, onClose }: Props) {
  const api = useApi();
  const { t } = useI18n();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Record<string, SkillLevel>>({});
  const [done, setDone] = useState(false);

  const candQ = useQuery(['evaluations', 'candidates', gameId], () =>
    api.listEvaluationCandidates(gameId),
  { enabled: open });

  // Pre-fill from previously rated
  useEffect(() => {
    if (!candQ.data) return;
    const initial: Record<string, SkillLevel> = {};
    candQ.data.candidates.forEach((c) => {
      if (c.ratedAs) initial[c.id] = c.ratedAs;
    });
    setSelected(initial);
  }, [candQ.data]);

  const submitMut = useMutation(
    () => {
      const items = Object.entries(selected)
        .filter(([id, lvl]) => {
          // only submit if the value changed from the previously-rated value
          const prev = candQ.data?.candidates.find((c) => c.id === id);
          return !prev?.alreadyRated || prev.ratedAs !== lvl;
        })
        .map(([evaluateeId, skillLevel]) => ({ evaluateeId, skillLevel }));
      return api.submitEvaluations(gameId, items);
    },
    {
      onSuccess: () => {
        setDone(true);
        setTimeout(() => {
          setDone(false);
          qc.invalidateQueries(['me']);
          qc.invalidateQueries(['game', gameId]);
          onClose();
        }, 1400);
      },
    },
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={done ? t('eval.thanks') : t('eval.title')}
    >
      {done ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
          <Icon name="check" size={36} style={{ color: 'var(--success)' }} />
        </div>
      ) : (
        <>
          <p style={{ color: 'var(--text-tertiary)', marginBottom: 12 }}>{t('eval.subtitle')}</p>
          {candQ.isLoading && <div className="skeleton" style={{ height: 100, borderRadius: 10 }} />}
          {candQ.data && candQ.data.candidates.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-text">No co-players to rate.</div>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {candQ.data?.candidates.map((c) => (
              <div
                key={c.id}
                style={{
                  background: 'var(--surface-1)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 12,
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Photo src={c.photoUrl} name={c.firstName} size={36} />
                  <span style={{ fontWeight: 600 }}>
                    {c.firstName}{c.lastName ? ` ${c.lastName}` : ''}
                  </span>
                  {c.alreadyRated && (
                    <span className="tag">{t('eval.alreadyRated')}</span>
                  )}
                </div>
                <div className="skillChipGrid">
                  {SKILL_LEVELS.map((s, i) => (
                    <button
                      type="button"
                      key={s}
                      className={`skillChip ${selected[c.id] === s ? 'isActive' : ''}`}
                      onClick={() => setSelected((prev) => ({ ...prev, [c.id]: s }))}
                      aria-label={`${c.firstName} level ${i + 1}`}
                    >
                      <span className="skillChip-icon">
                        <Icon name={SKILL_ICONS[s]} size={12} />
                      </span>
                      <span className="skillChip-num">{i + 1}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {submitMut.isError && (
            <div className="error">
              <Icon name="bell-dot" size={14} />
              <span>{(submitMut.error as Error).message}</span>
            </div>
          )}
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={onClose}>{t('eval.skip')}</button>
            <button
              className="btn"
              onClick={() => submitMut.mutate()}
              disabled={Object.keys(selected).length === 0 || submitMut.isLoading}
            >
              <Icon name="check" size={14} />
              {t('eval.submit')}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}