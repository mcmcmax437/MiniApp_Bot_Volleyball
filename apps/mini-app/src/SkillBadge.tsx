import { SkillLevel, SKILL_LEVELS, SKILL_LEVEL_LABELS } from './api';
import { Icon, IconName } from './Icon';

const SKILL_ICONS: Record<SkillLevel, IconName> = {
  LEVEL_1: 'tennis-ball',
  LEVEL_2: 'play',
  LEVEL_3: 'medal-01',
  LEVEL_4: 'award-01',
  LEVEL_5: 'star',
  LEVEL_6: 'crown',
};

interface SkillBadgeProps {
  level: SkillLevel | null | undefined;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  withLabel?: boolean;
  title?: string;
  /**
   * Extra class names. Used by callers that need to position the badge
   * (e.g. `skillBadge-on-photo` for the bottom-right corner of an avatar)
   * or to override sizing for a specific context.
   */
  className?: string;
}

function classFor(level: SkillLevel): string {
  return `skillBadge skillBadge-${level.toLowerCase()}`;
}

/**
 * Tiny pill that shows the skill number 1-6 with the matching icon. Used on
 * the profile photo and inline in participant lists. Falls back to a generic
 * pill if `level` is null.
 */
export function SkillBadge({ level, size = 'md', withLabel, title, className }: SkillBadgeProps) {
  if (!level || !SKILL_LEVELS.includes(level)) {
    return <span className={`skillBadge skillBadge-empty${className ? ` ${className}` : ''}`}>—</span>;
  }
  const num = SKILL_LEVELS.indexOf(level) + 1;
  return (
    <span
      className={`${classFor(level)} skillBadge-${size}${className ? ` ${className}` : ''}`}
      title={title ?? `Level ${num}`}
      aria-label={`Skill level ${num}`}
    >
      <Icon name={SKILL_ICONS[level]} size={size === 'sm' ? 10 : size === 'lg' ? 16 : size === 'xl' ? 20 : 12} />
      <span className="skillBadge-num">{num}</span>
      {withLabel && <span className="skillBadge-label">{SKILL_LEVEL_LABELS[level]}</span>}
    </span>
  );
}