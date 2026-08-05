import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useApi, SkillLevel, SKILL_LEVELS, EvaluationCandidate } from '../api';
import { useI18n } from '../i18n';
import { Icon, IconName } from '../Icon';
import { Photo } from '../Photo';
import { AdminCrownBadge, isAdminUser } from '../AdminCrownBadge';
import { effectiveSkillLevel } from '../lib/skill';
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

/**
 * Per-candidate status in this modal session:
 *  - `confirmed` — "Looks right" / level chosen
 *  - `changing`  — picker open to suggest a different level
 *  - `skipped`   — user chose not to rate this player
 *  - `pending`   — not touched yet
 */
type EvalStatus = 'confirmed' | 'changing' | 'skipped' | 'pending';

export function EvaluatePlayersModal({ open, gameId, onClose }: Props) {
  const api = useApi();
  const { t } = useI18n();
  const qc = useQueryClient();

  const [selected, setSelected] = useState<Record<string, SkillLevel>>({});
  const [status, setStatus] = useState<Record<string, EvalStatus>>({});
  const [done, setDone] = useState(false);

  const candQ = useQuery(
    ['evaluations', 'candidates', gameId],
    () => api.listEvaluationCandidates(gameId),
    { enabled: open },
  );

  useEffect(() => {
    if (!candQ.data) return;
    const initialSel: Record<string, SkillLevel> = {};
    const initialStat: Record<string, EvalStatus> = {};
    candQ.data.candidates.forEach((c) => {
      if (c.ratedAs) {
        initialSel[c.id] = c.ratedAs;
        initialStat[c.id] = 'confirmed';
      } else {
        initialStat[c.id] = 'pending';
      }
    });
    setSelected(initialSel);
    setStatus(initialStat);
    setDone(false);
  }, [candQ.data]);

  const submitMut = useMutation(
    () => {
      const items = Object.entries(selected)
        .filter(([id, lvl]) => {
          if (status[id] === 'skipped') return false;
          const prev = candQ.data?.candidates.find((c) => c.id === id);
          return !prev?.alreadyRated || prev.ratedAs !== lvl;
        })
        .map(([evaluateeId, skillLevel]) => ({ evaluateeId, skillLevel }));
      if (items.length === 0) {
        // All skipped / already rated — nothing to POST; still finish.
        return Promise.resolve({ count: 0 });
      }
      return api.submitEvaluations(gameId, items);
    },
    {
      onSuccess: () => {
        setDone(true);
        setTimeout(() => {
          setDone(false);
          qc.invalidateQueries(['me']);
          qc.invalidateQueries(['game', gameId]);
          qc.invalidateQueries(['evaluations', 'pending']);
          onClose();
        }, 1400);
      },
    },
  );

  const allReviewed = useMemo(() => {
    if (!candQ.data) return false;
    const candidates = candQ.data.candidates;
    if (candidates.length === 0) return true;
    return candidates.every((c) => {
      if (c.alreadyRated) return true;
      const s = status[c.id];
      if (s === 'skipped' || s === 'confirmed') return true;
      if (s === 'changing' && !!selected[c.id]) return true;
      return !!selected[c.id];
    });
  }, [candQ.data, status, selected]);

  const hasAnythingToSubmit = useMemo(() => {
    if (!candQ.data) return false;
    return Object.entries(selected).some(([id, lvl]) => {
      if (status[id] === 'skipped') return false;
      const prev = candQ.data!.candidates.find((c) => c.id === id);
      return !prev?.alreadyRated || prev.ratedAs !== lvl;
    });
  }, [selected, candQ.data, status]);

  const allSkippedOrRated = useMemo(() => {
    if (!candQ.data) return false;
    return candQ.data.candidates.every((c) => {
      if (c.alreadyRated) return true;
      return status[c.id] === 'skipped';
    });
  }, [candQ.data, status]);

  const canSubmit =
    allReviewed &&
    (hasAnythingToSubmit ||
      allSkippedOrRated ||
      !!candQ.data?.candidates.every((c) => c.alreadyRated));

  const pickLevel = (candidateId: string, lvl: SkillLevel) => {
    setSelected((prev) => ({ ...prev, [candidateId]: lvl }));
    setStatus((prev) => ({ ...prev, [candidateId]: 'confirmed' }));
  };

  const confirmLooksRight = (candidateId: string, effective: SkillLevel) => {
    setSelected((prev) => ({ ...prev, [candidateId]: effective }));
    setStatus((prev) => ({ ...prev, [candidateId]: 'confirmed' }));
  };

  const skipPlayer = (candidateId: string) => {
    setSelected((prev) => {
      const next = { ...prev };
      delete next[candidateId];
      return next;
    });
    setStatus((prev) => ({ ...prev, [candidateId]: 'skipped' }));
  };

  const undoSkip = (candidateId: string) => {
    setStatus((prev) => ({ ...prev, [candidateId]: 'pending' }));
  };

  const toggleChange = (candidateId: string, currentEffective: SkillLevel | null) => {
    setStatus((prev) => {
      const cur = prev[candidateId] ?? 'pending';
      const next: EvalStatus = cur === 'changing' ? 'confirmed' : 'changing';
      if (next === 'changing') {
        const seed = currentEffective ?? ('LEVEL_3' as SkillLevel);
        setSelected((p) => ({ ...p, [candidateId]: seed }));
      }
      return { ...prev, [candidateId]: next };
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={done ? t('eval.thanks') : t('eval.title')}
    >
      {done ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
          <Icon name="checkmark-circle-01" size={36} style={{ color: 'var(--success)' }} />
        </div>
      ) : (
        <>
          <p style={{ color: 'var(--text-tertiary)', marginBottom: 12 }}>{t('eval.subtitle')}</p>
          {candQ.isLoading && <div className="skeleton" style={{ height: 100, borderRadius: 10 }} />}
          {candQ.isError && (
            <div className="error" style={{ marginBottom: 12 }}>
              <Icon name="bell-dot" size={14} />
              <span>{(candQ.error as Error).message}</span>
            </div>
          )}
          {candQ.data && candQ.data.candidates.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-text">{t('eval.noPlayers')}</div>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {candQ.data?.candidates.map((c) => {
              const effective = effectiveSkillLevel(c as unknown as EvaluationCandidate);
              const num = effective ? SKILL_LEVELS.indexOf(effective) + 1 : null;
              const s = status[c.id] ?? 'pending';
              const isSkipped = s === 'skipped';

              return (
                <div
                  key={c.id}
                  className={`evalCard${isSkipped ? ' isSkipped' : ''}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Photo
                      src={c.photoUrl}
                      name={c.firstName}
                      size={36}
                      topLeftBadge={
                        isAdminUser(c) ? (
                          <AdminCrownBadge title={t('profile.status.admin')} size="sm" />
                        ) : null
                      }
                    />
                    <span style={{ fontWeight: 600, flex: 1, minWidth: 0 }}>
                      {c.firstName}{c.lastName ? ` ${c.lastName}` : ''}
                    </span>
                    {c.alreadyRated && (
                      <span className="tag">{t('eval.alreadyRated')}</span>
                    )}
                    {isSkipped && (
                      <span className="tag">{t('eval.skipped')}</span>
                    )}
                  </div>

                  {isSkipped ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => undoSkip(c.id)}
                      data-analytics-label="eval-undo-skip"
                      style={{ alignSelf: 'flex-start' }}
                    >
                      <Icon name="arrow-left-01" size={12} />
                      {t('eval.undoSkip')}
                    </button>
                  ) : c.alreadyRated ? null : effective && num != null && s !== 'changing' ? (
                    <div className="evalActions">
                      <button
                        type="button"
                        className={`btn btn-sm ${s === 'confirmed' ? '' : 'btn-ghost'}`}
                        onClick={() => confirmLooksRight(c.id, effective)}
                        data-analytics-label="eval-looks-right"
                      >
                        <Icon name="checkmark-square-01" size={14} />
                        {t('eval.looksRight', { n: num })}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => toggleChange(c.id, effective)}
                        data-analytics-label="eval-suggest-different"
                      >
                        <Icon name="edit-01" size={14} />
                        {t('eval.suggestDifferent')}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => skipPlayer(c.id)}
                        data-analytics-label="eval-skip-player"
                      >
                        <Icon name="cancel-01" size={14} />
                        {t('eval.skipPlayer')}
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="skillChipGrid">
                        {SKILL_LEVELS.map((s2, i) => (
                          <button
                            type="button"
                            key={s2}
                            className={`skillChip ${selected[c.id] === s2 ? 'isActive' : ''}`}
                            onClick={() => pickLevel(c.id, s2)}
                            aria-label={`${c.firstName} level ${i + 1}`}
                          >
                            <span className="skillChip-icon">
                              <Icon name={SKILL_ICONS[s2]} size={12} />
                            </span>
                            <span className="skillChip-num">{i + 1}</span>
                          </button>
                        ))}
                      </div>
                      <div className="evalActions">
                        {s === 'changing' && effective && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => toggleChange(c.id, effective)}
                            data-analytics-label="eval-suggest-cancel"
                          >
                            <Icon name="arrow-left-01" size={12} />
                            {t('common.cancel')}
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => skipPlayer(c.id)}
                          data-analytics-label="eval-skip-player"
                        >
                          <Icon name="cancel-01" size={14} />
                          {t('eval.skipPlayer')}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          {submitMut.isError && (
            <div className="error">
              <Icon name="bell-dot" size={14} />
              <span>{(submitMut.error as Error).message}</span>
            </div>
          )}
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              data-analytics-label="eval-skip-all"
            >
              {t('eval.skipAll')}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => submitMut.mutate()}
              disabled={!canSubmit || submitMut.isLoading}
              data-analytics-label="eval-submit"
            >
              <Icon name="checkmark-square-01" size={14} />
              {allSkippedOrRated && !hasAnythingToSubmit
                ? t('eval.done')
                : t('eval.submit')}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
