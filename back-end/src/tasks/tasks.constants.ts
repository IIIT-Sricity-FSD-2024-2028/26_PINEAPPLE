export const TASK_REWARDS = {
  High: { xp: 40, rep: 8 },
  Medium: { xp: 20, rep: 8 },
  Low: { xp: 10, rep: 8 },
} as const;

export type TaskDifficulty = keyof typeof TASK_REWARDS;

export function getTaskReward(priorityOrDifficulty?: string): { xp: number; rep: number } {
  const norm = String(priorityOrDifficulty || '').trim().toLowerCase();
  if (norm === 'high' || norm === 'advanced') {
    return TASK_REWARDS.High;
  }
  if (norm === 'low' || norm === 'beginner') {
    return TASK_REWARDS.Low;
  }
  return TASK_REWARDS.Medium;
}
