import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "react-query";
import { useApi, SKILL_LEVELS, SKILL_LEVEL_LABELS, SKILL_LEVEL_DESCRIPTIONS, SkillLevel } from "../api";
import { useTelegram } from "../tg";
import { Photo } from "../Photo";
import { Icon, IconName } from "../Icon";
import "./Welcome.css";

const STEPS = ["intro", "skill", "done"] as const;
type Step = (typeof STEPS)[number];

const SKILL_ICONS: Record<SkillLevel, IconName> = {
  LEVEL_1: "tennis-ball",
  LEVEL_2: "play",
  LEVEL_3: "medal-01",
  LEVEL_4: "award-01",
  LEVEL_5: "star",
  LEVEL_6: "crown",
};

/**
 * Full-screen onboarding shown only on first visit (when skillLevel is null).
 * Walks the user through: greeting -> pick skill level -> confirm -> home.
 */
export function WelcomePage() {
  const api = useApi();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, webApp, photoUrl } = useTelegram();
  const [step, setStep] = useState<Step>("intro");
  const [selected, setSelected] = useState<SkillLevel | null>(null);
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
        // Persist a local "onboarded" flag so the welcome page never pops up
        // again for this device, even if the server temporarily returns
        // skillLevel=null.
        try {
          localStorage.setItem("volley:onboarded:v1", "1");
        } catch {}
        setStep("done");
        webApp?.HapticFeedback?.notificationOccurred?.("success");
        // Brief celebration then auto-dismiss to home
        setTimeout(() => navigate("/", { replace: true }), 1400);
      },
    },
  );

  const firstName = user?.first_name ?? "friend";

  return (
    <div className="welcome">
      {/* === Progress dots === */}
      <div className="welcome-progress" aria-hidden="true">
        {STEPS.map((s, i) => (
          <span
            key={s}
            className={`welcome-dot ${i <= STEPS.indexOf(step) ? "welcome-dot-active" : ""}`}
          />
        ))}
      </div>

      {step === "intro" && (
        <div className="welcome-step welcome-fadeIn">
          <div className="welcome-hero">
            <div className="welcome-avatar">
              <Photo src={photoUrl} name={firstName} size={88} />
              <div className="welcome-avatarGlow" aria-hidden="true" />
            </div>
            <h1 className="welcome-title">
              Welcome, {firstName}!
            </h1>
            <p className="welcome-sub">
              VolleyBot helps you find and organize volleyball games in your city.
              Let's set up your profile in 30 seconds.
            </p>
          </div>

          <div className="welcome-features">
            <div className="welcome-feature">
              <div className="welcome-featureIcon">
                <Icon name="tennis-ball" size={18} />
              </div>
              <div>
                <div className="welcome-featureTitle">Find games near you</div>
                <div className="welcome-featureDesc">Open games in your city, filtered by skill level.</div>
              </div>
            </div>
            <div className="welcome-feature">
              <div className="welcome-featureIcon">
                <Icon name="user-group" size={18} />
              </div>
              <div>
                <div className="welcome-featureTitle">Join with one tap</div>
                <div className="welcome-featureDesc">See who's playing, split the court cost, get reminders.</div>
              </div>
            </div>
            <div className="welcome-feature">
              <div className="welcome-featureIcon">
                <Icon name="plus-sign" size={18} />
              </div>
              <div>
                <div className="welcome-featureTitle">Organize your own game</div>
                <div className="welcome-featureDesc">Pick a venue, time, and skill — invite players in seconds.</div>
              </div>
            </div>
          </div>

          <button className="btn welcome-cta" onClick={() => setStep("skill")}>
            Get started
            <Icon name="arrow-right-01" size={18} />
          </button>

          <p className="welcome-foot">
            You can always change this later in Profile.
          </p>
        </div>
      )}

      {step === "skill" && (
        <div className="welcome-step welcome-fadeIn">
          <div className="welcome-skillHeader">
            <h1 className="welcome-title">What's your playing level?</h1>
            <p className="welcome-sub">
              Pick the level that best describes how you play. We'll match you with
              games at similar levels.
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
                      <div className="welcome-levelLabel">{SKILL_LEVEL_LABELS[level]}</div>
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
                      {SKILL_LEVEL_DESCRIPTIONS[level]}
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
              {save.isLoading ? "Saving…" : "Continue"}
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
            <Icon name="check" size={56} />
          </div>
          <h1 className="welcome-title">You're all set!</h1>
          <p className="welcome-sub">
            Loading your home page…
          </p>
        </div>
      )}
    </div>
  );
}