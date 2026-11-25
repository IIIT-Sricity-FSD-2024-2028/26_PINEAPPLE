export interface SuspendedResponsePayload {
  statusCode: 403;
  error: 'Forbidden';
  code: 'ACCOUNT_SUSPENDED';
  message: 'Your account is suspended.';
  reason: string;
  suspendedAt: string;
  suspensionType: 'manual' | 'automatic';
  appealAvailable: boolean;
  supportContact: string;
}

/**
 * Builds the canonical 403 ACCOUNT_SUSPENDED response payload.
 * Strictly guarantees that internal notes, moderator names, report details,
 * or credentials are never exposed in the response.
 */
export function buildSuspendedResponse(user: any): SuspendedResponsePayload {
  const rawReason =
    user?.suspensionReason ||
    user?.suspendedReason ||
    'Terms of service violation';

  const isAutomatic =
    (user as any)?.suspensionType === 'automatic' ||
    String(rawReason).toLowerCase().includes('automatic suspension') ||
    String(rawReason).toLowerCase().includes('after 4 warnings');

  const suspensionType: 'manual' | 'automatic' = isAutomatic ? 'automatic' : 'manual';
  const reason = isAutomatic ? 'Automatic suspension after 4 warnings' : String(rawReason).trim();
  const suspendedAt = user?.suspendedAt || new Date().toISOString();
  const supportContact = process.env.SUPPORT_EMAIL || 'support@teamforge.io';

  return {
    statusCode: 403,
    error: 'Forbidden',
    code: 'ACCOUNT_SUSPENDED',
    message: 'Your account is suspended.',
    reason,
    suspendedAt,
    suspensionType,
    appealAvailable: false,
    supportContact,
  };
}
