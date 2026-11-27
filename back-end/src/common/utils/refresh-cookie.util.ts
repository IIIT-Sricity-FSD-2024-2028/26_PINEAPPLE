import { CookieOptions } from 'express';

export const USER_REFRESH_COOKIE_NAME = 'teamforge_refresh_token';
export const DEFAULT_ADMIN_REFRESH_COOKIE_NAME = 'teamforge_admin_refresh_token';
export const ADMIN_REFRESH_SERVICE = 'ADMIN_REFRESH_SERVICE';

/**
 * Parse a human-readable duration string (e.g. "15m", "12h", "7d", "30s") or numeric ms string
 * into milliseconds, falling back to `fallbackMs` on invalid inputs.
 */
export function parseDurationMs(raw: string | undefined, fallbackMs: number): number {
  if (!raw || typeof raw !== 'string') return fallbackMs;
  const trimmed = raw.trim();
  if (!trimmed) return fallbackMs;

  if (/^\d+$/.test(trimmed)) {
    const num = Number(trimmed);
    return Number.isFinite(num) && num > 0 ? num : fallbackMs;
  }

  const match = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)$/i.exec(trimmed);
  if (!match) return fallbackMs;

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (!Number.isFinite(value) || value <= 0) return fallbackMs;

  switch (unit) {
    case 'ms':
      return Math.floor(value);
    case 's':
      return Math.floor(value * 1000);
    case 'm':
      return Math.floor(value * 60_000);
    case 'h':
      return Math.floor(value * 3_600_000);
    case 'd':
      return Math.floor(value * 86_400_000);
    default:
      return fallbackMs;
  }
}

export function getAdminRefreshCookieName(): string {
  return process.env.ADMIN_REFRESH_COOKIE_NAME || DEFAULT_ADMIN_REFRESH_COOKIE_NAME;
}

export function getUserRefreshCookieOptions(maxAgeMs?: number): CookieOptions {
  const isProduction = process.env.NODE_ENV === 'production';
  const base: CookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
  };
  return typeof maxAgeMs === 'number' ? { ...base, maxAge: maxAgeMs } : base;
}

export function getAdminRefreshCookieOptions(maxAgeMs?: number): CookieOptions {
  const isProduction = process.env.NODE_ENV === 'production';
  const base: CookieOptions = {
    httpOnly: true,
    sameSite: 'strict',
    secure: isProduction,
    path: '/admin/auth',
  };
  return typeof maxAgeMs === 'number' ? { ...base, maxAge: maxAgeMs } : base;
}

export function setRefreshCookie(
  res: any,
  cookieName: string,
  value: string,
  options: CookieOptions,
): void {
  if (!res || typeof res.cookie !== 'function') return;
  res.cookie(cookieName, value, options);
}

export function clearRefreshCookie(
  res: any,
  cookieName: string,
  options: CookieOptions,
): void {
  if (!res || typeof res.clearCookie !== 'function') return;
  const { maxAge: _omit, ...clearOpts } = options || {};
  res.clearCookie(cookieName, clearOpts);
}

/**
 * Safely extract a named cookie from Express `req.cookies` or raw `Cookie` header.
 */
export function extractCookieFromRequest(req: any, cookieName: string): string | null {
  const parsedValue = req?.cookies?.[cookieName];
  if (typeof parsedValue === 'string' && parsedValue.length > 0) {
    return parsedValue;
  }

  const rawHeader = req?.headers?.cookie;
  if (typeof rawHeader !== 'string' || !rawHeader.trim()) {
    return null;
  }

  const pairs = rawHeader.split(';');
  for (const pair of pairs) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = pair.slice(0, eqIndex).trim();
    if (key === cookieName) {
      const val = pair.slice(eqIndex + 1).trim();
      if (!val) return null;
      try {
        return decodeURIComponent(val);
      } catch {
        return val;
      }
    }
  }
  return null;
}
