import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import * as crypto from 'crypto';
import { UsersRepository, User } from './users.repository';
import { UserStatus } from './dto/create-user.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { normalizeRole } from '../common/utils/role.util';
import { ClockService } from '../common/services/clock.service';
import { FileCleanupService } from '../common/services/file-cleanup.service';
import { ProjectsRepository } from '../projects/projects.repository';
import { ProjectInvitesService } from '../projects/invites.service';
import { isVisibleProject } from '../projects/project-visibility.util';
import { MentorMarketplaceService } from '../mentor-marketplace/mentor-marketplace.service';
import { MentorApplicationsService } from '../mentor-applications/mentor-applications.service';
import { EscrowService } from '../escrow/escrow.service';
import { EscrowState } from '../escrow/entities/escrow-account.entity';
import { CommunicationRepository } from '../communication/communication.repository';
import { TasksRepository } from '../tasks/tasks.repository';
import { TasksService } from '../tasks/tasks.service';
import { JoinRequestsService } from '../join-requests/join-requests.service';
import { ReportsService } from '../moderation/reports.service';
import { GovernanceRepository } from '../governance/governance.repository';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { DataExportService } from './data-export.service';
import { SupportService } from '../support/support.service';
import { LeaderboardService } from '../leaderboard/leaderboard.service';
import {
  NotificationsService,
  NotificationGroupedItem,
  dispatchGroupedNotification,
  formatGroupedItemList,
} from '../notifications/notifications.service';

export const DELETE_ATTEMPTS_PER_HOUR = 3;
export const DELETE_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export interface DeleteAccountResult {
  success: boolean;
  alreadyDeleted?: boolean;
  anonymizedId: string;
  deletedAt?: string;
  message?: string;
  released?: {
    projectCount: number;
    taskCount: number;
    fileCount: number;
  };
}

