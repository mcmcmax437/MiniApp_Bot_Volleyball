import { SkillLevel, SKILL_LEVELS } from './api';
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
  size?: 'sm' | 'md' | 'lg';
  withLabel?: boolean;
  title?: string;
}

function classFor(level: SkillLevel): string {
  return `skillBadge skillBadge-${level.toLowerCase()}`;
}

/**
 * Tiny pill that shows the skill number 1-6 with the matching icon. Used on
 * the profile photo and inline in participant lists. Falls back to a generic
 * pill if `level` is null.
 */
export function SkillBadge({ level, size = 'md', withLabel, title }: SkillBadgeProps) {
  if (!level || !SKILL_LEVELS.includes(level)) {
    return <span className="skillBadge skillBadge-empty">—</span>;
  }
  const num = SKILL_LEVELS.indexOf(level) + 1;
  return (
    <span
      className={`${classFor(level)} skillBadge-${size}`}
      title={title ?? `Level ${num}`}
      aria-label={`Skill level ${num}`}
    >
      <Icon name={SKILL_ICONS[level]} size={size === 'sm' ? 10 : size === 'lg' ? 16 : 12} />
      <span className="skillBadge-num">{num}</span>
      {withLabel && <span className="skillBadge-label">{level.replace('LEVEL_', '')}</span>}
    </span>
  );
}