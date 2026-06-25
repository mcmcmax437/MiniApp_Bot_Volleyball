import { useState } from 'react';
import { Icon } from './Icon';
import './Photo.css';

interface PhotoProps {
  /** Telegram photo URL (time-limited, signed). */
  src: string | null;
  /** User's display name — used for the fallback initials and alt text. */
  name: string;
  /** Optional size in px (default 40). */
  size?: number;
  /** Visual variant. */
  variant?: 'circle' | 'rounded';
  /** Extra class name on the wrapper. */
  className?: string;
}

/**
 * Renders a Telegram profile photo, falling back to initials on the brand
 * gradient if the photo is missing or fails to load. The gradient rotates
 * through 4 palettes so consecutive users don't all look the same.
 */
export function Photo({ src, name, size = 40, variant = 'circle', className }: PhotoProps) {
  const [error, setError] = useState(false);
  const initials = name
    ? name
        .split(/\s+/)
        .map((p) => p[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '';

  // Stable gradient index derived from name length, so the same user
  // always gets the same colour without needing a hash function.
  const gradientIndex = name.length % 4;

  const wrapperStyle = {
    width: size,
    height: size,
    fontSize: Math.max(11, Math.round(size * 0.4)),
  };

  const showPhoto = src && !error;

  return (
    <span
      className={`photo photo-${variant}${showPhoto ? ' photo-has-image' : ''}${className ? ` ${className}` : ''}`}
      style={wrapperStyle}
      aria-label={name ? `${name}'s avatar` : 'avatar'}
      role="img"
    >
      {showPhoto ? (
        <img
          src={src}
          alt=""
          onError={() => setError(true)}
          loading="lazy"
          decoding="async"
        />
      ) : initials ? (
        <span className={`photo-initials photo-gradient-${gradientIndex}`}>{initials}</span>
      ) : (
        <span className={`photo-fallback photo-gradient-${gradientIndex}`}>
          <Icon name="user-account" size={Math.round(size * 0.55)} />
        </span>
      )}
    </span>
  );
}