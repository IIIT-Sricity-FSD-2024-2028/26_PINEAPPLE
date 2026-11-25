import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { UsersRepository, User } from './users.repository';
import { ClockService } from '../common/services/clock.service';
import { ProjectsRepository } from '../projects/projects.repository';
import { TasksRepository } from '../tasks/tasks.repository';
import { JoinRequestsService } from '../join-requests/join-requests.service';
import { CommunicationRepository } from '../communication/communication.repository';
import { NotificationsService } from '../notifications/notifications.service';
import { ReputationService } from '../moderation/reputation.service';
import { GamificationRepository } from '../gamification/gamification.repository';
import { ModerationService } from '../moderation/moderation.service';
import { MentorMarketplaceService } from '../mentor-marketplace/mentor-marketplace.service';
import { EscrowService } from '../escrow/escrow.service';
import { PayoutsService } from '../payouts/payouts.service';
import { AuditService } from '../audit/audit.service';
import { FileCleanupService } from '../common/services/file-cleanup.service';

export interface DataExportRecord {
  id: string;
  exportId: string;
  userId: string;
  status: 'ready' | 'expired';
  requestedAt: string;
  requestedAtMs: number;
  expiresAt: string;
  expiresAtMs: number;
  filePath: string;
  downloadUrl: string;
}

@Injectable()
export class DataExportService {
  static readonly RATE_LIMIT_MS = 60 * 60 * 1000;
  static readonly EXPIRY_MS = 24 * 60 * 60 * 1000;

