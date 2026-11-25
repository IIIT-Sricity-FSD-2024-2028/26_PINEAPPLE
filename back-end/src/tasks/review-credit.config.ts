/**
 * Configuration defaults for Review Time Credit (Phase 29).
 */
export const REVIEW_CREDIT_CONFIG = {
  /** Master switch to enable or disable review credit calculations */
  ENABLED: true,

  /**
   * Mode:
   * - 'ALWAYS': Every valid review duration is credited forward.
   * - 'ONLY_IF_OVERDUE': Only applied if the task was overdue at review/rejection time.
   */
  MODE: 'ALWAYS' as 'ALWAYS' | 'ONLY_IF_OVERDUE',

  /** Minimum review duration in minutes to avoid instant-review noise (default 60 mins) */
  MIN_MINUTES: 60,

  /** Maximum review credit awarded per rejection event in days (default 14 days) */
  MAX_PER_EVENT_DAYS: 14,

  /** Maximum cumulative review credit across all rejection events per task in days (default 30 days) */
  MAX_PER_TASK_DAYS: 30,
};
