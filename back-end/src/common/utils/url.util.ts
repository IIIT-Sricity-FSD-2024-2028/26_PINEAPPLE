import { BadRequestException } from '@nestjs/common';

/**
 * Validates that a user-supplied string is a safe HTTP or HTTPS URL:
 * - Must be a string
 * - Length between 1 and 2048 characters
 * - Scheme must be strictly http: or https: (case-insensitive)
 * - Must parse via standard URL constructor and contain a non-empty host
 * - Rejects javascript:, data:, vbscript:, file:, ftp:, and malformed inputs
 */
export function isSafeHttpUrl(value: any): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 2048) {
    return false;
  }

  // Quick rejection of obvious script / data / file schemes or triple slash
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
    if (protocol !== 'http:' && protocol !== 'https:') {
      return false;
    }

    // Must contain a non-empty host / hostname
    if (!parsed.hostname || parsed.hostname.trim().length === 0) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Asserts that the given URL is safe according to isSafeHttpUrl.
 * If invalid, optionally logs an audit entry and throws 400 INVALID_URL.
 */
export function assertSafeHttpUrl(
  value: any,
  fieldName = 'url',
  userId?: string,
  auditService?: any,
): void {
  if (!isSafeHttpUrl(value)) {
    if (auditService && typeof auditService.log === 'function') {
      try {
        auditService.log({
          action: 'INVALID_URL_REJECTED',
          actor: userId ? String(userId) : 'System',
          target: fieldName,
          entityType: 'url',
          entityId: fieldName,
          event: `Rejected unsafe URL for field "${fieldName}"`,
          details: { userId, field: fieldName },
        });
      } catch (err: any) {
        console.warn('[url.util] Failed to log INVALID_URL_REJECTED audit entry:', err?.message || err);
      }
    }

    throw new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      code: 'INVALID_URL',
      message: `Invalid URL for ${fieldName}. URL must start with http:// or https://, be at most 2048 characters, and contain a valid host.`,
    });
  }
}
