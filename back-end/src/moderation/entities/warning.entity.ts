export type WarningStatus = 'active' | 'removed' | 'cleared' | 'expired';

export interface Warning {
  id: string;
  userId: string;
  issuedBy: string;
  reason: string;
  status: WarningStatus;
  createdAt: string;
  clearedAt?: string;
  removedAt?: string;
  expiredAt?: string;
}
