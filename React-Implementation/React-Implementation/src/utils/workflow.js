/**
 * Canonical XP and Reputation reward configuration across TeamForge.
 * Single source of truth:
 * - High: 40 XP, +8 Rep
 * - Medium: 20 XP, +8 Rep
 * - Low: 10 XP, +8 Rep
 */
export const TASK_REWARDS = {
  High: { xp: 40, rep: 8 },
  Medium: { xp: 20, rep: 8 },
  Low: { xp: 10, rep: 8 },
};

/**
 * Resolves the XP and Reputation reward based on difficulty or priority.
 * @param {string} [priorityOrDifficulty='Medium']
 * @returns {{ xp: number, rep: number }}
 */
export const getTaskReward = (priorityOrDifficulty) => {
  const norm = String(priorityOrDifficulty || '').trim().toLowerCase();
  if (norm === 'high' || norm === 'advanced') {
    return TASK_REWARDS.High;
  }
  if (norm === 'low' || norm === 'beginner') {
    return TASK_REWARDS.Low;
  }
  return TASK_REWARDS.Medium;
};

export default {
  TASK_REWARDS,
  getTaskReward,
};
