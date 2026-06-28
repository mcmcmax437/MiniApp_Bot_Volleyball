import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "react-query";
import { useApi, SKILL_LEVELS, SkillLevel } from "../api";
import { useTelegram } from "../tg";
import { useI18n } from "../i18n";
import { Photo } from "../Photo";
import { Icon, IconName } from "../Icon";
import "./Welcome.css";

const STEPS_ONBOARD: readonly Step[] = ["intro", "skill", "done"];
const STEPS_CHANGE: readonly Step[] = ["skill", "done"];
type Step = "intro" | "skill" | "done";

const SKILL_ICONS: Record<SkillLevel, IconName> = {
  LEVEL_1: "tennis-ball",
  LEVEL_2: "play",
  LEVEL_3: "medal-01",
  LEVEL_4: "award-01",
  LEVEL_5: "star",
  LEVEL_6: "crown",
};

interface WelcomePageProps {
  /**
   * `onboard` — first-time greeting flow shown only when `skillLevel` is null
   *              on the server. Walks: intro → skill → done → home.
   * `change`  — re-entry from the home/profile tap-to-change button. Skips
   *              the intro, skips writing the localStorage "onboarded"
   *              flag, and pops back to the previous screen on success.
   */
  mode?: "onboard" | "change";
  /**
   * Level to pre-select when the user enters the picker. Only used in
   * `mode === "change"`. Defaults to no pre-selection.
   */
  initialLevel?: SkillLevel | null;
}

/**
 * Full-screen onboarding shown only on first visit (when skillLevel is null),
 * OR the "change your level" flow reachable from the home/profile badge.
 */
