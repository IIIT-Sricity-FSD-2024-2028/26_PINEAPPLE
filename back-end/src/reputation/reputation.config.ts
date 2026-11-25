export const REPUTATION_CONFIG = {
  START_POINTS: 100,
  MIN_POINTS: 0,
  MAX_POINTS: 100,

  // Decreasing penalty rules
  WARNING_PENALTY: -10,
  WARNING_REMOVED_RESTORATION: 10,
  DEADLINE_PENALTY: -5,

  // Good conduct recovery rules
  RECOVERY_DAYS: 14,
  RECOVERY_POINTS: 2,

  // Contribution verification rules
  TASK_MIN_REVIEW_GAP_MINUTES: 60,
  WEEKLY_PAIR_TASK_CAP: 10,

  // Trust label criteria
  NEW_MEMBER_MAX_TASKS: 2,
  NEW_MEMBER_MAX_DAYS: 14,

  TRUSTED_MIN_REP: 90,
  TRUSTED_MIN_TASKS: 10,
  TRUSTED_MIN_PROJECTS: 2,
  TRUSTED_MIN_ON_TIME: 80,
  TRUSTED_MAX_SUSPENSION_DAYS: 90,

  RELIABLE_MIN_REP: 80,
  RELIABLE_MIN_TASKS: 5,
  RELIABLE_MIN_ON_TIME: 70,

  // Needs attention threshold (admin-only flag)
  NEEDS_ATTENTION_THRESHOLD: 60,

  // Standing band boundaries
  GOOD_STANDING_MIN: 80,
  FAIR_STANDING_MIN: 60,
} as const;

export type ReputationConfig = typeof REPUTATION_CONFIG;
