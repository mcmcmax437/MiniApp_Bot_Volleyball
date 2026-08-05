import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useApi, SkillLevel, SKILL_LEVELS, EvaluationCandidate } from '../api';
import { useI18n } from '../i18n';
import { Icon, IconName } from '../Icon';
import { Photo } from '../Photo';
import { AdminCrownBadge, isAdminUser } from '../AdminCrownBadge';
import { effectiveSkillLevel } from '../lib/skill';
import { Modal } from '../Modal';
import './EvaluatePlayersModal.css';

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
 *  - `confirmed` — level chosen ("Looks right" or chip)
 *  - `changing`  — picker open to change a known level
 *  - `skipped`   — explicitly skipped
 *  - `pending`   — not touched (treated as skip on submit)
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
      // Only POST players the user actually rated. Pending / skipped are
      // left out — that is how "skip some players" works.
      const items = Object.entries(selected)
        .filter(([id, lvl]) => {
          if (status[id] === 'skipped' || status[id] === 'pending') return false;
          if (!lvl) return false;
          const prev = candQ.data?.candidates.find((c) => c.id === id);
          return !prev?.alreadyRated || prev.ratedAs !== lvl;
        })
        .map(([evaluateeId, skillLevel]) => ({ evaluateeId, skillLevel }));
      if (items.length === 0) {
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
        }, 1200);
      },
    },
  );

  const ratedCount = useMemo(() => {
    if (!candQ.data) return 0;
    return candQ.data.candidates.filter((c) => {
      if (c.alreadyRated) return true;
      const s = status[c.id];
      return (s === 'confirmed' || s === 'changing') && !!selected[c.id];
    }).length;
  }, [candQ.data, status, selected]);

  const skippedCount = useMemo(() => {
    if (!candQ.data) return 0;
    return candQ.data.candidates.filter((c) => status[c.id] === 'skipped').length;
  }, [candQ.data, status]);

  // Submit if the user rated at least one player, or explicitly skipped
  // everyone (Done). Untouched players are implicit skips on submit.
  const canSubmit =
    !!candQ.data &&
    !candQ.isLoading &&
    (ratedCount > 0 ||
      skippedCount === candQ.data.candidates.length ||
      candQ.data.candidates.every((c) => c.alreadyRated) ||
      candQ.data.candidates.length === 0);

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
      className="modal-compact evalModal"
    >
      {done ? (
        <div className="evalModal-thanks">
          <Icon name="checkmark-circle-01" size={36} style={{ color: 'var(--success)' }} />
        </div>
      ) : (
        <>
          <div className="evalModal-body">
            <p className="evalModal-hint">{t('eval.subtitle')}</p>
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
            <div className="evalModal-list">
              {candQ.data?.candidates.map((c) => {
                const effective = effectiveSkillLevel(c as unknown as EvaluationCandidate);
                const num = effective ? SKILL_LEVELS.indexOf(effective) + 1 : null;
                const s = status[c.id] ?? 'pending';
                const isSkipped = s === 'skipped';
                // Chip grid only when there's no known level yet, or the user
                // explicitly chose "Suggest a different level". Never after
                // "Looks right" (`confirmed`) — that was opening the picker
                // by mistake.
                const showPicker =
                  !isSkipped &&
                  !c.alreadyRated &&
                  s !== 'confirmed' &&
                  (!effective || num == null || s === 'changing');
                // Prefer "Looks right" only when they have a level and haven't
                // started picking chips yet.
                const showLooksRight =
                  !isSkipped &&
                  !c.alreadyRated &&
                  effective &&
                  num != null &&
                  s === 'pending';

                return (
                  <div
                    key={c.id}
                    className={`evalCard${isSkipped ? ' isSkipped' : ''}${s === 'confirmed' ? ' isRated' : ''}`}
                  >
                    <div className="evalCard-head">
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
                      <span className="evalCard-name">
                        {c.firstName}{c.lastName ? ` ${c.lastName}` : ''}
                      </span>
                      {c.alreadyRated && (
                        <span className="tag">{t('eval.alreadyRated')}</span>
                      )}
                      {isSkipped && (
                        <span className="tag">{t('eval.skipped')}</span>
                      )}
                      {s === 'confirmed' && !c.alreadyRated && selected[c.id] && (
                        <>
                          <span className="tag">
                            {t('eval.levelN', { n: SKILL_LEVELS.indexOf(selected[c.id]) + 1 })}
                          </span>
                          <button
                            type="button"
                            className="evalCard-skip isUndo"
                            onClick={() => toggleChange(c.id, selected[c.id] ?? effective)}
                            data-analytics-label="eval-change-after-confirm"
                          >
                            {t('eval.suggestDifferent')}
                          </button>
                        </>
                      )}
                      {!c.alreadyRated && !isSkipped && s !== 'confirmed' && (
                        <button
                          type="button"
                          className="evalCard-skip"
                          onClick={() => skipPlayer(c.id)}
                          data-analytics-label="eval-skip-player"
                        >
                          {t('eval.skipPlayer')}
                        </button>
                      )}
                      {isSkipped && (
                        <button
                          type="button"
                          className="evalCard-skip isUndo"
                          onClick={() => undoSkip(c.id)}
                          data-analytics-label="eval-undo-skip"
                        >
                          {t('eval.undoSkip')}
                        </button>
                      )}
                    </div>

                    {showLooksRight && (
                      <div className="evalActions">
                        <button
                          type="button"
                          className="btn btn-sm"
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
                      </div>
                    )}

                    {showPicker && !showLooksRight && (
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
                        {s === 'changing' && effective && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => toggleChange(c.id, effective)}
                            data-analytics-label="eval-suggest-cancel"
                            style={{ alignSelf: 'flex-start' }}
                          >
                            <Icon name="arrow-left-01" size={12} />
                            {t('common.cancel')}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {submitMut.isError && (
            <div className="error">
              <Icon name="bell-dot" size={14} />
              <span>{(submitMut.error as Error).message}</span>
            </div>
          )}

          <div className="modal-actions evalModal-footer">
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
              {ratedCount > 0 ? t('eval.submit') : t('eval.done')}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
