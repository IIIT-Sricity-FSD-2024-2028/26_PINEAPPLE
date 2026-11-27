import { GamificationRepository } from '../gamification/gamification.repository';

export const USER_SECRET_FIELDS = new Set<string>([
  'password',
  'passwordHash',
  'salt',
  'refreshTokens',
  'token',
  'accessToken',
  'refreshToken',
  'resetToken',
  'resetCode',
  'resetTokenHash',
  'verificationToken',
  'emailVerificationToken',
  'otp',
  'otpCode',
  'otpHash',
  'codeHash',
  'otpSecret',
  'otpChallenge',
  'otpChallenges',
  'deletionCode',
  'deletionCodes',
  'deletionCodeHash',
  'accountDeletionCode',
  'deleteCode',
  'tokenVersion',
  'allowedLegacyJti',
]);

/**
 * Recursively strips secret fields (password hashes, tokens, reset codes, OTP data)
 * from any user-like object or array before returning it in HTTP responses.
 */
export function stripUserSecrets<T = any>(value: T): T {
  if (value === null || value === undefined || typeof value !== 'object') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString() as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => stripUserSecrets(item)) as unknown as T;
  }

  const out: Record<string, any> = {};
  for (const [key, val] of Object.entries(value as Record<string, any>)) {
    if (USER_SECRET_FIELDS.has(key)) {
      continue;
    }
    if (val !== null && typeof val === 'object') {
      out[key] = stripUserSecrets(val);
    } else {
      out[key] = val;
    }
  }
  return out as T;
}

/**
 * Canonical serializer for user records returned by any controller or service.
 */
export function serializeSafeUser(
  user: any,
  gamificationRepository?: GamificationRepository,
  reputationService?: { getTotal: (uid: string) => number },
): any {
  if (!user) return user;

  const hasPassword = Boolean(user.password || user.hasPassword);
  const safeUser = stripUserSecrets(user);
  safeUser.hasPassword = hasPassword;

  const effectiveCreatedAt =
    safeUser.createdAt || safeUser.profile?.createdAt || safeUser.profile?.joined;
  const effectiveUni =
    safeUser.university !== undefined && safeUser.university !== null
      ? safeUser.university
      : safeUser.profile?.university !== undefined && safeUser.profile?.university !== null
      ? safeUser.profile.university
      : safeUser.profile?.uni || '';

  if (safeUser.profile && typeof safeUser.profile === 'object') {
    safeUser.profile.createdAt = effectiveCreatedAt;
    safeUser.profile.joined = effectiveCreatedAt;
    safeUser.profile.university = effectiveUni;
    safeUser.profile.uni = effectiveUni;
  }
  safeUser.createdAt = effectiveCreatedAt;
  safeUser.university = effectiveUni;
  if (safeUser.updatedAt === undefined && safeUser.profile?.updatedAt !== undefined) {
    safeUser.updatedAt = safeUser.profile.updatedAt;
  }

  const rawAvatar =
    safeUser.avatarUrl ??
    safeUser.avatar ??
    safeUser.profile?.avatarUrl ??
    safeUser.profile?.avatar ??
    null;
  const canonicalAvatar =
    typeof rawAvatar === 'string' && rawAvatar.trim().length > 0 ? rawAvatar.trim() : null;
  safeUser.avatarUrl = canonicalAvatar;
  safeUser.avatar = canonicalAvatar;

  if (safeUser.profile && typeof safeUser.profile === 'object') {
    safeUser.profile.avatarUrl = canonicalAvatar;
    safeUser.profile.avatar = canonicalAvatar;
  }

  safeUser.phone = safeUser.phone || safeUser.profile?.phone || undefined;
  safeUser.phoneVerified = Boolean(safeUser.phoneVerified || safeUser.profile?.phoneVerified);
  safeUser.phoneVerifiedAt =
    safeUser.phoneVerifiedAt || safeUser.profile?.phoneVerifiedAt || undefined;
  safeUser.emailVerified = safeUser.emailVerified !== false;

  if (safeUser.profile && typeof safeUser.profile === 'object') {
    safeUser.profile.phone = safeUser.phone;
    safeUser.profile.phoneVerified = safeUser.phoneVerified;
    safeUser.profile.phoneVerifiedAt = safeUser.phoneVerifiedAt;
  }

  // Unified Gamification Ledger (XP) + Canonical ReputationService Ledger (Rep)
  try {
    if (gamificationRepository && safeUser.id) {
      const ledgerEntries = gamificationRepository.findByUserId(safeUser.id);
      if (ledgerEntries && ledgerEntries.length > 0) {
        const totalXp = ledgerEntries.reduce((s, e) => s + (Number(e.xp) || 0), 0);
        const tasksCompleted = ledgerEntries.filter((e) => Boolean(e.taskId)).length;

        if (safeUser.profile && typeof safeUser.profile === 'object') {
          safeUser.profile.xp = totalXp;
          if (tasksCompleted > 0) {
            safeUser.profile.tasksCount = Math.max(
              safeUser.profile.tasksCount || 0,
              tasksCompleted,
            );
          }
        }
        safeUser.xp = totalXp;
      }
    }

    if (reputationService && safeUser.id) {
      const repScore = Math.max(0, Number(reputationService.getTotal(String(safeUser.id))) || 0);
      if (safeUser.profile && typeof safeUser.profile === 'object') {
        safeUser.profile.rep = repScore;
      }
      safeUser.rep = repScore;
    }
  } catch (err: any) {
    console.warn('[user-serializer] Suppressed non-critical ledger sync error:', err?.message || err);
  }

  return stripUserSecrets(safeUser);
}
