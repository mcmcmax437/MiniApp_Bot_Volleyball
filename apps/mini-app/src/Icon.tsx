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
  | "building-01"
  | "home-01"
  | "game"
  | "fire"
  | "award-01"
  | "crown"
  | "medal-01"
  | "star"
  | "check-unread-01"
  | "checkmark-badge-01"
  | "checkmark-circle-01"
  | "checkmark-square-01"
  | "arrow-right-01"
  | "logout-01"
  | "settings-01"
  | "dollar-01"
  | "shirt-01"
  | "ticket-01"
  | "play"
  | "arrow-up-01"
  | "arrow-down-01"
  | "edit-01"
  | "search-01"
  | "filter"
  | "refresh"
  | "menu-01"
  | "more-horizontal"
  | "cancel-01"
  | "image-01"
  | "security"
  | "chart-line-data-01"
  | "user-add-01"
  | "delete-01"
  | "view"
  | "view-off"
  | "minus-sign"
  | "information-circle"
  | "globe"
  | "flag-01"
  | "send-01"
  | "mail-01"
  | "message-01"
  | "lock"
  | "lock-unlocked-01"
  | "image-02"
  | "credit-card"
  | "gift"
  | "flag-02"
  | "flag-03"
  | "wallet-01"
  | "thumbs-up"
  | "thumbs-down"
  | "calendar-02"
  | "calendar-03"
  | "global-search"
  | "task-01"
  | "target-01"
  | "chart-bar"
  | "fire-02"
  | "logout-02"
  | "logout-03"
  | "wallet-02"
  | "user-block"
  | "user-block-01"
  | "user-remove-01"
  | "user-warning"
  | "chart-pie"
  | "shield-01"
  | "shield-user"
  | "pin"
  | "target"
  | "unpin"
  | "calendar-add-01"
  | "arrow-left-01"
  | "arrow-right-02"
  | "left-to-right-list"
  | "ai-generate"
  | "magic-wand-01"
  | "loading"
  | "save-01";

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
