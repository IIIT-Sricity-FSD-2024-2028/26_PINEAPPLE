export type ReportReason =
  | 'Harassment'
  | 'Spam'
  | 'Cheating or plagiarism'
  | 'Fake proof'
  | 'Abandoned work'
  | 'Inappropriate content'
  | 'Other';

export type ReportStatus = 'Open' | 'Under review' | 'Resolved' | 'Dismissed';

export type ReportType = 'user' | 'chat_message';

export interface ReportedMessageSnapshotItem {
  id: string;
  projectId: string;
  senderId: string;
  senderName: string;
  role?: string;
  content: string;
  timestamp: string;
}

export interface Report {
  id: string;
  type?: ReportType;
  reporterId: string;
  reportedUserId: string;
  reason: ReportReason;
  details: string;
  status: ReportStatus;
  projectId?: string;
  projectName?: string;
  messageId?: string;
  reportedMessage?: ReportedMessageSnapshotItem;
  messageSnapshot?: ReportedMessageSnapshotItem[];
  adminNote?: string;
  handledBy?: string;
  reporterNotifiedOnDecision?: boolean;
  createdAt: string;
  updatedAt: string;
}
