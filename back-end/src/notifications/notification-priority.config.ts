export type NotificationPriority = 'immediate' | 'digest';

export const MAX_DIGEST_ITEMS = 10;

export const IMMEDIATE_NOTIFICATION_TYPES: ReadonlySet<string> = new Set([
  // Digest summary itself
  'DAILY_DIGEST',

  // Warnings, suspensions, appeals, dual-approval moderation
  'ACCOUNT_WARNED',
  'ACCOUNT_WARNING',
  'WARNING',
  'warning',
  'success',
  'ACCOUNT_SUSPENDED',
  'ACCOUNT_REACTIVATED',
  'MENTOR_SUSPENDED',
  'SUSPENSION_APPEAL',
  'APPEAL_APPROVED',
  'APPEAL_REJECTED',
  'PENDING_MODERATION_APPROVAL',
  'MODERATION_APPROVAL_REQUEST',

  // Payments, escrow, payouts, refunds, disputes
  'ESCROW_FUNDED',
  'ESCROW_RELEASED',
  'ESCROW_REFUNDED',
  'ESCROW_DISPUTE_OPENED',
  'ESCROW_DISPUTE_DECIDED',
  'PAYMENT_CONFIRMED',
  'PAYMENT_EXPIRED',
  'PAYMENT_REFUNDED',
  'DISPUTE_OPENED',
  'DISPUTE_DECIDED',
  'DISPUTE_OVERDUE',
  'SESSION_DISPUTED',

  // Mentor session lifecycle & abandonment
  'MENTOR_SESSION_BOOKED',
  'MENTOR_SESSION_ACCEPTED',
  'MENTOR_SESSION_DECLINED',
  'MENTOR_SESSION_CANCELLED',
  'MENTOR_SESSION_STARTED',
  'MENTOR_SESSION_COMPLETED',
  'MENTOR_SESSION_EXPIRED',
  'MENTOR_SESSION_REFUNDED',
  'MENTOR_ABANDONMENT_REVIEW',
  'MENTOR_ABANDONMENT_REVIEW_OPENED',
  'MENTOR_ABANDONMENT_RESOLVED',
  'MENTOR_ABANDONMENT_RELEASED',
  'MENTOR_REVIEW_CONFIRMED',
  'MENTOR_REVIEW_CANCELLED',
  'MENTOR_INACTIVE_FIRST_WEEK',
  'MENTOR_INACTIVE_7D',
  'SESSION_CANCELLED',
  'MENTOR_FEEDBACK_REQUESTED',

  // Security, email verification, OTP, phone verification
  'SECURITY_ALERT',
  'EMAIL_VERIFICATION',
  'OTP_LOCKED',
  'PASSWORD_RESET',
  'PHONE_VERIFIED',

  // Urgent deadline reminders (<24h)
  'DEADLINE_REMINDER',
  'PROJECT_CLOSING_SOON',
  'REVIEW_REMINDER_URGENT',
]);

