/**
 * Returns the configured API base URL without trailing slashes.
 */
export function getMediaApiBaseUrl() {
  const configuredBase =
    typeof window !== 'undefined' && typeof window.TEAMFORGE_API_BASE_URL === 'string'
      ? window.TEAMFORGE_API_BASE_URL
      : '';
  const viteBase =
    typeof import.meta !== 'undefined'
      ? import.meta.env?.VITE_API_BASE_URL || import.meta.env?.VITE_API_URL || ''
      : '';
  const raw = configuredBase || viteBase || 'http://localhost:3000';
  return String(raw).replace(/\/+$/, '');
}

/**
 * Resolves a stored media path or URL (e.g. `/uploads/avatar-xxx.png` or `https://...`)
 * into a full image URL with optional cache-buster query `?v=<version>`.
 * Non-URL strings (e.g., emojis `'👧'` or plain initials `'A'`) return `null` so
 * Avatar components cleanly fall back to initials instead of requesting broken URLs.
 */
export function buildMediaUrl(rawPath, version = null) {
  if (!rawPath || typeof rawPath !== 'string') return null;
  const trimmed = rawPath.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;

  // Never serve or persist ephemeral blob: URLs via buildMediaUrl
  if (/^blob:/i.test(trimmed)) return null;

  // Base64 data URLs (image/* only) pass through as-is without query params
  if (/^data:image\//i.test(trimmed)) return trimmed;

  const isHttp = /^https?:\/\//i.test(trimmed);
  const isRelativePath = trimmed.startsWith('/');
  if (!isHttp && !isRelativePath) {
    return null;
  }

  const base = getMediaApiBaseUrl();
  const fullUrl = isHttp ? trimmed : `${base}${trimmed}`;

  const cleanVersion =
    version !== null && version !== undefined ? String(version).trim() : '';
  if (!cleanVersion) {
    return fullUrl;
  }

  // Only append cache-buster on our own API media URLs (or relative /uploads/ paths)
  if (isRelativePath || fullUrl.startsWith(base)) {
    const separator = fullUrl.includes('?') ? '&' : '?';
    if (!/[?&]v=/.test(fullUrl)) {
      return `${fullUrl}${separator}v=${encodeURIComponent(cleanVersion)}`;
    }
  }

  return fullUrl;
}
