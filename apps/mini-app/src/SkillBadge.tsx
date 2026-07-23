import { SkillLevel, SKILL_LEVELS } from './api';
import { useI18n } from './i18n';

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
 * Compact pill that shows skill as `S1`…`S6`. Optional `withLabel` appends
 * the localized human name via `skill.LEVEL_N` i18n keys.
 */
export function SkillBadge({ level, size = 'md', withLabel, title, className }: SkillBadgeProps) {
  const { t } = useI18n();
  if (!level || !SKILL_LEVELS.includes(level)) {
    return <span className={`skillBadge skillBadge-empty${className ? ` ${className}` : ''}`}>—</span>;
  }
  const num = SKILL_LEVELS.indexOf(level) + 1;
  const label = t(`skill.${level}`);
  return (
    <span
      className={`${classFor(level)} skillBadge-${size}${className ? ` ${className}` : ''}`}
      title={title ?? `${label} · S${num}`}
      aria-label={label}
    >
      <span className="skillBadge-code">S{num}</span>
      {withLabel && <span className="skillBadge-label">{label}</span>}
    </span>
  );
}
