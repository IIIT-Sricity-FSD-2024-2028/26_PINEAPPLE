export type PendingModerationActionType = 'suspend';
export type PendingModerationActionStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface PendingModerationAction {
  id: string;
  type: PendingModerationActionType;
  targetUserId: string;
  targetUserName?: string;
  requestedBy: string;
  requestedByName?: string;
  reason: string;
  status: PendingModerationActionStatus;
  thresholdReasons: string[];
  accountAgeDays?: number;
  targetReputation?: number;
  reportId?: string;
  createdAt: string;
  expiresAt: string;
  decidedBy?: string;
  decidedByName?: string;
  decidedAt?: string;
  decisionReason?: string;
}
