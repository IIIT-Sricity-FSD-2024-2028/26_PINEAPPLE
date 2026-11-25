import { REVIEW_CREDIT_CONFIG } from './review-credit.config';

export interface CalculateReviewCreditParams {
  submittedAt?: string | Date | null;
  rejectedAt?: string | Date | null;
  dueDate?: string | Date | null;
  mode?: 'ALWAYS' | 'ONLY_IF_OVERDUE';
  minMinutes?: number;
  perEventCapDays?: number;
  perTaskCapDays?: number;
  creditedSoFarMs?: number;
  projectDueDate?: string | Date | null;
}

export interface ReviewCreditResult {
  creditMs: number;
  creditMinutes: number;
  newDueDate: string | null;
  previousDueDate: string | null;
  reviewDurationMs: number;
  formattedDuration: string;
  requiresProjectExtension: boolean;
  minProjectDueDate: string | null;
  skippedReason?: string;
}

/**
 * Format milliseconds into human-readable duration like "3 days 4 hours" or "2 hours".
 */
export function formatDurationWords(durationMs: number): string {
  if (!durationMs || durationMs <= 0) return '0 minutes';

  const totalMinutes = Math.floor(durationMs / (60 * 1000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days > 0) {
    parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
  }
  if (hours > 0) {
    parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
  }
  if (days === 0 && hours === 0 && minutes > 0) {
    parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
  }

  return parts.length > 0 ? parts.join(' ') : '0 minutes';
}

/**
 * Pure calculator for task review time credit.
 * Calculates how much time to credit to a task's due date after owner review/rejection.
 */
export function calculateReviewCredit(params: CalculateReviewCreditParams): ReviewCreditResult {
  const {
    submittedAt,
    rejectedAt,
    dueDate,
    mode = REVIEW_CREDIT_CONFIG.MODE,
    minMinutes = REVIEW_CREDIT_CONFIG.MIN_MINUTES,
    perEventCapDays = REVIEW_CREDIT_CONFIG.MAX_PER_EVENT_DAYS,
    perTaskCapDays = REVIEW_CREDIT_CONFIG.MAX_PER_TASK_DAYS,
    creditedSoFarMs = 0,
    projectDueDate,
  } = params;

  if (!dueDate || isNaN(new Date(dueDate).getTime())) {
    return {
      creditMs: 0,
      creditMinutes: 0,
      newDueDate: null,
      previousDueDate: null,
      reviewDurationMs: 0,
      formattedDuration: '0 minutes',
      requiresProjectExtension: false,
      minProjectDueDate: null,
      skippedReason: 'MISSING_OR_INVALID_DUE_DATE',
    };
  }

  const prevDueIso = new Date(dueDate).toISOString();

  if (!submittedAt || isNaN(new Date(submittedAt).getTime()) || !rejectedAt || isNaN(new Date(rejectedAt).getTime())) {
    return {
      creditMs: 0,
      creditMinutes: 0,
      newDueDate: prevDueIso,
      previousDueDate: prevDueIso,
      reviewDurationMs: 0,
      formattedDuration: '0 minutes',
      requiresProjectExtension: false,
      minProjectDueDate: null,
      skippedReason: 'MISSING_SUBMISSION_OR_REJECTION_TIME',
    };
  }

  const subMs = new Date(submittedAt).getTime();
  const rejMs = new Date(rejectedAt).getTime();
  const origDueMs = new Date(dueDate).getTime();

  if (subMs >= rejMs) {
    return {
      creditMs: 0,
      creditMinutes: 0,
      newDueDate: prevDueIso,
      previousDueDate: prevDueIso,
      reviewDurationMs: 0,
      formattedDuration: '0 minutes',
      requiresProjectExtension: false,
      minProjectDueDate: null,
      skippedReason: 'SUBMISSION_NOT_BEFORE_REJECTION',
    };
  }

  const reviewDurationMs = rejMs - subMs;
  const formattedDuration = formatDurationWords(reviewDurationMs);

  const minDurationMs = minMinutes * 60 * 1000;
  if (reviewDurationMs < minDurationMs) {
    return {
      creditMs: 0,
      creditMinutes: 0,
      newDueDate: prevDueIso,
      previousDueDate: prevDueIso,
      reviewDurationMs,
      formattedDuration,
      requiresProjectExtension: false,
      minProjectDueDate: null,
      skippedReason: 'BELOW_MIN_DURATION',
    };
  }

  if (mode === 'ONLY_IF_OVERDUE' && origDueMs >= rejMs) {
    return {
      creditMs: 0,
      creditMinutes: 0,
      newDueDate: prevDueIso,
      previousDueDate: prevDueIso,
      reviewDurationMs,
      formattedDuration,
      requiresProjectExtension: false,
      minProjectDueDate: null,
      skippedReason: 'NOT_OVERDUE',
    };
  }

  const perEventCapMs = perEventCapDays * 24 * 60 * 60 * 1000;
  const perTaskCapMs = perTaskCapDays * 24 * 60 * 60 * 1000;
  const remainingTaskCapMs = Math.max(0, perTaskCapMs - creditedSoFarMs);

  const creditMs = Math.min(reviewDurationMs, perEventCapMs, remainingTaskCapMs);
  const creditMinutes = Math.floor(creditMs / (60 * 1000));

  if (creditMs <= 0) {
    return {
      creditMs: 0,
      creditMinutes: 0,
      newDueDate: prevDueIso,
      previousDueDate: prevDueIso,
      reviewDurationMs,
      formattedDuration,
      requiresProjectExtension: false,
      minProjectDueDate: null,
      skippedReason: 'CAP_EXCEEDED',
    };
  }

  const newDueMs = origDueMs + creditMs;
  const newDueDate = new Date(newDueMs).toISOString();

  let requiresProjectExtension = false;
  let minProjectDueDate: string | null = null;

  if (projectDueDate && !isNaN(new Date(projectDueDate).getTime())) {
    const projDueMs = new Date(projectDueDate).getTime();
    if (newDueMs > projDueMs) {
      requiresProjectExtension = true;
      minProjectDueDate = newDueDate;
    }
  }

  return {
    creditMs,
    creditMinutes,
    newDueDate,
    previousDueDate: prevDueIso,
    reviewDurationMs,
    formattedDuration,
    requiresProjectExtension,
    minProjectDueDate,
  };
}
