export type AppealStatus = 'pending' | 'accepted' | 'rejected';

export interface Appeal {
  id: string;
  warningId: string;
  userId: string;
  explanation: string;
  status: AppealStatus;
  adminNote?: string;
  decidedBy?: string;
  createdAt: string;
  decidedAt?: string;
}
