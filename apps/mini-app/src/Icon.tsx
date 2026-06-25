import type { CSSProperties } from "react";

/**
 * Renders a Hugeicons Stroke Rounded icon as an inline `<i>` with the
 * `hgi-stroke` + `hgi-<name>` classes. The webfont itself is loaded once
 * in index.html from https://use.hugeicons.com/font/icons.css.
 *
 * Color is inherited via `currentColor`, so the icon takes the colour of
 * the surrounding text. `size` is applied as `font-size` (in px).
 */
export type IconName =
  | "maps"
  | "map-pin"
  | "calendar-01"
  | "clock-01"
  | "note-01"
  | "user-account"
  | "user-group"
  | "bell-dot"
  | "tennis-ball"
  | "plus-sign"
  | "building-01";

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export function Icon({ name, size = 16, className, style }: IconProps) {
  return (
    <i
      aria-hidden="true"
      className={["hgi-stroke", `hgi-${name}`, className].filter(Boolean).join(" ")}
      style={{ fontSize: size, lineHeight: 1, ...style }}
    />
  );
}