  private readonly exportsById = new Map<string, DataExportRecord>();
  private readonly lastRequestByUser = new Map<string, number>();
  private readonly fallbackFileCleanup = new FileCleanupService();

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly moduleRef: ModuleRef,
    @Optional() private readonly clockService?: ClockService,
    @Optional() private readonly fileCleanupService?: FileCleanupService,
  ) {}

  private getCleanupService(): FileCleanupService {
    return this.fileCleanupService || this.fallbackFileCleanup;
  }

  private nowMs(): number {
    return this.clockService ? this.clockService.now().getTime() : Date.now();
  }

  private getExportDir(): string {
    const dir = process.env.EXPORT_DIR || path.join(os.tmpdir(), 'teamforge-exports');
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  private getService<T>(token: any): T | undefined {
    try {
      return this.moduleRef.get<T>(token, { strict: false });
    } catch {
      return undefined;
    }
  }

  /**
   * Generates a complete personal JSON archive for the signed-in user.
   * Rate-limited to once per hour; download stays valid for 24 hours.
   */
  requestExport(userId: string): {
    exportId: string;
    id: string;
    status: 'ready' | 'expired';
    requestedAt: string;
    expiresAt: string;
    downloadUrl: string;
  } {
    const uid = String(userId || '').trim();
    const user = this.usersRepository.findById(uid);
    if (!user || user.isDeleted || user.deletedAt) {
      throw new NotFoundException('User account not found.');
    }

    const now = this.nowMs();
    const lastMs = this.lastRequestByUser.get(uid);
    if (lastMs !== undefined && now - lastMs < DataExportService.RATE_LIMIT_MS) {
      const nextAllowedAt = new Date(lastMs + DataExportService.RATE_LIMIT_MS).toISOString();
      throw new HttpException(
        {
          statusCode: 429,
          error: 'Too Many Requests',
          code: 'EXPORT_RATE_LIMIT',
          message: 'You can request an account data export at most once per hour.',
          nextAllowedAt,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const exportId = `exp_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const requestedAt = new Date(now).toISOString();
    const expiresAtMs = now + DataExportService.EXPIRY_MS;
    const expiresAt = new Date(expiresAtMs).toISOString();
    const payload = this.buildUserArchive(uid, user, requestedAt);

    const filePath = path.join(this.getExportDir(), `${exportId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');

    const record: DataExportRecord = {
      id: exportId,
      exportId,
      userId: uid,
      status: 'ready',
      requestedAt,
      requestedAtMs: now,
      expiresAt,
      expiresAtMs,
      filePath,
      downloadUrl: `/users/me/export/${exportId}/download`,
    };
    this.exportsById.set(exportId, record);
    this.lastRequestByUser.set(uid, now);

    const auditService = this.getService<AuditService>(AuditService);
    auditService?.log?.({
      action: 'account-export-requested',
      entityType: 'user',
      entityId: uid,
      actor: user.name || uid,
      performedBy: uid,
      target: exportId,
      event: `User ${uid} requested personal data export ${exportId}`,
      details: { exportId, expiresAt },
    });

    return {
      exportId: record.exportId,
      id: record.id,
      status: record.status,
      requestedAt: record.requestedAt,
      expiresAt: record.expiresAt,
      downloadUrl: record.downloadUrl,
    };
  }

  listExportsForUser(userId: string) {
    const uid = String(userId || '').trim();
    const now = this.nowMs();
    return Array.from(this.exportsById.values())
      .filter((r) => r.userId === uid)
      .map((r) => {
        if (now >= r.expiresAtMs || !fs.existsSync(r.filePath)) {
          r.status = 'expired';
        }
        return {
          exportId: r.exportId,
          id: r.id,
          status: r.status,
          requestedAt: r.requestedAt,
          expiresAt: r.expiresAt,
          downloadUrl: r.status === 'ready' ? r.downloadUrl : undefined,
        };
      })
      .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
  }

  getExportStatus(exportId: string, callerId: string) {
    const rec = this.exportsById.get(String(exportId));
    if (!rec) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'EXPORT_NOT_FOUND',
        message: 'Data export request not found.',
      });
    }
    if (String(rec.userId) !== String(callerId)) {
      throw new ForbiddenException('You can only access your own data exports.');
    }
    const now = this.nowMs();
    if (now >= rec.expiresAtMs || !fs.existsSync(rec.filePath)) {
      rec.status = 'expired';
    }
    return {
      exportId: rec.exportId,
      id: rec.id,
      status: rec.status,
      requestedAt: rec.requestedAt,
      expiresAt: rec.expiresAt,
      downloadUrl: rec.status === 'ready' ? rec.downloadUrl : undefined,
    };
  }

  getExportDownload(exportId: string, callerId: string): {
    filePath: string;
    filename: string;
    content: string;
  } {
    const rec = this.exportsById.get(String(exportId));
    if (!rec) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'EXPORT_NOT_FOUND',
        message: 'Data export request not found.',
      });
    }
    if (String(rec.userId) !== String(callerId)) {
      throw new ForbiddenException('You can only download your own data exports.');
    }
    const now = this.nowMs();
    if (now >= rec.expiresAtMs || rec.status === 'expired' || !fs.existsSync(rec.filePath)) {
      rec.status = 'expired';
      throw new NotFoundException({
        statusCode: 404,
        code: 'EXPORT_EXPIRED',
        message: 'This data export has expired after 24 hours. Please request a new export.',
      });
    }
    return {
      filePath: rec.filePath,
      filename: `teamforge-export-${rec.exportId}.json`,
      content: fs.readFileSync(rec.filePath, 'utf-8'),
    };
  }

  getAllRecords(): DataExportRecord[] {
    return Array.from(this.exportsById.values());
  }

  cleanExpiredExports(options?: { dryRun?: boolean }): { cleanedCount: number; dryRun?: boolean } {
    const now = this.nowMs();
    const dryRun = Boolean(options?.dryRun);
    const cleanup = this.getCleanupService();
    let cleanedCount = 0;
    for (const rec of this.exportsById.values()) {
      if (now >= rec.expiresAtMs) {
        const exists = Boolean(rec.filePath && fs.existsSync(rec.filePath));
        if (rec.status !== 'expired' || exists) {
          if (!dryRun) {
            rec.status = 'expired';
            if (exists) {
              cleanup.safeRemoveFile(rec.filePath, false);
            }
          }
          cleanedCount += 1;
        }
      }
    }
    return { cleanedCount, ...(dryRun ? { dryRun: true } : {}) };
  }

  deleteForUser(userId: string): { deletedCount: number; deletedFilesCount: number; errors: string[] } {
    const uid = String(userId || '').trim();
    const cleanup = this.getCleanupService();
    const errors: string[] = [];
    let deletedCount = 0;
    let deletedFilesCount = 0;

    for (const [id, rec] of Array.from(this.exportsById.entries())) {
      if (String(rec.userId) === uid) {
        if (rec.filePath) {
          const res = cleanup.safeRemoveFile(rec.filePath, false, errors);
          if (res.removed) {
            deletedFilesCount += 1;
          }
        }
        this.exportsById.delete(id);
        deletedCount += 1;
      }
    }
    this.lastRequestByUser.delete(uid);

    return { deletedCount, deletedFilesCount, errors };
  }

  resetToSeed(): void {
    const cleanup = this.getCleanupService();
    for (const rec of this.exportsById.values()) {
      if (rec.filePath) {
        cleanup.safeRemoveFile(rec.filePath, false);
      }
    }
    this.exportsById.clear();
    this.lastRequestByUser.clear();
  }

  reset(): void {
    if (process.env.NODE_ENV !== 'test' && process.env.ALLOW_STORE_RESET !== 'true') return;
    this.resetToSeed();
  }

  private buildUserArchive(uid: string, user: User, exportedAt: string) {
    const projectsRepo = this.getService<ProjectsRepository>(ProjectsRepository);
    const tasksRepo = this.getService<TasksRepository>(TasksRepository);
    const joinRequestsService = this.getService<JoinRequestsService>(JoinRequestsService);
    const commRepo = this.getService<CommunicationRepository>(CommunicationRepository);
    const notificationsService = this.getService<NotificationsService>(NotificationsService);
    const reputationService = this.getService<ReputationService>(ReputationService);
    const gamificationRepo = this.getService<GamificationRepository>(GamificationRepository);
    const moderationService = this.getService<ModerationService>(ModerationService);
    const mentorService = this.getService<MentorMarketplaceService>(MentorMarketplaceService);
    const escrowService = this.getService<EscrowService>(EscrowService);
    const payoutsService = this.getService<PayoutsService>(PayoutsService);

    const allProjects = projectsRepo ? projectsRepo.findAll(true) : [];
    const userProjects = allProjects.filter((p) => {
      if (String(p.ownerId) === uid || String(p.mentorId || '') === uid) return true;
      const collabs = Array.isArray(p.collaborators) ? p.collaborators : [];
      return collabs.some((c: any) =>
        typeof c === 'string' ? String(c) === uid : String(c?.id || c?.userId || '') === uid,
      );
    });
    const ownedProjectIds = new Set(
      userProjects.filter((p) => String(p.ownerId) === uid).map((p) => String(p.id)),
    );
    const projects = userProjects.map((p) => ({
      id: p.id,
      title: p.title || (p as any).name,
      description: p.description || (p as any).desc || '',
      status: p.status,
      category: (p as any).category,
      skills: p.skills || p.requiredSkills || [],
      role:
        String(p.ownerId) === uid
          ? 'Owner'
          : String(p.mentorId || '') === uid
            ? 'Mentor'
            : 'Collaborator',
      createdAt: p.createdAt,
      dueDate: p.dueDate,
      completedAt: p.completedAt,
      closedAt: p.closedAt,
      closureReason: p.closureReason || (p as any).closedReason,
      deletedAt: p.deletedAt,
    }));

    const userNameLower = (user.name || '').trim().toLowerCase();
    const allTasks = tasksRepo ? tasksRepo.findAll() : [];
    const tasks = allTasks
      .filter((t) => {
        if (String(t.assigneeId || '') === uid) return true;
        if (ownedProjectIds.has(String(t.projectId))) return true;
        const assigneeText = String(t.assignedTo || t.assigneeName || t.assignee || '').trim().toLowerCase();
        return Boolean(userNameLower && assigneeText && assigneeText === userNameLower);
      })
      .map((t) => ({
        id: t.id,
        projectId: t.projectId,
        title: t.title,
        description: t.description,
        status: t.status,
        xpReward: t.xpReward,
        dueDate: t.dueDate,
        proofLink: t.proofLink || t.proofUrl,
        rejectionReason: t.rejectionReason,
        rejectionHistory: t.rejectionHistory,
      }));

    const requests = joinRequestsService
      ? joinRequestsService.findByUser(uid).map((r: any) => ({
          id: r.id,
          projectId: r.projectId,
          projectTitle: r.projectTitle,
          status: r.status,
          role: r.role,
          message: r.message,
          skills: r.skills,
          rejectionReason: r.rejectionReason,
          createdAt: r.createdAt,
          decidedAt: r.decidedAt,
        }))
      : [];

    // Strict privacy boundary: ONLY chat messages written by the requesting user
    const rawOwnMessages = commRepo ? commRepo.getMessagesBySender(uid) : [];
    const messages = rawOwnMessages.map((m) => ({
      id: m.id,
      projectId: m.projectId,
      senderId: m.senderId,
      senderName: m.senderName,
      content: m.content || m.text || '',
      timestamp: m.timestamp,
    }));

    const notifications = notificationsService ? notificationsService.findByUser(uid) : [];
    const reputationLedger = reputationService ? reputationService.getEntries(uid) : [];
    const xpLedger = gamificationRepo ? gamificationRepo.findByUserId(uid) : [];
    const warnings = moderationService
      ? moderationService.getAdminUserWarnings(uid)
      : Array.isArray(user.data?.warnings)
        ? user.data.warnings
        : [];

    const mentorProfile = mentorService?.getAllProfiles?.().find((p) => String(p.userId) === uid);
    const mentorProfileId = mentorProfile ? String(mentorProfile.id) : '';
    const allSessions = mentorService ? mentorService.getAllSessions() : [];
    const partySessions = allSessions.filter(
      (s: any) =>
        String(s.studentId) === uid ||
        String(s.mentorUserId || '') === uid ||
        (mentorProfileId && String(s.mentorId) === mentorProfileId),
    );
    const partySessionIds = new Set(partySessions.map((s: any) => String(s.id)));

    const sessions = partySessions.map((s: any) => ({
      id: s.id,
      projectId: s.projectId,
      projectTitle: s.projectTitle,
      status: s.status,
      sessionPrice: s.sessionPrice ?? s.price,
      role: String(s.studentId) === uid ? 'student' : 'mentor',
      createdAt: s.createdAt,
    }));

    const escrows = escrowService
      ? escrowService.findAll().filter((e) => partySessionIds.has(String(e.mentorSessionId)))
      : [];
    const transactions = payoutsService
      ? payoutsService
          .findAll()
          .filter((t) => String(t.payerId) === uid || String(t.payeeId || '') === uid)
      : [];

    return {
      schemaVersion: '1.0',
      exportedAt,
      profile: {
        id: user.id,
        name: user.name,
        username: user.username || user.profile?.username || '',
        email: user.email,
        role: user.role,
        skills: user.skills || user.profile?.skills || [],
        bio: user.profile?.bio || '',
        university: user.university || user.profile?.university || user.profile?.uni || '',
        linkedIn: user.linkedIn || user.profile?.linkedin || '',
        phone: user.phone || user.profile?.phone || null,
        phoneVerified: Boolean(user.phoneVerified),
        emailVerified: user.emailVerified !== false,
        digestEnabled: (user as any).digestEnabled !== false,
        digestHour: (user as any).digestHour ?? 9,
        utcOffsetMinutes: (user as any).utcOffsetMinutes ?? 0,
        createdAt: user.createdAt,
        lastActiveAt: user.lastActiveAt,
      },
      projects,
      tasks,
      requests,
      messages,
      notifications,
      reputationLedger,
      xpLedger,
      warnings,
      sessions,
      payments: {
        escrows,
        transactions,
      },
    };
  }
}
