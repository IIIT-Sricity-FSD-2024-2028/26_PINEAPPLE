import { useState, useMemo } from 'react';
import './Avatar.css';

/**
 * Computes up to 2 uppercase initials from a name or handle.
 */
function getInitials(name) {
  if (!name || typeof name !== 'string') return 'TF';
  const parts = name.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return 'TF';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Generates a stable pastel / brand background color index for initials based on string hash.
 */
const BG_PALETTES = [
  'tf-avatar-bg-0',
  'tf-avatar-bg-1',
  'tf-avatar-bg-2',
  'tf-avatar-bg-3',
  'tf-avatar-bg-4',
  'tf-avatar-bg-5',
];

function getBgClass(str) {
  if (!str) return BG_PALETTES[0];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % BG_PALETTES.length;
  return BG_PALETTES[idx];
}

/**
 * Reusable Avatar component supporting image URLs, fallback initials, size variants, and online status.
 * @param {Object} props
 * @param {string} [props.name]
 * @param {string} [props.src]
 * @param {'xs'|'sm'|'md'|'lg'|'xl'} [props.size='md']
 * @param {string} [props.alt]
 * @param {string} [props.className]
 * @param {Object} [props.style]
 * @param {'online'|'offline'|'busy'|null} [props.status]
 * @param {React.ReactNode} [props.children]
 */
const Avatar = ({
  name = '',
  src = '',
  size = 'md',
  alt = '',
  className = '',
  style = {},
  status = null,
  children,
  ...rest
}) => {
  const [imgError, setImgError] = useState(false);

  const initials = useMemo(() => getInitials(name), [name]);
  const bgClass = useMemo(() => getBgClass(name), [name]);

  const hasValidImage = Boolean(src) && !imgError;

  return (
    <div
      className={`tf-avatar tf-avatar--${size} ${!hasValidImage ? bgClass : ''} ${className}`.trim()}
      style={style}
      title={name || alt}
      aria-label={alt || name || 'Avatar'}
      {...rest}
    >
      {hasValidImage ? (
        <img
          src={src}
          alt={alt || name || 'User avatar'}
          className="tf-avatar-img"
          onError={() => setImgError(true)}
        />
      ) : children ? (
        children
      ) : (
        <span className="tf-avatar-initials">{initials}</span>
      )}

      {status && (
        <span
          className={`tf-avatar-status tf-avatar-status--${status}`}
          aria-label={`Status: ${status}`}
        />
      )}
    </div>
  );
};

export default Avatar;
