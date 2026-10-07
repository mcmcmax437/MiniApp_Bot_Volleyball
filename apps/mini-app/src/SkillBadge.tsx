import { SkillLevel, SKILL_LEVELS } from './api';
import { useI18n } from './i18n';

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

/** Square red badge sizes (px) — kept equal so the glyph never squashes. */
const WHEELCHAIR_BOX: Record<NonNullable<SkillBadgeProps['size']>, number> = {
  sm: 20,
  md: 22,
  lg: 28,
  xl: 36,
};

const WHEELCHAIR_ICON: Record<NonNullable<SkillBadgeProps['size']>, number> = {
  sm: 12,
  md: 14,
  lg: 18,
  xl: 22,
};

/** Proportional white wheelchair glyph (inline SVG — webfont was X-compressed). */
function WheelchairGlyph({ size }: { size: number }) {
  return (
    <svg
      className="skillBadge-wheelchairGlyph"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {/* Compact ISA-style mark; square viewBox keeps X/Y equal. */}
      <circle cx="13" cy="4" r="2.25" fill="currentColor" />
      <path
        fill="currentColor"
        d="M7.5 8.25a1.25 1.25 0 0 0 0 2.5h2.05l-.55 2.65A4.75 4.75 0 1 0 11.7 14l.45-2.25h2.35l1.85 3.55a1.25 1.25 0 1 0 2.2-1.15l-2.05-3.95A1.5 1.5 0 0 0 15.15 9H12.4l.35-1.75A1.25 1.25 0 0 0 11.55 5.5H9.75a1.25 1.25 0 0 0 0 2.5H7.5zm1.75 7.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"
      />
    </svg>
  );
}

/**
 * Compact pill that shows skill as `S1`…`S6`, or a wheelchair icon when
 * `wheelchair` is set. Optional `withLabel` appends the localized name
 * (ignored for wheelchair — icon only).
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
    // Icon-only: solid red circle + white wheelchair — never show skill text.
    const label = t('skill.wheelchair');
    const box = WHEELCHAIR_BOX[size];
    return (
      <span
        className={`skillBadge skillBadge-wheelchair skillBadge-${size}${extra}`}
        style={{ width: box, height: box }}
        title={title ?? label}
        aria-label={label}
      >
        <WheelchairGlyph size={WHEELCHAIR_ICON[size]} />
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
