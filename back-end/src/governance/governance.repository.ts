import { Injectable } from '@nestjs/common';
import { CreateReportDto, ReportStatus } from './dto/create-report.dto';
import { ResolveReportDto, ResolutionAction } from './dto/resolve-report.dto';

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
  }

  createReport(reporterId: string, dto: CreateReportDto): Report {
    const newReport: Report = {
      id: `report-${Date.now()}`,
      reporterId,
      targetUserId: dto.targetUserId,
      reason: dto.reason,
      status: ReportStatus.Open,
      timestamp: new Date(),
    };
    this.reports.push(newReport);
    return newReport;
  }

  getAllReports(): Report[] {
    // Reverse Chronological (Newest first)
    return this.reports.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getReportById(reportId: string): Report | undefined {
    return this.reports.find((r) => r.id === reportId);
  }

  updateReportStatus(reportId: string, status: ReportStatus, resolution: string, action: ResolutionAction): Report | undefined {
    const index = this.reports.findIndex((r) => r.id === reportId);
    if (index === -1) {
      return undefined;
    }

    this.reports[index] = {
      ...this.reports[index],
      status,
      resolution,
      action,
    };

    return this.reports[index];
  }
}
