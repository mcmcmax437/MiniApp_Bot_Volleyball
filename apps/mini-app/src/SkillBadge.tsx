import { SkillLevel, SKILL_LEVELS } from './api';
import { useI18n } from './i18n';
import { Icon } from './Icon';

interface SkillBadgeProps {
  level: SkillLevel | null | undefined;
  /** Replace the S1–S6 code with a wheelchair icon (admin-configured). */
  wheelchair?: boolean;
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

const ICON_SIZE: Record<NonNullable<SkillBadgeProps['size']>, number> = {
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
};

/**
 * Compact pill that shows skill as `S1`…`S6`, or a wheelchair icon when
 * `wheelchair` is set. Optional `withLabel` appends the localized name.
 */
export function SkillBadge({
  level,
  wheelchair,
  size = 'md',
  withLabel,
  title,
  className,
}: SkillBadgeProps) {
  const { t } = useI18n();
  const extra = className ? ` ${className}` : '';

  if (wheelchair) {
    // Icon-only: red wheelchair on a white pill — never show skill text.
    const label = t('skill.wheelchair');
    return (
      <span
        className={`skillBadge skillBadge-wheelchair skillBadge-${size}${extra}`}
        title={title ?? label}
        aria-label={label}
      >
        <Icon name="wheelchair" size={ICON_SIZE[size]} className="skillBadge-icon" />
      </span>
    );
  }

  if (!level || !SKILL_LEVELS.includes(level)) {
    return <span className={`skillBadge skillBadge-empty${extra}`}>—</span>;
  }
  const num = SKILL_LEVELS.indexOf(level) + 1;
  const label = t(`skill.${level}`);
  return (
    <span
      className={`${classFor(level)} skillBadge-${size}${extra}`}
      title={title ?? `${label} · S${num}`}
      aria-label={label}
    >
      <span className="skillBadge-code">S{num}</span>
      {withLabel && <span className="skillBadge-label">{label}</span>}
    </span>
  );
}
