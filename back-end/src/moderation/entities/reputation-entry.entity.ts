export type ReputationEntryClass = 'standing' | 'contribution';

export type ReputationEntryType =
  | 'initial'
  | 'seed'
  | 'task_approved'
  | 'project_completed'
  | 'warning'
  | 'warning_removed'
  | 'deadline_missed'
  | 'recovery';

export interface ReputationEntry {
  id: string;
  userId: string;
  type: ReputationEntryType | string;
  delta: number;
  entryClass?: ReputationEntryClass;
  refId?: string;
  reason?: string;
  createdAt: string;
}
