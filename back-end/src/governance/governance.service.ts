import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { GovernanceRepository, Report } from './governance.repository';
import { CreateReportDto, ReportStatus } from './dto/create-report.dto';
import { ResolveReportDto, ResolutionAction } from './dto/resolve-report.dto';
import { UsersService } from '../users/users.service';
import { GamificationService } from '../gamification/gamification.service';
import { CommunicationService } from '../communication/communication.service';

@Injectable()
export class GovernanceService {
  constructor(
    private readonly governanceRepository: GovernanceRepository,
    private readonly usersService: UsersService,
    private readonly gamificationService: GamificationService,
    private readonly communicationService: CommunicationService,
  ) {}

  createReport(reporterId: string, dto: CreateReportDto): Report {
    return this.governanceRepository.createReport(reporterId, dto);
  }

  getAllReports(): Report[] {
    return this.governanceRepository.getAllReports();
  }

  getReportById(id: string): Report {
    const report = this.governanceRepository.getReportById(id);
    if (!report) {
      throw new NotFoundException(`Report with ID ${id} not found.`);
    }
    return report;
  }

  resolveReport(reportId: string, dto: ResolveReportDto): Report {
    const report = this.getReportById(reportId);

    if (report.status === ReportStatus.Resolved) {
      throw new BadRequestException('This report has already been resolved.');
    }

    const updatedReport = this.governanceRepository.updateReportStatus(
      reportId,
      ReportStatus.Resolved,
      dto.resolution,
      dto.action,
    );

    if (!updatedReport) {
      throw new NotFoundException(`Report with ID ${reportId} not found.`);
    }

    // Cascading Logic based on action
    const targetUserId = updatedReport.targetUserId;

    if (dto.action === ResolutionAction.Suspend) {
      this.usersService.update(targetUserId, { role: 'Suspended' } as any);
      this.gamificationService.updateReputation(targetUserId, -50, 'Account Suspended due to moderation action');
    } else if (dto.action === ResolutionAction.Warn) {
      this.gamificationService.updateReputation(targetUserId, -15, 'Official Warning');
    }

    // Notifications
    // 1. Notify the target user
    this.communicationService.createNotification({
      userId: targetUserId,
      title: 'Governance Resolution',
      message: `A report against you was resolved with action: ${dto.action}. Resolution: ${dto.resolution}`,
    });

    // 2. Notify the reporter
    this.communicationService.createNotification({
      userId: updatedReport.reporterId,
      title: 'Report Resolved',
      message: `Your report (ID: ${reportId}) has been reviewed and resolved by an Administrator.`,
    });

    return updatedReport;
  }
}
