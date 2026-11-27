import { normalizeRole } from './role.util';

export interface AdminUserCounts {
  total: number;
  active: number;
  suspended: number;
  flagged: number;
  warned: number;
  possibleDuplicates: number;
  pendingApprovals: number;
}

/**
 * Canonical definition of a regular platform user across the admin portal.
 * Returns true for non-deleted, non-anonymised, non-duplicate, non-hidden
 * accounts whose role is not an admin or Super User (collaborators, owners, mentors, users).
 */
export function isPlatformUser(account: any): boolean {
  if (!account || typeof account !== 'object') return false;
  if (account.isDeleted === true || Boolean(account.deletedAt)) return false;
  if (account.anonymized === true || account.isAnonymized === true) return false;
  if (account.isDuplicate === true || account.isHidden === true) return false;

  const emailLower = String(account.email || '').trim().toLowerCase();
  const nameLower = String(account.name || account.profile?.fullName || '')
    .trim()
    .toLowerCase();
  if (emailLower.endsWith('@deleted.local') || nameLower === 'deleted user') {
    return false;
  }

  if (account.portalRole !== undefined && account.portalRole !== null) {
    return false;
  }

  const id = String(account.id || '').trim();
  if (id === 'u-admin' || id === 'u-superuser') {
    return false;
  }

  const normRole = normalizeRole(account.role);
  if (normRole === 'admin' || normRole === 'superuser') {
    return false;
  }

  return true;
}