@Injectable()
export class AccountDeletionService {
  private readonly deleteAttempts = new Map<string, number[]>();
  private readonly fallbackFileCleanup = new FileCleanupService();

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly moduleRef: ModuleRef,
    @Optional() private readonly clockService?: ClockService,
    @Optional() private readonly fileCleanupService?: FileCleanupService,
  ) {}

  private nowMs(): number {
    return this.clockService ? this.clockService.now().getTime() : Date.now();
  }

  private getCleanupService(): FileCleanupService {
    return this.fileCleanupService || this.fallbackFileCleanup;
  }

  resetToSeed(): void {
    this.deleteAttempts.clear();
  }

  reset(): void {
    if (process.env.NODE_ENV === 'test' || process.env.ALLOW_STORE_RESET === 'true') {
      this.resetToSeed();
    }
  }

  static computeAnonymizedId(userId: string): string {
    const hash = crypto
      .createHash('sha256')
      .update(`deleted:${String(userId)}`)
      .digest('hex')
      .slice(0, 12);
    return `deleted_${hash}`;
  }

  private getService<T>(token: any): T | undefined {
    try {
      return this.moduleRef.get<T>(token, { strict: false });
    } catch {
      return undefined;
    }
  }

  private recordAndEnforceRateLimit(accountId: string): void {
    const nowMs = this.nowMs();
    const history = (this.deleteAttempts.get(accountId) || []).filter(
      (ts) => nowMs - ts < DELETE_RATE_WINDOW_MS,
    );
    if (history.length >= DELETE_ATTEMPTS_PER_HOUR) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          code: 'DELETE_RATE_LIMIT',
          message: 'Too many account deletion attempts. Please try again later.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    history.push(nowMs);
    this.deleteAttempts.set(accountId, history);
  }

  private verifyUsernameConfirmation(user: any, dto: DeleteAccountDto): void {
    const expectedUsername = String(user.username || user.profile?.username || '')
      .trim()
      .toLowerCase();
    const enteredUsername = String(dto?.username || '').trim().toLowerCase();

    if (!expectedUsername || !enteredUsername || enteredUsername !== expectedUsername) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'USERNAME_MISMATCH',
        message: 'Typed username does not match your account username.',
      });
    }
  }

  private collectOpenObligations(uid: string) {
    const obligations: Array<Record<string, any>> = [];
    const projectsRepo = this.getService<ProjectsRepository>(ProjectsRepository);
    const mentorService = this.getService<MentorMarketplaceService>(MentorMarketplaceService);
    const escrowService = this.getService<EscrowService>(EscrowService);

    const allProjects = projectsRepo ? projectsRepo.findAll(true) : [];
    for (const p of allProjects) {
      if (String(p.ownerId) !== uid) continue;
      if (!isVisibleProject(p)) continue;
      const st = String(p.status || '').toLowerCase().trim();
      const isFinished =
        p.isCompleted === true ||
        st === 'completed' ||
        st === 'closed' ||
        st === 'cancelled';
      if (!isFinished) {
        obligations.push({
          type: 'project',
          id: p.id,
          title: p.title || (p as any).name || p.id,
          status: p.status,
          reason: `Owned project "${p.title || p.id}" is still ${p.status}. Complete or close it first.`,
        });
      }
    }

    const mentorProfile = mentorService?.getAllProfiles?.().find((p) => String(p.userId) === uid);
    const mentorProfileId = mentorProfile ? String(mentorProfile.id) : '';
    const allSessions = mentorService ? mentorService.getAllSessions() : [];
    const terminalStatuses = new Set([
      'completed',
      'released',
      'refunded',
      'cancelled',
      'declined',
      'expired',
    ]);

    const partySessionIds = new Set<string>();
    for (const s of allSessions as any[]) {
      const isParty =
        String(s.studentId) === uid ||
        String(s.mentorUserId || '') === uid ||
        (mentorProfileId && String(s.mentorId) === mentorProfileId);
      if (!isParty) continue;
      partySessionIds.add(String(s.id));

      const st = String(s.status || '').toLowerCase().trim();
      if (!terminalStatuses.has(st)) {
        obligations.push({
          type: 'session',
          id: s.id,
          projectId: s.projectId,
          status: s.status,
          reason: `Mentor session ${s.id} is still "${s.status}".`,
        });
      }
    }

    const escrows = escrowService ? escrowService.findAll() : [];
    for (const e of escrows) {
      if (!partySessionIds.has(String(e.mentorSessionId))) continue;
      if (e.status === EscrowState.Funded || e.status === EscrowState.Disputed) {
        obligations.push({
          type: 'escrow',
          id: e.id,
          sessionId: e.mentorSessionId,
          amount: e.totalFunded,
          status: e.status,
          reason: `Escrow ${e.id} holds ${e.totalFunded} (${e.status}).`,
        });
      }
    }

    return obligations;
  }

  collectActiveTaskBlockers(uid: string) {
    const blockers: Array<{
      taskId: string;
      taskTitle: string;
      projectId: string;
      projectTitle: string;
      status: string;
    }> = [];

    const tasksRepo = this.getService<TasksRepository>(TasksRepository);
    const projectsRepo = this.getService<ProjectsRepository>(ProjectsRepository);
    if (!tasksRepo || !projectsRepo) return blockers;

    const allTasks = tasksRepo.findAll() || [];
    for (const t of allTasks) {
      const isAssigned =
        String(t.assigneeId || '') === uid ||
        String(t.assignedTo || '') === uid;
      if (!isAssigned) continue;

      const st = String(t.status || '').toLowerCase().replace(/[\s-_]/g, '');
      const isBlockedStatus =
        st === 'todo' ||
        st === 'open' ||
        st === 'inprogress' ||
        st === 'inreview';
      if (!isBlockedStatus) continue;

      const project = projectsRepo.findById(String(t.projectId));
      if (!project) continue;
      if (!isVisibleProject(project)) continue;
      const projSt = String(project.status || '').toLowerCase().trim();
      const isProjectFinished =
        project.isCompleted === true ||
        projSt === 'completed' ||
        projSt === 'closed' ||
        projSt === 'cancelled' ||
        (project as any).isDeleted === true ||
        Boolean((project as any).deletedAt);
      if (isProjectFinished) continue;

      blockers.push({
        taskId: String(t.id),
        taskTitle: t.title || String(t.id),
        projectId: String(project.id),
        projectTitle: project.title || (project as any).name || String(project.id),
        status: String(t.status),
      });
    }

    return blockers;
  }

  checkDeletionEligibility(userId: string, callerEmail?: string) {
    const uid = String(userId || '').trim();
    const verifiedEmail = String(callerEmail || '').trim().toLowerCase();
    const user =
      this.usersRepository.findById(uid) ||
      (verifiedEmail ? this.usersRepository.findByEmail(verifiedEmail) : undefined);
    if (!user) {
      throw new NotFoundException('User account not found.');
    }

    const resolvedUid = String(user.id);
    const taskBlockers = this.collectActiveTaskBlockers(resolvedUid);
    const obligations = this.collectOpenObligations(resolvedUid);
    const canDelete = taskBlockers.length === 0 && obligations.length === 0;

    return {
      canDelete,
      taskBlockers,
      obligations,
      blockers: [
        ...taskBlockers.map((b) => ({
          type: 'active_task',
          ...b,
          reason: `Active task "${b.taskTitle}" (${b.status}) in project "${b.projectTitle}".`,
        })),
        ...obligations,
      ],
    };
  }

  /**
   * Permanently deletes and anonymises a non-admin account.
   * Safe and idempotent on repeated invocations.
   */
  deleteMyAccount(userId: string, dto: DeleteAccountDto, callerEmail?: string): DeleteAccountResult {
    const uid = String(userId || '').trim();
    const verifiedEmail = String(callerEmail || '').trim().toLowerCase();
    // Always resolve target strictly from verified token claims (uid, falling back to verified email if Firebase uid differs from seed/repo key) — never from dto.username or request body IDs.
    const user =
      this.usersRepository.findById(uid) ||
      (verifiedEmail ? this.usersRepository.findByEmail(verifiedEmail) : undefined);
    if (!user) {
      throw new NotFoundException('User account not found.');
    }

    const resolvedUid = String(user.id);
    if (user.isDeleted || user.deletedAt) {
      return {
        success: true,
        alreadyDeleted: true,
        anonymizedId: user.username || AccountDeletionService.computeAnonymizedId(resolvedUid),
        deletedAt: user.deletedAt,
      };
    }

    const role = normalizeRole(user.role);
    if (role === 'admin' || role === 'superuser') {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'ADMIN_CANNOT_SELF_DELETE',
        message: 'Administrators cannot self-delete their accounts.',
      });
    }

    const statusLower = String(user.status || '').toLowerCase().trim();
    if (statusLower === 'suspended' || statusLower === 'banned') {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'ACCOUNT_SUSPENDED',
        message: 'Suspended accounts cannot be deleted. Appeal or resolve your suspension first.',
      });
    }

    this.recordAndEnforceRateLimit(resolvedUid);
    this.verifyUsernameConfirmation(user, dto);

    // Safeguard: Check for active or in-review assigned tasks
    const taskBlockers = this.collectActiveTaskBlockers(resolvedUid);
    if (taskBlockers.length > 0) {
      throw new HttpException(
        {
          statusCode: HttpStatus.CONFLICT,
          error: 'Conflict',
          code: 'ACCOUNT_HAS_ACTIVE_TASKS',
          message:
            'You cannot delete your account while you have active or in-review tasks. Complete, unassign, or leave the projects first.',
          blockers: taskBlockers,
        },
        HttpStatus.CONFLICT,
      );
    }

    const obligations = this.collectOpenObligations(resolvedUid);
    if (obligations.length > 0) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'ACCOUNT_HAS_OPEN_OBLIGATIONS',
        message:
          'You still have unfinished owned projects, active/pending mentor sessions, or money held in escrow.',
        obligations,
      });
    }

    return this.anonymizeAccount(user, {
      deletedBySuperUser: false,
      successMessage: 'Your account has been permanently deleted and anonymized.',
    });
  }

  deleteUserBySuperUser(
    actorId: string,
    targetUserId: string,
    rawReason?: string,
  ): DeleteAccountResult {
    const uid = String(targetUserId || '');
    const user = this.usersRepository.findById(uid);
    if (!user) {
      throw new NotFoundException(`User with ID ${targetUserId} not found.`);
    }

    const targetRole = normalizeRole(user.role);
    if (targetRole === 'superuser' || String(actorId) === uid) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'CANNOT_DELETE_SUPERUSER',
        message: 'Super User accounts cannot be deleted.',
      });
    }

    if (user.isDeleted || user.deletedAt) {
      return {
        success: true,
        alreadyDeleted: true,
        anonymizedId: user.username || AccountDeletionService.computeAnonymizedId(uid),
        deletedAt: user.deletedAt,
      };
    }

    const reason = typeof rawReason === 'string' ? rawReason.trim() : '';
    if (!reason || reason.length < 3 || reason.length > 500) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'REASON_REQUIRED',
        message: 'A deletion reason between 3 and 500 characters is required.',
      });
    }

    const obligations = this.collectOpenObligations(uid);
    if (obligations.length > 0) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'ACCOUNT_HAS_OPEN_OBLIGATIONS',
        message:
          'User still has unfinished owned projects, active/pending mentor sessions, or money held in escrow.',
        obligations,
      });
    }

    return this.anonymizeAccount(user, {
      deletedBySuperUser: true,
      actorId: String(actorId),
      reason,
      successMessage: 'User account has been permanently deleted and anonymized by Super User.',
    });
  }

  private anonymizeAccount(
    user: User,
    options: {
      deletedBySuperUser: boolean;
      actorId?: string;
      reason?: string;
      successMessage: string;
    },
  ): DeleteAccountResult {
    const uid = String(user.id);
    const nowIso = (this.clockService ? this.clockService.now() : new Date()).toISOString();
    const anonymizedId = AccountDeletionService.computeAnonymizedId(uid);
    const origName = user.name;
    const origUsername = user.username || user.profile?.username;
    const origEmail = user.email;

    const userPersonalSnapshot = {
      avatar: (user as any).avatar,
      cvFileName: (user as any).cvFileName,
      cvUrl: (user as any).cvUrl,
      profile: user.profile
        ? {
            avatar: (user.profile as any).avatar,
            photoUrl: (user.profile as any).photoUrl,
            cvFileName: (user.profile as any).cvFileName,
            cvUrl: (user.profile as any).cvUrl,
          }
        : undefined,
    };

    // 1. Anonymise user record and revoke every active token/session
    user.name = 'Deleted user';
    user.username = anonymizedId;
    user.email = `${anonymizedId}@deleted.local`;
    user.phone = undefined;
    user.phoneVerified = false;
    user.phoneVerifiedAt = undefined;
    user.linkedIn = undefined;
    (user as any).avatar = undefined;
    (user as any).cvFileName = undefined;
    (user as any).cvUrl = undefined;
    user.password = undefined;
    user.university = '';
    user.skills = [];
    user.refreshTokens = [];
    user.allowedLegacyJti = undefined;
    user.tokenVersion = (user.tokenVersion || 1) + 1;
    user.isDeleted = true;
    user.isHidden = true;
    user.deletedAt = nowIso;
    user.status = UserStatus.Inactive;
    if (user.profile) {
      user.profile.fullName = 'Deleted user';
      user.profile.username = anonymizedId;
      user.profile.bio = '';
      user.profile.linkedin = undefined;
      (user.profile as any).avatar = undefined;
      (user.profile as any).photoUrl = undefined;
      (user.profile as any).cvFileName = undefined;
      (user.profile as any).cvUrl = undefined;
      user.profile.phone = undefined;
      user.profile.phoneVerified = false;
      user.profile.phoneVerifiedAt = undefined;
      user.profile.university = '';
      user.profile.uni = '';
      user.profile.skills = [];
    }
    this.usersRepository.rebuildIndexes();

    // 2. Clear pending reset / email-verification tokens
    const authService = this.getService<AuthService>(AuthService);
    authService?.clearUserTokens?.(uid);

    // 3. Phase 24 full release:
    //    - Return Open and In Progress tasks to Unassigned + Open via Phase 13 departure function
    //    - Preserve In Review and Completed tasks under "Deleted user"
    //    - Remove deleted user from every project's collaborators/members list so seats become free
    //    - Close pending requests & cancel pending invites
    const tasksService = this.getService<TasksService>(TasksService);
    const releasedTaskRes = tasksService?.releaseMemberTasksOnDeparture
      ? tasksService.releaseMemberTasksOnDeparture({
          userId: uid,
          userName: origName,
          reason: 'removed',
        })
      : { releasedTasks: [], affectedProjectIds: [] };
    const taskCount = releasedTaskRes.releasedTasks.length;

    const tasksRepo = this.getService<TasksRepository>(TasksRepository);
    tasksRepo?.anonymizeUser?.(uid, origName);

    const commRepo = this.getService<CommunicationRepository>(CommunicationRepository);
    commRepo?.anonymizeSender?.(uid);

    const releasedProjectIds = new Set<string>();
    const joinRequestsService = this.getService<JoinRequestsService>(JoinRequestsService);
    const joinReleaseRes = (joinRequestsService as any)?.releaseForDeletedUser
      ? (joinRequestsService as any).releaseForDeletedUser(uid, anonymizedId)
      : { totalTouched: joinRequestsService?.anonymizeUser?.(uid, anonymizedId) || 0, releasedApprovedCount: 0 };

    const projectsRepo = this.getService<ProjectsRepository>(ProjectsRepository);
    if (projectsRepo) {
      for (const p of projectsRepo.findAll(true)) {
        if (String(p.ownerId) === uid) {
          p.owner = 'Deleted user';
        }
        if (String(p.mentorId || '') === uid) {
          p.mentor = 'Deleted user';
        }
        let projectModified = false;
        if (Array.isArray(p.collaborators)) {
          const filteredCollabs = p.collaborators.filter((c: any) => {
            const cid = typeof c === 'string' ? c : String(c?.id || c?.userId || '');
            return cid !== uid;
          });
          if (filteredCollabs.length !== p.collaborators.length) {
            p.collaborators = filteredCollabs;
            releasedProjectIds.add(String(p.id));
            projectModified = true;
          }
        }
        if (Array.isArray((p as any).members)) {
          const origMembers = (p as any).members as any[];
          const filteredMembers = origMembers.filter((m: any) => {
            const mid = typeof m === 'string' ? m : String(m?.id || m?.userId || '');
            return mid !== uid;
          });
          if (filteredMembers.length !== origMembers.length) {
            (p as any).members = filteredMembers;
            releasedProjectIds.add(String(p.id));
            projectModified = true;
          }
        }
        if (Array.isArray((p as any).teamMembers)) {
          const origTeam = (p as any).teamMembers as any[];
          const filteredTeam = origTeam.filter((m: any) => {
            const mid = typeof m === 'string' ? m : String(m?.id || m?.userId || '');
            return mid !== uid;
          });
          if (filteredTeam.length !== origTeam.length) {
            (p as any).teamMembers = filteredTeam;
            releasedProjectIds.add(String(p.id));
            projectModified = true;
          }
        }
        if (projectModified) {
          try {
            projectsRepo.update(p.id, {
              collaborators: p.collaborators,
              ...(Array.isArray((p as any).members) ? { members: (p as any).members } : {}),
              ...(Array.isArray((p as any).teamMembers) ? { teamMembers: (p as any).teamMembers } : {}),
            } as any);
          } catch {}
        }
      }
    }

    if (joinRequestsService && typeof joinRequestsService.findByUser === 'function') {
      try {
        for (const req of joinRequestsService.findByUser(uid)) {
          if (String((req as any).closureReason || '') === 'Collaborator account deleted' && req.projectId) {
            releasedProjectIds.add(String(req.projectId));
          }
        }
      } catch {}
    }
    const projectCount = Math.max(releasedProjectIds.size, Number(joinReleaseRes?.releasedApprovedCount || 0) > 0 ? releasedProjectIds.size : 0);

    const projectInvitesService = this.getService<ProjectInvitesService>(ProjectInvitesService);
    projectInvitesService?.cancelForDeletedUser?.(uid);

    // Notify each affected project owner ONCE summarizing released tasks / vacated seats
    const notificationsService = this.getService<NotificationsService>(NotificationsService);
    if (notificationsService && projectsRepo) {
      const ownerNoticeMap = new Map<
        string,
        {
          items: NotificationGroupedItem[];
          projectIds: Set<string>;
          projectTitles: Set<string>;
          releasedTaskProjectIds: Set<string>;
        }
      >();

      const ensureOwnerBucket = (ownerId: string) => {
        if (!ownerNoticeMap.has(ownerId)) {
          ownerNoticeMap.set(ownerId, {
            items: [],
            projectIds: new Set(),
            projectTitles: new Set(),
            releasedTaskProjectIds: new Set(),
          });
        }
        return ownerNoticeMap.get(ownerId)!;
      };

      const allProjectsById = new Map(
        projectsRepo.findAll(true).map((proj: any) => [String(proj.id), proj]),
      );

      for (const task of releasedTaskRes.releasedTasks || []) {
        const proj = allProjectsById.get(String(task.projectId));
        if (!proj || !proj.ownerId || String(proj.ownerId) === uid) continue;
        const oid = String(proj.ownerId);
        const ownerRecord = this.usersRepository.findById(oid);
        if (ownerRecord?.isDeleted || ownerRecord?.deletedAt) continue;

        const projTitle = proj.title || (proj as any).name || `Project ${proj.id}`;
        const bucket = ensureOwnerBucket(oid);
        bucket.projectIds.add(String(proj.id));
        bucket.projectTitles.add(projTitle);
        bucket.releasedTaskProjectIds.add(String(proj.id));
        bucket.items.push({
          label: `${task.title || task.id} (${projTitle})`,
          link: `/owner/workspace/${proj.id}`,
        });
      }

      for (const pid of releasedProjectIds) {
        const proj = allProjectsById.get(String(pid));
        if (!proj || !proj.ownerId || String(proj.ownerId) === uid) continue;
        const oid = String(proj.ownerId);
        const ownerRecord = this.usersRepository.findById(oid);
        if (ownerRecord?.isDeleted || ownerRecord?.deletedAt) continue;

        const projTitle = proj.title || (proj as any).name || `Project ${proj.id}`;
        const bucket = ensureOwnerBucket(oid);
        bucket.projectIds.add(pid);
        bucket.projectTitles.add(projTitle);
        if (!bucket.releasedTaskProjectIds.has(pid)) {
          bucket.items.push({
            label: `${projTitle} (seat freed)`,
            link: `/owner/workspace/${pid}`,
          });
        }
      }

      for (const [ownerId, bucket] of ownerNoticeMap.entries()) {
        try {
          const primaryProjectId = Array.from(bucket.projectIds)[0];
          const projCount = bucket.projectIds.size;
          dispatchGroupedNotification(
            notificationsService,
            ownerId,
            `account_deleted:${anonymizedId}`,
            bucket.items,
            (items, count) => ({
              type: 'TASK_RELEASED',
              priority: 'immediate',
              title:
                projCount > 1
                  ? `Collaborator account deleted (${projCount} projects updated)`
                  : `Collaborator account deleted (${count} ${count === 1 ? 'item' : 'items'})`,
              message: `A departed member released ${count} ${count === 1 ? 'item' : 'items'} across ${projCount} ${projCount === 1 ? 'project' : 'projects'}: ${formatGroupedItemList(items, 10)}`,
              readStatus: false,
              referenceId: primaryProjectId,
              link: `/owner/workspace/${primaryProjectId}`,
            }),
          );
        } catch {}
      }
    }

    const mentorService = this.getService<MentorMarketplaceService>(MentorMarketplaceService);
    mentorService?.anonymizeUser?.(uid);

    // 4. Delete personal CV files, uploads/avatars, and requested data exports via FileCleanupService
    const cleanupService = this.getCleanupService();
    const mentorAppsService = this.getService<MentorApplicationsService>(MentorApplicationsService);
    const reportsService = this.getService<ReportsService>(ReportsService);
    const supportService = this.getService<SupportService>(SupportService);
    const dataExportService = this.getService<DataExportService>(DataExportService);

    const protectedUploadNames = new Set<string>();
    const protectedCvNames = new Set<string>();
    const emptySet = new Set<string>();

    const otherUsers = this.usersRepository.findAll(true).filter((u) => String(u.id) !== uid && !u.isDeleted);
    cleanupService.extractUploadRefsFromValue(otherUsers, protectedUploadNames, emptySet);
    cleanupService.extractUploadRefsFromValue(projectsRepo ? projectsRepo.findAll(true) : [], protectedUploadNames, emptySet);
    cleanupService.extractUploadRefsFromValue(tasksRepo ? tasksRepo.findAll() : [], protectedUploadNames, emptySet);
    cleanupService.extractUploadRefsFromValue(commRepo?.getAllMessages?.() || [], protectedUploadNames, emptySet);
    cleanupService.extractUploadRefsFromValue(reportsService?.getAllRaw?.() || [], protectedUploadNames, emptySet);
    cleanupService.extractUploadRefsFromValue(supportService?.findAll?.() || [], protectedUploadNames, emptySet);
    cleanupService.extractUploadRefsFromValue(mentorService?.getAllMarketplaceRecords?.() || {}, protectedUploadNames, emptySet);

    const mentorApps = mentorAppsService ? mentorAppsService.findAll() : [];
    for (const app of mentorApps) {
      if (String(app.userId) !== uid) {
        cleanupService.extractUploadRefsFromValue(app, protectedUploadNames, protectedCvNames);
        if (app.cvFileName) {
          protectedCvNames.add(String(app.cvFileName).split(/[\\/]/).pop() || '');
        }
      }
    }

    const personalFileRes = cleanupService.deleteUserPersonalFiles({
      userId: uid,
      user: userPersonalSnapshot,
      mentorApplications: mentorApps,
      exportRecords: [],
      protectedUploadNames,
      protectedCvNames,
    });
    const exportDeleteRes = dataExportService?.deleteForUser
      ? dataExportService.deleteForUser(uid)
      : { deletedCount: 0, deletedFilesCount: 0, errors: [] };
    const fileCount = personalFileRes.deletedCount + exportDeleteRes.deletedFilesCount;

    // 5. Anonymise user identifiers in reports and audit entries using irreversible hashed ID
    reportsService?.anonymizeUser?.(uid, anonymizedId, [origName, origEmail, origUsername]);

    const govRepo = this.getService<GovernanceRepository>(GovernanceRepository);
    govRepo?.anonymizeUser?.(uid, anonymizedId);

    const auditService = this.getService<AuditService>(AuditService);
    auditService?.anonymizeUser?.(uid, anonymizedId, [origName, origEmail, origUsername]);

    auditService?.log?.({
      action: options.deletedBySuperUser ? 'USER_DELETED_BY_SUPERUSER' : 'account-deleted',
      entityType: 'user',
      entityId: anonymizedId,
      performedBy: options.deletedBySuperUser ? String(options.actorId || 'superuser') : anonymizedId,
      actor: options.deletedBySuperUser ? String(options.actorId || 'superuser') : anonymizedId,
      target: anonymizedId,
      event: options.deletedBySuperUser
        ? `Account ${anonymizedId} deleted and anonymized by Super User`
        : `Account ${anonymizedId} deleted and anonymized`,
      details: {
        anonymizedId,
        deletedAt: nowIso,
        ...(options.deletedBySuperUser ? { reason: options.reason } : {}),
      },
    });

    auditService?.log?.({
      action: 'ACCOUNT_RELEASED',
      entityType: 'user',
      entityId: anonymizedId,
      performedBy: options.deletedBySuperUser ? String(options.actorId || 'superuser') : anonymizedId,
      actor: options.deletedBySuperUser ? String(options.actorId || 'superuser') : anonymizedId,
      target: anonymizedId,
      event: `Released resources for deleted account ${anonymizedId}: ${projectCount} project(s), ${taskCount} task(s), ${fileCount} file(s)`,
      details: {
        anonymizedId,
        projectCount,
        taskCount,
        fileCount,
      },
    });

    const leaderboardService = this.getService<LeaderboardService>(LeaderboardService);
    leaderboardService?.invalidateCache?.();

    return {
      success: true,
      anonymizedId,
      deletedAt: nowIso,
      message: options.successMessage,
      released: {
        projectCount,
        taskCount,
        fileCount,
      },
    };
  }
}
