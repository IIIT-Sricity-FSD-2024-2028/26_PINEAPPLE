/**
 * Utility functions for URL security validation and classification.
 */

/**
 * Checks if a string is a safe, valid HTTP/HTTPS URL.
 * Rejects javascript:, data:, vbscript:, file:, ftp:, empty strings, and length > 2048.
 */
export function isSafeHttpUrl(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 2048) return false;

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:') ||
    lower.startsWith('ftp:') ||
    lower.startsWith('http:///') ||
    lower.startsWith('https:///')
  ) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') return false;
    if (!parsed.hostname || parsed.hostname.trim().length === 0) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks whether a valid URL points to an external destination.
 */
export function isExternalUrl(value) {
  if (!isSafeHttpUrl(value)) return false;
  try {
    const parsed = new URL(value.trim());
    if (typeof window !== 'undefined' && window.location) {
      return parsed.host !== window.location.host;
    }
    return true;
  } catch {
    return false;
  }
}
