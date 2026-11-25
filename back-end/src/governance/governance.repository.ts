import { Injectable } from '@nestjs/common';

export enum ReportStatus {
  Open = 'Open',
  Resolved = 'Resolved',
}

export enum ResolutionAction {
  Warn = 'Warn',
  Suspend = 'Suspend',
  Dismiss = 'Dismiss',
}

export interface Report {
  id: string;
  reporterId: string;
  targetUserId: string;
  reason: string;
  status: ReportStatus;
  resolution?: string;
  action?: ResolutionAction;
  timestamp: Date;
}

@Injectable()
export class GovernanceRepository {
  private reports: Report[] = [];

  constructor() {
    this.initSeeds();
  }

  private initSeeds(): void {
    const now = new Date();

    // Seed test report filed by User '2' (Arjun) against User '3' (Kiran)
    this.reports.push({
      id: 'report-1',
      reporterId: '2',
      targetUserId: '3',
      reason: 'Refusing to communicate and abandoning tasks.',
      status: ReportStatus.Open,
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 24), // 1 day ago
    });

    this.reports.push({
      id: 'report-2',
      reporterId: '8', // Vikram Nair
      targetUserId: '5',
      reason: 'Spamming the project discussion board with unrelated links.',
      status: ReportStatus.Resolved,
      resolution: 'Issued a warning and removed spam posts.',
      action: ResolutionAction.Warn,
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 3), // 3 days ago
    });
  }

  resetToSeed(): void {
    this.reports = [];
    this.initSeeds();
  }

  anonymizeUser(userId: string, anonymizedId: string): number {
    const uid = String(userId || '');
    let count = 0;
    for (const r of this.reports) {
      let touched = false;
      if (String(r.reporterId) === uid) {
        r.reporterId = anonymizedId;
        touched = true;
      }
      if (String(r.targetUserId) === uid) {
        r.targetUserId = anonymizedId;
        touched = true;
      }
      if (touched) count += 1;
    }
    return count;
  }
}
