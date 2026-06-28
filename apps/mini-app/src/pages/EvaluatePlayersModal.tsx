import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useApi, SkillLevel, SKILL_LEVELS, EvaluationCandidate } from '../api';
import { useI18n } from '../i18n';
import { Icon, IconName } from '../Icon';
import { Photo } from '../Photo';
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
 * Status of a single candidate's evaluation within this modal session:
 *  - `confirmed` — user tapped "Looks right" (effective level, no change)
 *  - `changing`  — user expanded the picker to suggest a different level
 *  - `pending`   — never touched (no opinion submitted yet)
 */
type EvalStatus = 'confirmed' | 'changing' | 'pending';

export function EvaluatePlayersModal({ open, gameId, onClose }: Props) {
  const api = useApi();
  const { t } = useI18n();
  const qc = useQueryClient();

  /**
   * Per-candidate chosen level. Absent key means "no opinion" — which the
   * server treats as a no-op (no `GameEvaluation` row is written). This is
   * how "Looks right" is implemented: we mark the candidate `confirmed`
   * but never put a different value into `selected`, so on submit nothing
   * changes and the aggregation is unaffected.
   */
  const [selected, setSelected] = useState<Record<string, SkillLevel>>({});
  /** Per-candidate UI status (controls whether the picker is expanded). */
  const [status, setStatus] = useState<Record<string, EvalStatus>>({});
  const [done, setDone] = useState(false);

  const candQ = useQuery(
    ['evaluations', 'candidates', gameId],
    () => api.listEvaluationCandidates(gameId),
    { enabled: open },
  );

  // Seed local state from the server. Pre-fill `selected` with whatever
  // the user previously submitted so the picker (when expanded) shows the
  // existing value. Default the status to `confirmed` when there's already
  // a row, otherwise `pending`.
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
  }, [candQ.data]);

  const submitMut = useMutation(
    () => {
      // Only submit items where the evaluator actively chose a different
      // level than the user's pre-existing row. "Looks right" is intentionally
      // a no-op against the server.
      const items = Object.entries(selected)
        .filter(([id, lvl]) => {
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

  const hasAnythingToSubmit = useMemo(() => {
    if (!candQ.data) return false;
    return Object.entries(selected).some(([id, lvl]) => {
      const prev = candQ.data!.candidates.find((c) => c.id === id);
      return !prev?.alreadyRated || prev.ratedAs !== lvl;
    });
  }, [selected, candQ.data]);

  const pickLevel = (candidateId: string, lvl: SkillLevel) => {
    setSelected((prev) => ({ ...prev, [candidateId]: lvl }));
    setStatus((prev) => ({ ...prev, [candidateId]: 'changing' }));
  };

  const confirmLooksRight = (candidateId: string) => {
    // Remove any pending pick so the submit filter sees nothing to send.
    setSelected((prev) => {
      const next = { ...prev };
      delete next[candidateId];
      return next;
    });
    setStatus((prev) => ({ ...prev, [candidateId]: 'confirmed' }));
  };

  const toggleChange = (candidateId: string, currentEffective: SkillLevel | null) => {
    setStatus((prev) => {
      const cur = prev[candidateId] ?? 'pending';
      const next: EvalStatus = cur === 'changing' ? 'confirmed' : 'changing';
      const updates: Record<string, EvalStatus> = { [candidateId]: next };
      // When entering "changing" mode, seed the picker with the effective
      // level (or LEVEL_3 if there isn't one yet) so the user starts from a
      // sensible default.
      if (next === 'changing') {
        const seed = currentEffective ?? ('LEVEL_3' as SkillLevel);
        setSelected((p) => ({ ...p, [candidateId]: seed }));
      }
      return { ...prev, ...updates };
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
          {candQ.data && candQ.data.candidates.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-text">No co-players to rate.</div>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {candQ.data?.candidates.map((c) => {
              const effective = effectiveSkillLevel(c as unknown as EvaluationCandidate);
              const num = effective ? SKILL_LEVELS.indexOf(effective) + 1 : null;
              const s = status[c.id] ?? 'pending';
              return (
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
                  {/* Single primary "Looks right" action, plus an expandable
                      "Suggest a different level" disclosure. The picker grid
                      is only rendered when the user opts into change mode.
                      If the candidate has no level yet we go straight to the
                      picker so first-timers can still set one. */}
                  {effective && num != null && s !== 'changing' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        type="button"
                        className={`btn ${s === 'confirmed' ? '' : 'btn-ghost'} btn-sm`}
                        onClick={() => confirmLooksRight(c.id)}
                        style={{ flex: 1 }}
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
                  ) : s === 'changing' || !effective ? (
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
                  ) : null}
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
            <button className="btn btn-ghost" onClick={onClose}>{t('eval.skip')}</button>
            <button
              className="btn"
              onClick={() => submitMut.mutate()}
              disabled={!hasAnythingToSubmit || submitMut.isLoading}
              data-analytics-label="eval-submit"
            >
              <Icon name="checkmark-square-01" size={14} />
              {t('eval.submit')}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