export const NOTIFICATION_PRIORITY_CONFIG: Record<string, NotificationPriority> = {
  // Immediate
  DAILY_DIGEST: 'immediate',
  ACCOUNT_WARNING: 'immediate',
  ACCOUNT_SUSPENDED: 'immediate',
  ACCOUNT_REACTIVATED: 'immediate',
  SUSPENSION_APPEAL: 'immediate',
  APPEAL_APPROVED: 'immediate',
  APPEAL_REJECTED: 'immediate',
  PENDING_MODERATION_APPROVAL: 'immediate',
  ESCROW_FUNDED: 'immediate',
  ESCROW_RELEASED: 'immediate',
  ESCROW_REFUNDED: 'immediate',
  PAYMENT_CONFIRMED: 'immediate',
  PAYMENT_EXPIRED: 'immediate',
  PAYMENT_REFUNDED: 'immediate',
  DISPUTE_OPENED: 'immediate',
  DISPUTE_DECIDED: 'immediate',
  SESSION_DISPUTED: 'immediate',
  MENTOR_SESSION_BOOKED: 'immediate',
  MENTOR_SESSION_ACCEPTED: 'immediate',
  MENTOR_SESSION_DECLINED: 'immediate',
  MENTOR_SESSION_CANCELLED: 'immediate',
  MENTOR_SESSION_STARTED: 'immediate',
  MENTOR_SESSION_COMPLETED: 'immediate',
  MENTOR_SESSION_EXPIRED: 'immediate',
  MENTOR_ABANDONMENT_REVIEW: 'immediate',
  MENTOR_ABANDONMENT_REVIEW_OPENED: 'immediate',
  MENTOR_ABANDONMENT_RESOLVED: 'immediate',
  MENTOR_ABANDONMENT_RELEASED: 'immediate',
  MENTOR_INACTIVE_FIRST_WEEK: 'immediate',
  SECURITY_ALERT: 'immediate',
  EMAIL_VERIFICATION: 'immediate',
  OTP_LOCKED: 'immediate',
  PASSWORD_RESET: 'immediate',
  DEADLINE_REMINDER: 'immediate',

  // Digest
  PROJECT_LIKE: 'digest',
  NEW_APPLICANT: 'digest',
  JOIN_REQUEST: 'immediate',
  TASK_COMMENT: 'digest',
  TASK_ASSIGNED: 'digest',
  TASK_SUBMITTED: 'digest',
  TASK_APPROVED: 'digest',
  TASK_REJECTED: 'digest',
  TASKS_RELEASED: 'digest',
  TASK_RELEASED: 'digest',
  BADGE_AWARDED: 'digest',
  LEADERBOARD_RANK: 'digest',
  PROJECT_UPDATE: 'digest',
  PROJECT_PAUSED: 'digest',
  APPLICATION_APPROVED: 'digest',
  APPLICATION_REJECTED: 'digest',
  PROJECT_INVITE: 'digest',
  MENTOR_RECOMMENDATION: 'digest',
  NEW_MESSAGE: 'digest',
  PROJECT_COMPLETED: 'digest',
  PROJECT_MEMBERSHIP_ENDED: 'digest',
  TASK_REVIEW_REMINDER: 'digest',
  TASK_AUTO_APPROVED: 'digest',
  TASK_UNASSIGNED: 'digest',
  OWNER_INACTIVE: 'digest',
  OWNER_INACTIVE_30D: 'digest',
  MEMBER_INACTIVE: 'digest',
  REQUEST_TIMEOUT: 'digest',
};

export function resolveNotificationPriority(
  input: {
    type?: string;
    priority?: string;
    metadata?: Record<string, any>;
  },
  nowMs: number = Date.now(),
): NotificationPriority {
  if (input?.priority === 'immediate') {
    return 'immediate';
  }

  const upperType = String(input?.type || '').trim().toUpperCase();
  if (upperType && IMMEDIATE_NOTIFICATION_TYPES.has(upperType)) {
    return 'immediate';
  }

  if (NOTIFICATION_PRIORITY_CONFIG[upperType] === 'immediate') {
    return 'immediate';
  }

  const meta = input?.metadata;
  if (meta) {
    if (meta.priority === 'immediate') {
      return 'immediate';
    }
    if (meta.deadlineHours !== undefined && meta.deadlineHours !== null) {
      const hours = Number(meta.deadlineHours);
      if (Number.isFinite(hours) && hours >= 0 && hours < 24) {
        return 'immediate';
      }
    }
    const deadlineIso = meta.deadlineAt || meta.dueAt || meta.expiresAt;
    if (deadlineIso) {
      const ts = new Date(deadlineIso).getTime();
      if (!Number.isNaN(ts)) {
        const hoursLeft = (ts - nowMs) / (60 * 60 * 1000);
        if (hoursLeft >= 0 && hoursLeft < 24) {
          return 'immediate';
        }
      }
    }
  }

  if (
    /^(WARN|SUSPEND|APPEAL|PAYMENT|REFUND|DISPUTE|ESCROW|SECURITY|OTP|ABANDON)/.test(upperType) ||
    /(WARNING|SUSPENDED|REACTIVATED|APPEAL|PAYMENT|REFUND|DISPUTE|ESCROW|SECURITY|OTP)/.test(upperType)
  ) {
    return 'immediate';
  }

  return 'digest';
}
