import { Icon } from './Icon';

/** Small orange crown for ADMIN / superadmin — matches Profile photo badge. */
export function AdminCrownBadge({
  title,
  size = 'md',
}: {
  title?: string;
  /** `sm` for compact game-card avatars (~28px). */
  size?: 'sm' | 'md';
}) {
  return (
    <span
      className={`profilePhotoStatus profilePhotoStatus-admin${size === 'sm' ? ' profilePhotoStatus-sm' : ''}`}
      title={title}
      aria-label={title ?? 'Admin'}
    >
      <Icon name="crown" size={size === 'sm' ? 8 : 10} />
    </span>
  );
}

export function isAdminUser(
  u?: { role?: string | null; isSuperAdmin?: boolean } | null,
): boolean {
  return !!u && (u.isSuperAdmin === true || u.role === 'ADMIN');
}
