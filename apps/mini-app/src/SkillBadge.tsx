import { SkillLevel, SKILL_LEVELS, SKILL_LEVEL_LABELS } from './api';

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
 * Compact pill that shows skill as `S1`…`S6`. Solid per-level colors keep
 * the badge readable on photos and dark UI — the old translucent chips
 * blended into avatars. Optional `withLabel` appends the human name
 * (Beginner / Advanced / …) for roomier surfaces like Profile.
 */
export function SkillBadge({ level, size = 'md', withLabel, title, className }: SkillBadgeProps) {
  if (!level || !SKILL_LEVELS.includes(level)) {
    return <span className={`skillBadge skillBadge-empty${className ? ` ${className}` : ''}`}>—</span>;
  }
  const num = SKILL_LEVELS.indexOf(level) + 1;
  const label = SKILL_LEVEL_LABELS[level];
  return (
    <span
      className={`${classFor(level)} skillBadge-${size}${className ? ` ${className}` : ''}`}
      title={title ?? `Skill ${num} · ${label}`}
      aria-label={`Skill level ${num}`}
    >
      <span className="skillBadge-code">S{num}</span>
      {withLabel && <span className="skillBadge-label">{label}</span>}
    </span>
  );
}
