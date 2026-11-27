/**
 * Validates the `?next=` redirect target for `/admin/login`.
 * Only in-portal paths strictly starting with `/admin/` (and not `/admin/login` or `//...`)
 * are accepted; anything else is ignored and falls back to `/admin`.
 */
export function sanitizeAdminNextPath(rawNext) {
  if (typeof rawNext !== 'string') return '/admin';
  const trimmed = rawNext.trim();
  if (!trimmed.startsWith('/admin/')) return '/admin';
  if (trimmed.startsWith('//') || trimmed.includes('://')) return '/admin';
  if (trimmed === '/admin/login' || trimmed.startsWith('/admin/login?') || trimmed.startsWith('/admin/login/')) {
    return '/admin';
  }
  return trimmed;
}
