import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  Inject,
  forwardRef,
  Optional,
} from '@nestjs/common';
import { Report, ReportReason, ReportStatus, ReportedMessageSnapshotItem } from './entities/report.entity';
import { CreateReportDto, VALID_REPORT_REASONS } from './dto/create-report.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import { ActionReportDto } from './dto/action-report.dto';
import { ClockService } from '../common/services/clock.service';
import { UsersRepository } from '../users/users.repository';
import { ModerationService } from './moderation.service';
import { ReputationService } from './reputation.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { PlatformConfigService } from '../platform-config/platform-config.service';
import { ProjectsRepository } from '../projects/projects.repository';
import { TasksRepository } from '../tasks/tasks.repository';
import { JoinRequestsService } from '../join-requests/join-requests.service';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  private reports: Report[] = [];

  constructor(
    private readonly clockService: ClockService,
    @Inject(forwardRef(() => UsersRepository))
    private readonly usersRepository: UsersRepository,
    @Inject(forwardRef(() => ModerationService))
    private readonly moderationService: ModerationService,
    private readonly reputationService: ReputationService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
    @Optional()
    private readonly platformConfigService?: PlatformConfigService,
    @Optional()
    @Inject(forwardRef(() => ProjectsRepository))
    private readonly projectsRepository?: ProjectsRepository,
    @Optional()
    @Inject(forwardRef(() => TasksRepository))
    private readonly tasksRepository?: TasksRepository,
    @Optional()
    @Inject(forwardRef(() => JoinRequestsService))
    private readonly joinRequestsService?: JoinRequestsService,
  ) {}

  resetToSeed(): void {
    this.reset();
  }

  reset() {
    this.reports = [];
  }

  getAllRaw(): Report[] {
    return this.reports;
  }

  private getReportDailyLimit(): number {
    const cfgLimit = this.platformConfigService?.getConfig?.().reportDailyLimit;
    return cfgLimit && cfgLimit > 0 ? cfgLimit : 10;
  }

  private assertCombinedDailyReportLimit(reporterId: string): Report[] {
    const nowMs = this.clockService ? new Date(this.clockService.now()).getTime() : Date.now();
    const past24h = nowMs - 24 * 60 * 60 * 1000;
    const reportsInDay = this.reports.filter(
      (r) => String(r.reporterId) === String(reporterId) && new Date(r.createdAt).getTime() > past24h,
    );
    const maxDaily = this.getReportDailyLimit();
    if (reportsInDay.length >= maxDaily) {
      throw new HttpException(
        {
          statusCode: 429,
          error: 'Too Many Requests',
          code: 'TOO_MANY_REPORTS',
          message: `You can file at most ${maxDaily} reports per day. Please try again later.`,
          currentCount: reportsInDay.length,
          maxAllowed: maxDaily,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return reportsInDay;
  }

  async createReport(reporterId: string, dto: CreateReportDto): Promise<Report> {
    const targetUserId = String(dto.reportedUserId);

    if (String(reporterId).trim() === targetUserId.trim()) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'CANNOT_REPORT_SELF',
        message: 'You cannot report your own account.',
      });
    }

    const targetUser = this.usersRepository.findById(targetUserId);
    if (!targetUser) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        code: 'USER_NOT_FOUND',
        message: 'Reported user does not exist.',
      });
    }

    const targetRole = String(targetUser.role || '').toLowerCase();
    if (
      targetRole === 'admin' ||
      targetRole === 'administrator' ||
      targetRole === 'superuser' ||
      targetRole === 'super-user'
    ) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'CANNOT_REPORT_ADMIN',
        message: 'You cannot report an administrator or superuser account.',
      });
    }

    if (!VALID_REPORT_REASONS.includes(dto.reason as ReportReason)) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'VALIDATION',
        message: 'Invalid report reason.',
      });
    }

    const trimmedDetails = (dto.details || '').trim();
    if (trimmedDetails.length < 20 || trimmedDetails.length > 1000) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'VALIDATION',
        message: 'Report details must be between 20 and 1000 characters.',
      });
    }

    // Combined 24h limit across all report types (default 10 -> 429 TOO_MANY_REPORTS)
    const allReportsInDay = this.assertCombinedDailyReportLimit(reporterId);

    // Phase 2 user-report daily limit: 5 user reports per day per reporter (tracked via ClockService)
    const userReportsInDay = allReportsInDay.filter((r) => !r.type || r.type === 'user');
    if (userReportsInDay.length >= 5) {
      throw new HttpException(
        {
          statusCode: 429,
          error: 'Too Many Requests',
          code: 'DAILY_LIMIT',
          message: 'You have reached the maximum daily limit of 5 reports. Please try again tomorrow.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Duplicate check: no second OPEN report from same reporter against same user
    const existingOpen = this.reports.find(
      (r) =>
        (!r.type || r.type === 'user') &&
        String(r.reporterId) === String(reporterId) &&
        String(r.reportedUserId) === targetUserId &&
        r.status === 'Open',
    );
    if (existingOpen) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'DUPLICATE_OPEN_REPORT',
        message: 'You already have an open report pending review against this user.',
      });
    }

    const nowIso = this.clockService?.nowIso?.() || new Date().toISOString();
    const report: Report = {
      id: `rep-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      type: 'user',
      reporterId: String(reporterId),
      reportedUserId: targetUserId,
      reason: dto.reason,
      details: trimmedDetails,
      status: 'Open',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    this.reports.unshift(report);

    // Audit log entry
    try {
      this.auditService.create({
        action: 'report-created',
        performedBy: String(reporterId),
        actor: String(reporterId),
        target: targetUserId,
        entityType: 'report',
        entityId: report.id,
        event: `User ${reporterId} submitted a report against user ${targetUserId} for reason "${report.reason}"`,
        details: { reportId: report.id, reason: report.reason, reportedUserId: targetUserId },
      });
    } catch (err: any) {
      this.logger.warn(`Audit log failed: ${err?.message || err}`);
    }

    return report;
  }

  createChatReport(
    reporterId: string,
    params: {
      projectId: string;
      message: {
        id: string;
        senderId: string;
        senderName: string;
        role?: string;
        content: string;
        timestamp: string | Date;
      };
      messageSnapshot: ReportedMessageSnapshotItem[];
      reason: string;
    },
  ): Report {
    const trimmedReason = String(params.reason || '').trim();
    if (trimmedReason.length < 10 || trimmedReason.length > 500) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'REASON_REQUIRED',
        message: 'Please provide a report reason between 10 and 500 characters.',
      });
    }

    if (String(reporterId).trim() === String(params.message.senderId).trim()) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'CANNOT_REPORT_SELF',
        message: 'You cannot report your own chat message.',
      });
    }

    this.assertCombinedDailyReportLimit(reporterId);

    const alreadyReported = this.reports.some(
      (r) =>
        r.type === 'chat_message' &&
        String(r.reporterId) === String(reporterId) &&
        String(r.messageId) === String(params.message.id),
    );
    if (alreadyReported) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'ALREADY_REPORTED',
        message: 'You have already reported this chat message.',
      });
    }

    const nowIso = this.clockService?.nowIso?.() || new Date().toISOString();
    const reportedMessage: ReportedMessageSnapshotItem = {
      id: String(params.message.id),
      projectId: String(params.projectId),
      senderId: String(params.message.senderId),
      senderName: String(params.message.senderName || 'Unknown user'),
      role: params.message.role || undefined,
      content: String(params.message.content || ''),
      timestamp:
        params.message.timestamp instanceof Date
          ? params.message.timestamp.toISOString()
          : new Date(params.message.timestamp).toISOString(),
    };
    const snapshotCopy: ReportedMessageSnapshotItem[] = Array.isArray(params.messageSnapshot)
      ? params.messageSnapshot.map((item) => ({
          id: String(item.id),
          projectId: String(item.projectId),
          senderId: String(item.senderId),
          senderName: String(item.senderName || 'Unknown user'),
          role: item.role || undefined,
          content: String(item.content || ''),
          timestamp:
            typeof item.timestamp === 'string'
              ? item.timestamp
              : new Date(item.timestamp as any).toISOString(),
        }))
      : [reportedMessage];

    const project = this.projectsRepository?.findById(String(params.projectId));
    const projectName = project?.title || (params as any).projectName || String(params.projectId);

    const report: Report = {
      id: `rep-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      type: 'chat_message',
      reporterId: String(reporterId),
      reportedUserId: String(params.message.senderId),
      projectId: String(params.projectId),
      projectName,
      messageId: String(params.message.id),
      reason: 'Other',
      details: trimmedReason,
      reportedMessage,
      messageSnapshot: snapshotCopy,
      status: 'Open',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    this.reports.unshift(report);

    try {
      this.auditService.create({
        action: 'chat-report-created',
        performedBy: String(reporterId),
        actor: String(reporterId),
        target: String(params.message.senderId),
        entityType: 'report',
        entityId: report.id,
        event: `User ${reporterId} reported chat message ${params.message.id} in project ${params.projectId}`,
        details: {
          reportId: report.id,
          type: 'chat_message',
          projectId: String(params.projectId),
          messageId: String(params.message.id),
          reportedUserId: String(params.message.senderId),
        },
      });
    } catch (err: any) {
      this.logger.warn(`Audit log failed: ${err?.message || err}`);
    }

    return report;
  }

  private notifyReporterOnDecision(report: Report): void {
    if (!report.reporterNotifiedOnDecision && (report.status === 'Resolved' || report.status === 'Dismissed')) {
      report.reporterNotifiedOnDecision = true;
      try {
        this.notificationsService.create({
          userId: String(report.reporterId),
          type: 'info',
          title: 'Report Update',
          message: `Your report was reviewed and ${report.status.toLowerCase()}.`,
        });
      } catch (err: any) {
        this.logger.warn(`Reporter notification failed: ${err?.message || err}`);
      }
    }
  }

  getReporterReports(reporterId: string): any[] {
    const list = this.reports.filter((r) => String(r.reporterId) === String(reporterId));
    return list.map((r) => {
      const u = this.usersRepository.findById(r.reportedUserId);
      const project = r.projectId ? this.projectsRepository?.findById(r.projectId) : undefined;
      const projectName = r.projectName || project?.title || (r.projectId ? `Project ${r.projectId}` : undefined);
      const displayStatus = r.status === 'Open' ? 'Received' : r.status;
      let outcome = 'Pending review';
      if (r.status === 'Under review') outcome = 'Under review by moderator';
      else if (r.status === 'Resolved') outcome = 'Reviewed and action taken';
      else if (r.status === 'Dismissed') outcome = 'Reviewed and dismissed';

      return {
        id: r.id,
        type: r.type || 'user',
        projectId: r.projectId,
        projectName,
        reportedUserId: r.reportedUserId,
        reportedUserName: u?.name || 'Unknown User',
        reportedUserUsername: u?.username || '',
        reason: r.reason,
        details: r.details,
        status: displayStatus,
        rawStatus: r.status,
        outcome,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    });
  }

  getAdminReports(query: { status?: string; q?: string; page?: number; limit?: number }) {
    let list = [...this.reports];
    if (query.status && query.status !== 'all') {
      const s = query.status.toLowerCase();
      list = list.filter((r) => r.status.toLowerCase() === s);
    }

    if (query.q && query.q.trim()) {
      const search = query.q.trim().toLowerCase();
      list = list.filter((r) => {
        const reporter = this.usersRepository.findById(r.reporterId);
        const reported = this.usersRepository.findById(r.reportedUserId);
        return (
          r.reason.toLowerCase().includes(search) ||
          r.details.toLowerCase().includes(search) ||
          (reporter?.name || '').toLowerCase().includes(search) ||
          (reporter?.username || '').toLowerCase().includes(search) ||
          (reported?.name || '').toLowerCase().includes(search) ||
          (reported?.username || '').toLowerCase().includes(search)
        );
      });
    }

    const total = list.length;
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 20);
    const startIndex = (page - 1) * limit;
    const paged = list.slice(startIndex, startIndex + limit);

    const items = paged.map((r) => {
      const reporter = this.usersRepository.findById(r.reporterId);
      const reported = this.usersRepository.findById(r.reportedUserId);
      const project = r.projectId ? this.projectsRepository?.findById(r.projectId) : undefined;
      const projectName = r.projectName || project?.title || (r.projectId ? `Project ${r.projectId}` : undefined);
      return {
        id: r.id,
        type: r.type || 'user',
        projectId: r.projectId,
        projectName,
        messageId: r.messageId,
        reportedMessage: r.reportedMessage,
        messageSnapshot: r.messageSnapshot,
        reporter: {
          id: r.reporterId,
          name: reporter?.name || 'Unknown Reporter',
          username: reporter?.username || '',
        },
        reportedUser: {
          id: r.reportedUserId,
          name: reported?.name || 'Unknown User',
          username: reported?.username || '',
          university: reported?.university || (reported as any)?.data?.university || '',
          status: reported?.status || 'Active',
          reputation: this.reputationService.getReputation(r.reportedUserId),
        },
        reason: r.reason,
        details: r.details,
        status: r.status,
        adminNote: r.adminNote,
        handledBy: r.handledBy,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    });

    return { items, total, page, limit };
  }

  getAdminReportById(id: string) {
    const report = this.reports.find((r) => String(r.id) === String(id));
    if (!report) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        code: 'REPORT_NOT_FOUND',
        message: 'Report not found.',
      });
    }

    const reporter = this.usersRepository.findById(report.reporterId);
    const reported = this.usersRepository.findById(report.reportedUserId);
    const project = report.projectId ? this.projectsRepository?.findById(report.projectId) : undefined;
    const projectName = report.projectName || project?.title || (report.projectId ? `Project ${report.projectId}` : undefined);

    const earlierWarnings = this.moderationService.getAdminUserWarnings(report.reportedUserId);
    const earlierReports = this.reports
      .filter((r) => String(r.reportedUserId) === String(report.reportedUserId) && r.id !== report.id)
      .map((r) => ({
        id: r.id,
        type: r.type || 'user',
        reason: r.reason,
        status: r.status,
        createdAt: r.createdAt,
      }));

    return {
      id: report.id,
      type: report.type || 'user',
      projectId: report.projectId,
      projectName,
      messageId: report.messageId,
      reportedMessage: report.reportedMessage,
      messageSnapshot: report.messageSnapshot,
      reporter: {
        id: report.reporterId,
        name: reporter?.name || 'Unknown Reporter',
        username: reporter?.username || '',
      },
      reportedUser: {
        id: report.reportedUserId,
        name: reported?.name || 'Unknown User',
        username: reported?.username || '',
        university: reported?.university || (reported as any)?.data?.university || '',
        status: reported?.status || 'Active',
        reputation: this.reputationService.getReputation(report.reportedUserId),
      },
      reason: report.reason,
      details: report.details,
      status: report.status,
      adminNote: report.adminNote,
      handledBy: report.handledBy,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
      earlierWarnings,
      earlierReports,
    };
  }

  getOpenReportsCount(): { count: number; openCount: number } {
    const count = this.reports.filter((r) => (r.status || '').toLowerCase() === 'open').length;
    return { count, openCount: count };
  }

  updateReportStatus(id: string, dto: UpdateReportStatusDto, adminId: string): Report {
    const report = this.reports.find((r) => String(r.id) === String(id));
    if (!report) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        code: 'REPORT_NOT_FOUND',
        message: 'Report not found.',
      });
    }

    if (report.status === 'Resolved' || report.status === 'Dismissed') {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'REPORT_ALREADY_ACTIONED',
        message: 'This report has already been resolved or dismissed.',
      });
    }

    report.status = dto.status;
    if (dto.note) {
      report.adminNote = dto.note.trim();
    }
    report.handledBy = adminId;
    report.updatedAt = this.clockService?.nowIso?.() || new Date().toISOString();

    if (report.status === 'Resolved' || report.status === 'Dismissed') {
      this.notifyReporterOnDecision(report);
    }

    try {
      this.auditService.create({
        action: 'report-status-changed',
        performedBy: adminId,
        actor: adminId,
        target: report.reportedUserId,
        entityType: 'report',
        entityId: report.id,
        event: `Admin ${adminId} updated status of report ${report.id} to "${report.status}"`,
        details: { reportId: report.id, userId: report.reportedUserId, targetUserId: report.reportedUserId, status: report.status, note: dto.note },
      });
    } catch (err: any) {
      this.logger.warn(`Audit log failed: ${err?.message || err}`);
    }

    return report;
  }

  async actionReport(
    id: string,
    dto: ActionReportDto,
    adminId: string,
    adminRole = 'admin',
  ): Promise<{ success: boolean; report: Report; moderationResult?: any }> {
    const report = this.reports.find((r) => String(r.id) === String(id));
    if (!report) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        code: 'REPORT_NOT_FOUND',
        message: 'Report not found.',
      });
    }

    if (report.status === 'Resolved' || report.status === 'Dismissed') {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'REPORT_ALREADY_ACTIONED',
        message: 'This report has already been resolved or dismissed.',
      });
    }

    // Do the status change in one block with no await between check and write
    const nowIso = this.clockService?.nowIso?.() || new Date().toISOString();
    report.status = dto.action === 'dismiss' ? 'Dismissed' : 'Resolved';
    report.adminNote = dto.reason.trim();
    report.handledBy = adminId;
    report.updatedAt = nowIso;

    const reportedUser = this.usersRepository.findById(report.reportedUserId);
    const reportedUserName = reportedUser?.name || 'User';

    if (dto.action === 'warn') {
      await this.moderationService.warn(adminId, report.reportedUserId, dto.reason, report.id);
      this.notifyReporterOnDecision(report);
    } else if (dto.action === 'suspend') {
      const moderationResult = await this.moderationService.suspend(
        adminId,
        report.reportedUserId,
        dto.reason,
        adminRole,
        report.id,
      );
      this.notifyReporterOnDecision(report);

      try {
        this.auditService.create({
          action: 'report-action',
          performedBy: adminId,
          actor: adminId,
          target: report.reportedUserId,
          entityType: 'report',
          entityId: report.id,
          event: `Admin ${adminId} took action "${dto.action}" on report ${report.id}`,
          details: { reportId: report.id, userId: report.reportedUserId, targetUserId: report.reportedUserId, action: dto.action, reason: dto.reason, moderationResult },
        });
      } catch (err: any) {
        this.logger.warn(`Audit log failed: ${err?.message || err}`);
      }

      return { success: true, report, moderationResult };
    } else if (dto.action === 'dismiss') {
      this.notifyReporterOnDecision(report);
    }

    try {
      this.auditService.create({
        action: 'report-action',
        performedBy: adminId,
        actor: adminId,
        target: report.reportedUserId,
        entityType: 'report',
        entityId: report.id,
        event: `Admin ${adminId} took action "${dto.action}" on report ${report.id}`,
        details: { reportId: report.id, userId: report.reportedUserId, targetUserId: report.reportedUserId, action: dto.action, reason: dto.reason },
      });
    } catch (err: any) {
      this.logger.warn(`Audit log failed: ${err?.message || err}`);
    }

    return { success: true, report };
  }

  getOwnerRejectionPatterns(days = 30) {
    const windowDays = Number.isFinite(Number(days)) && Number(days) > 0 ? Math.floor(Number(days)) : 30;
    const nowMs = this.clockService ? new Date(this.clockService.now()).getTime() : Date.now();
    const cutoffMs = nowMs - windowDays * 24 * 60 * 60 * 1000;

    const allProjects = this.projectsRepository ? this.projectsRepository.findAll() : [];
    const projectMap = new Map<string, any>();
    const ownerStats = new Map<
      string,
      {
        ownerId: string;
        rejectedJoinRequests: number;
        approvedJoinRequests: number;
        rejectedTaskReviews: number;
        approvedTaskReviews: number;
        reasons: Array<{ type: 'join_request' | 'task_review'; projectId: string; projectTitle?: string; reason: string; at: string }>;
      }
    >();

    const ensureOwner = (ownerId: string) => {
      const key = String(ownerId);
      let rec = ownerStats.get(key);
      if (!rec) {
        rec = {
          ownerId: key,
          rejectedJoinRequests: 0,
          approvedJoinRequests: 0,
          rejectedTaskReviews: 0,
          approvedTaskReviews: 0,
          reasons: [],
        };
        ownerStats.set(key, rec);
      }
      return rec;
    };

    for (const p of allProjects) {
      projectMap.set(String(p.id), p);
      if (p.ownerId) {
        ensureOwner(String(p.ownerId));
      }
    }

    // 1. Join requests in last 30 days
    const allRequests = this.joinRequestsService ? this.joinRequestsService.findAll() : [];
    for (const req of allRequests) {
      const project = projectMap.get(String(req.projectId));
      if (!project || !project.ownerId) continue;
      const statusLower = String(req.status || '').toLowerCase();
      if (statusLower !== 'rejected' && statusLower !== 'approved') continue;

      const decisionTimestamp = req.decidedAt || (req.updatedAt ? new Date(req.updatedAt).toISOString() : req.createdAt);
      const decisionMs = new Date(decisionTimestamp).getTime();
      if (Number.isNaN(decisionMs) || decisionMs < cutoffMs) continue;

      const stats = ensureOwner(String(project.ownerId));
      if (statusLower === 'rejected') {
        stats.rejectedJoinRequests += 1;
        stats.reasons.push({
          type: 'join_request',
          projectId: String(project.id),
          projectTitle: project.title || project.name,
          reason: req.rejectionReason || '',
          at: new Date(decisionMs).toISOString(),
        });
      } else {
        stats.approvedJoinRequests += 1;
      }
    }

    // 2. Task reviews in last 30 days
    const allTasks = this.tasksRepository ? this.tasksRepository.findAll() : [];
    for (const task of allTasks) {
      const project = projectMap.get(String(task.projectId));
      if (!project || !project.ownerId) continue;
      const stats = ensureOwner(String(project.ownerId));

      const history: Array<{ reason: string; at: string; by: string }> = Array.isArray((task as any).rejectionHistory)
        ? (task as any).rejectionHistory
        : [];
      if (history.length > 0) {
        for (const item of history) {
          const rejMs = new Date(item.at || 0).getTime();
          if (!Number.isNaN(rejMs) && rejMs >= cutoffMs) {
            stats.rejectedTaskReviews += 1;
            stats.reasons.push({
              type: 'task_review',
              projectId: String(project.id),
              projectTitle: project.title || project.name,
              reason: item.reason || '',
              at: new Date(rejMs).toISOString(),
            });
          }
        }
      } else if ((task as any).rejectedAt) {
        const rejMs = new Date((task as any).rejectedAt).getTime();
        if (!Number.isNaN(rejMs) && rejMs >= cutoffMs) {
          stats.rejectedTaskReviews += 1;
          stats.reasons.push({
            type: 'task_review',
            projectId: String(project.id),
            projectTitle: project.title || project.name,
            reason: (task as any).rejectionReason || '',
            at: new Date(rejMs).toISOString(),
          });
        }
      }

      const taskStatusLower = String(task.status || '').toLowerCase();
      const isTaskApproved =
        (taskStatusLower === 'completed' || taskStatusLower === 'approved') &&
        (task as any).autoApproved !== true;
      if (isTaskApproved) {
        const approvedTs = (task as any).approvedAt || (task as any).updatedAt || (task as any).createdAt;
        const approvedMs = new Date(approvedTs || 0).getTime();
        if (!Number.isNaN(approvedMs) && approvedMs >= cutoffMs) {
          stats.approvedTaskReviews += 1;
        }
      }
    }

    const items = [];
    for (const stats of ownerStats.values()) {
      const totalRejections = stats.rejectedJoinRequests + stats.rejectedTaskReviews;
      const totalApprovals = stats.approvedJoinRequests + stats.approvedTaskReviews;
      const totalDecisions = totalRejections + totalApprovals;
      if (totalDecisions === 0) continue;

      const user = this.usersRepository.findById(stats.ownerId);
      const reviewPatternFlag = totalRejections >= 5 && totalApprovals === 0;
      const rejectionRate = Math.round((totalRejections / totalDecisions) * 100);

      // Check for deletion pattern (>3 deletions of projects with collaborators in 30 days)
      const deletedWithCollabsCount = allProjects.filter((p) => {
        if (!p.deletedAt || String(p.ownerId) !== String(stats.ownerId)) return false;
        const delMs = new Date(p.deletedAt).getTime();
        if (Number.isNaN(delMs) || delMs < cutoffMs) return false;
        const colCount = (p.members || p.collaborators || []).filter((m: any) => {
          const r = String(m.role || '').toLowerCase();
          return r !== 'owner' && r !== 'former member';
        }).length;
        return colCount > 0;
      }).length;
      const frequentDeletionFlag = deletedWithCollabsCount > 3;

      items.push({
        ownerId: stats.ownerId,
        ownerName: user?.name || `Owner #${stats.ownerId}`,
        ownerEmail: user?.email || '',
        windowDays,
        rejectedJoinRequests: stats.rejectedJoinRequests,
        approvedJoinRequests: stats.approvedJoinRequests,
        rejectedTaskReviews: stats.rejectedTaskReviews,
        approvedTaskReviews: stats.approvedTaskReviews,
        totalRejections,
        totalApprovals,
        rejectionRate,
        reviewPatternFlag,
        frequentDeletionFlag,
        deletedWithCollaboratorsCount: deletedWithCollabsCount,
        badge: reviewPatternFlag ? 'review pattern' : frequentDeletionFlag ? 'frequent deletion pattern' : null,
        reasons: stats.reasons.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
      });
    }

    items.sort((a, b) => {
      if (a.reviewPatternFlag !== b.reviewPatternFlag) return a.reviewPatternFlag ? -1 : 1;
      return b.totalRejections - a.totalRejections;
    });

    return {
      windowDays,
      totalOwners: items.length,
      flaggedCount: items.filter((i) => i.reviewPatternFlag).length,
      items,
    };
  }

  anonymizeUser(userId: string, anonymizedId: string, identifiers: Array<string | undefined> = []): number {
    const uid = String(userId || '');
    const idents = identifiers
      .filter((s): s is string => Boolean(s && s.trim()))
      .map((s) => s.trim().toLowerCase());
    let updated = 0;

    for (const report of this.reports) {
      let touched = false;
      if (String(report.reporterId) === uid) {
        report.reporterId = anonymizedId;
        (report as any).reporterName = 'Deleted user';
        touched = true;
      }
      if (String(report.reportedUserId) === uid) {
        report.reportedUserId = anonymizedId;
        (report as any).reportedUserName = 'Deleted user';
        touched = true;
      }
      if (report.reportedMessage && String(report.reportedMessage.senderId) === uid) {
        report.reportedMessage.senderId = anonymizedId;
        report.reportedMessage.senderName = 'Deleted user';
        touched = true;
      }
      if (Array.isArray(report.messageSnapshot)) {
        for (const item of report.messageSnapshot) {
          if (String(item.senderId) === uid) {
            item.senderId = anonymizedId;
            item.senderName = 'Deleted user';
            touched = true;
          }
        }
      }
      if (report.details && idents.length > 0) {
        let desc = report.details;
        for (const ident of idents) {
          if (ident.length >= 3 && desc.toLowerCase().includes(ident)) {
            desc = desc.replace(new RegExp(ident.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), anonymizedId);
            touched = true;
          }
        }
        report.details = desc;
      }
      if (touched) updated += 1;
    }

    return updated;
  }
}