export function WelcomePage({ mode = "onboard", initialLevel = null }: WelcomePageProps = {}) {
  const api = useApi();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, webApp, photoUrl } = useTelegram();
  const { t } = useI18n();
  const STEPS = mode === "change" ? STEPS_CHANGE : STEPS_ONBOARD;
  const [step, setStep] = useState<Step>(mode === "change" ? "skill" : "intro");
  const [selected, setSelected] = useState<SkillLevel | null>(initialLevel);
  const [expandedLevel, setExpandedLevel] = useState<SkillLevel | null>(null);

  const save = useMutation(
    () => api.updateMe({ skillLevel: selected! }),
    {
      onSuccess: (updatedUser) => {
        // Patch the cached "me" entry immediately so the home page never
        // re-shows the onboarding banner with stale data, then refetch in
        // the background to make sure we have the latest server state.
        if (updatedUser) {
          qc.setQueryData(["me"], updatedUser);
        }
        qc.invalidateQueries(["me"]);
        // Persist a local "onboarded" flag so the welcome page never pops
        // up again for this device, even if the server temporarily returns
        // skillLevel=null. Only relevant for the first-time onboard flow —
        // a returning "change my level" visit shouldn't write this flag.
        if (mode === "onboard") {
          try {
            localStorage.setItem("volley:onboarded:v1", "1");
          } catch {}
        }
        setStep("done");
        webApp?.HapticFeedback?.notificationOccurred?.("success");
        // Brief celebration then auto-dismiss to home. In "change" mode
        // we go back to wherever the user came from instead of pushing
        // them all the way to the root.
        const nextTimeout = mode === "change" ? 900 : 1400;
        setTimeout(
          () =>
            mode === "change"
              ? navigate(-1)
              : navigate("/", { replace: true }),
          nextTimeout,
        );
      },
    },
  );

  const firstName = user?.first_name ?? "friend";

  const isChange = mode === "change";

  return (
    <div className="welcome">
      {isChange && step !== "done" && (
        <button
          type="button"
          className="welcome-backBtn"
          onClick={() => navigate(-1)}
          aria-label={t('common.close')}
          data-analytics-label="welcome-change-back"
        >
          <Icon name="arrow-left-01" size={16} />
          <span>{t('common.cancel')}</span>
        </button>
      )}
      {/* === Progress dots === */}
      <div className="welcome-progress" aria-hidden="true">
        {STEPS.map((s, i) => {
          const activeIdx = STEPS.indexOf(step as Step);
          return (
            <span
              key={s}
              className={`welcome-dot ${i <= activeIdx ? "welcome-dot-active" : ""}`}
            />
          );
        })}
      </div>

      {step === "intro" && (
        <div className="welcome-step welcome-fadeIn">
          <div className="welcome-hero">
            <div className="welcome-avatar">
              <Photo src={photoUrl} name={firstName} size={88} />
              <div className="welcome-avatarGlow" aria-hidden="true" />
            </div>
            <h1 className="welcome-title">
              {t('welcome.hello', { name: firstName })}
            </h1>
            <p className="welcome-sub">
              {t('welcome.intro')}
            </p>
          </div>

          <div className="welcome-features">
            <div className="welcome-feature">
              <div className="welcome-featureIcon">
                <Icon name="tennis-ball" size={18} />
              </div>
              <div>
                <div className="welcome-featureTitle">{t('welcome.feature.findGames.title')}</div>
                <div className="welcome-featureDesc">{t('welcome.feature.findGames.desc')}</div>
              </div>
            </div>
            <div className="welcome-feature">
              <div className="welcome-featureIcon">
                <Icon name="user-group" size={18} />
              </div>
              <div>
                <div className="welcome-featureTitle">{t('welcome.feature.join.title')}</div>
                <div className="welcome-featureDesc">{t('welcome.feature.join.desc')}</div>
              </div>
            </div>
            <div className="welcome-feature">
              <div className="welcome-featureIcon">
                <Icon name="plus-sign" size={18} />
              </div>
              <div>
                <div className="welcome-featureTitle">{t('welcome.feature.organize.title')}</div>
                <div className="welcome-featureDesc">{t('welcome.feature.organize.desc')}</div>
              </div>
            </div>
          </div>

          <button className="btn welcome-cta" onClick={() => setStep("skill")}>
            {t('welcome.getStarted')}
            <Icon name="arrow-right-01" size={18} />
          </button>

          <p className="welcome-foot">
            {t('welcome.footNote')}
          </p>
        </div>
      )}

      {step === "skill" && (
        <div className="welcome-step welcome-fadeIn">
          <div className="welcome-skillHeader">
            <h1 className="welcome-title">
              {isChange ? t('welcome.changeMode.title') : t('welcome.skill.title')}
            </h1>
            <p className="welcome-sub">
              {isChange ? t('welcome.changeMode.subtitle') : t('welcome.skill.subtitle')}
            </p>
          </div>

          <div className="welcome-levelList">
            {SKILL_LEVELS.map((level, i) => {
              const isSelected = selected === level;
              const isExpanded = expandedLevel === level;
              return (
                <button
                  key={level}
                  type="button"
                  className={`welcome-level ${isSelected ? "welcome-level-active" : ""}`}
                  onClick={() => {
                    webApp?.HapticFeedback?.selectionChanged?.();
                    setSelected(level);
                  }}
                >
                  <div className="welcome-levelRow">
                    <div className="welcome-levelNum">{i + 1}</div>
                    <div className="welcome-levelIcon">
                      <Icon name={SKILL_ICONS[level]} size={20} />
                    </div>
                    <div className="welcome-levelText">
                      <div className="welcome-levelLabel">{t(`skill.${level}`)}</div>
                    </div>
                    <button
                      type="button"
                      className="welcome-levelInfo"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedLevel(isExpanded ? null : level);
                      }}
                      aria-label="Show description"
                    >
                      <Icon name={isExpanded ? "arrow-up-01" : "arrow-down-01"} size={14} />
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="welcome-levelDesc">
                      {t(`skill.${level}.desc`)}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="welcome-actions">
            <button
              className="btn"
              disabled={!selected || save.isLoading}
              onClick={() => save.mutate()}
            >
              {save.isLoading
                ? t('welcome.skill.saving')
                : isChange
                ? t('welcome.changeMode.cta')
                : t('welcome.skill.cta')}
              {!save.isLoading && <Icon name="arrow-right-01" size={18} />}
            </button>
            {save.isError && (
              <div className="error" style={{ marginTop: 12 }}>
                <Icon name="bell-dot" size={16} />
                <span>{(save.error as Error).message}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="welcome-step welcome-fadeIn welcome-done">
          <div className="welcome-doneCheck">
            <Icon name="checkmark-badge-01" size={56} />
          </div>
          <h1 className="welcome-title">
            {isChange ? t('welcome.changeMode.successTitle') : t('welcome.done.title')}
          </h1>
          <p className="welcome-sub">
            {isChange ? t('welcome.changeMode.successSub') : t('welcome.done.subtitle')}
          </p>
        </div>
      )}
    </div>
  );
}
