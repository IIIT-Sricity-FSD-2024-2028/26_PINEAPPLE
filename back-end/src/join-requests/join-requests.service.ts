import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Inject,
  forwardRef,
  Optional,
  OnModuleInit,
} from '@nestjs/common';
import { BaseService } from '../common/abstracts/base.service';
import { JoinRequestEntity } from './entities/join-request.entity';
import { CreateJoinRequestDto } from './dto/create-join-request.dto';
import { UpdateJoinRequestDto } from './dto/update-join-request.dto';
import { ProjectsService } from '../projects/projects.service';
import { AuditService } from '../audit/audit.service';
import {
  NotificationsService,
  NotificationGroupedItem,
  dispatchGroupedNotification,
  formatGroupedItemList,
} from '../notifications/notifications.service';
import { ClockService } from '../common/services/clock.service';
import { isProjectOwner, isPlatformAdminOrSuperUser, getProjectRole } from '../common/utils/role.util';
import { UsersService } from '../users/users.service';
import { ProjectInvitesService } from '../projects/invites.service';
import { FeedbackService } from '../feedback/feedback.service';
import { computeSkillMatch, normalizeSkills } from '../common/utils/skill-match.util';

export type RequestState =
  | 'none'
  | 'pending'
  | 'rejected_can_retry'
  | 'rejected_final'
  | 'member'
  | 'banned'
  | 'full'
  | 'closed'
  | 'invited'
  | 'not_accepting';

export interface MyRequestStatusResult {
  state: RequestState;
  requestsUsed: number;
  requestsLeft: number;
  lastReason?: string;
  inviteId?: string;
}

@Injectable()
export class JoinRequestsService extends BaseService<JoinRequestEntity, Promise<JoinRequestEntity>> implements OnModuleInit {
  constructor(
    @Inject(forwardRef(() => ProjectsService))
    private readonly projectsService: any,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    @Optional()
    private readonly clockService?: ClockService,
    @Optional()
    @Inject(forwardRef(() => UsersService))
    private readonly usersService?: UsersService,
    @Optional()
    @Inject(forwardRef(() => ProjectInvitesService))
    private readonly projectInvitesService?: ProjectInvitesService,
    @Optional()
    private readonly feedbackService?: FeedbackService,
  ) {
    super();
  }

  onModuleInit(): void {
    if (this.feedbackService) {
      this.feedbackService.registerEntityResolver('APPLICATION', (id: string) => {
        const req = this.findOne(id);
        if (!req) return { exists: false, parties: [] };
        let ownerId: string | undefined;
        try {
          const project = this.projectsService?.findById?.(req.projectId);
          if (project?.ownerId) ownerId = String(project.ownerId);
        } catch {}
        const parties = [String(req.userId)];
        if (ownerId && !parties.includes(ownerId)) parties.push(ownerId);
        return {
          exists: true,
          projectId: req.projectId,
          parties,
          actorId: String(req.userId),
          targetId: ownerId,
        };
      });
    }
  }

  /**
   * Helper: Resets in-memory store in test environment.
   */
  resetToSeed(): void {
    this.items.length = 0;
  }

  reset(): void {
    if (process.env.NODE_ENV === 'test' || process.env.ALLOW_STORE_RESET === 'true') {
      this.resetToSeed();
    }
  }

  /**
   * Helper: Counts how many requests the user has consumed for a project.
   * Pending, rejected, later withdrawn, and approved requests count.
   * Requests with status 'system_closed' or early withdrawals (countedTowardLimit === false) DO NOT count.
   */
  requestsUsed(userId: string, projectId: string): number {
    const uid = String(userId);
    const pid = String(projectId);
    return this.items.filter(
      (r) =>
        String(r.userId) === uid &&
        String(r.projectId) === pid &&
        String(r.status || '').toLowerCase() !== 'system_closed' &&
        r.countedTowardLimit !== false,
    ).length;
  }

  /**
   * Helper: Calculates remaining requests for the project (max 2 per project).
   */
  requestsLeft(userId: string, projectId: string): number {
    return Math.max(0, 2 - this.requestsUsed(userId, projectId));
  }

  /**
   * Helper: Resolves the comprehensive request state for a user and project.
   */
  getMyRequestStatus(userId: string, projectId: string): MyRequestStatusResult {
    const uid = String(userId);
    const project = this.projectsService.findById(projectId);
    const used = this.requestsUsed(uid, projectId);
    const left = Math.max(0, 2 - used);

    if (!project) {
      return { state: 'none', requestsUsed: used, requestsLeft: left };
    }

    // 0. Fix 3: Check pending direct invite from project owner
    const pendingInvite = this.projectInvitesService?.findPending?.(projectId, uid);
    if (pendingInvite) {
      return {
        state: 'invited',
        requestsUsed: used,
        requestsLeft: left,
        inviteId: pendingInvite.id,
      };
    }

    // 1. Is user an approved collaborator or owner?
    const collabs = Array.isArray(project.collaborators) ? project.collaborators : [];
    const isMember =
      collabs.some((c: any) =>
        typeof c === 'string'
          ? String(c) === uid
          : String(c.id || c.userId) === uid,
      ) || String(project.ownerId) === uid;

    if (isMember) {
      return { state: 'member', requestsUsed: used, requestsLeft: left };
    }

    // 2. Was user removed / banned from the project?
    if (Array.isArray(project.removedUsers)) {
      const removedRecord = project.removedUsers.find(
        (r: any) => String(r.userId || r.id) === uid,
      );
      if (removedRecord) {
        return {
          state: 'banned',
          requestsUsed: used,
          requestsLeft: left,
          lastReason: removedRecord.reason,
        };
      }
    }

    // 3. Is the project deleted, draft, closed, or completed?
    const statusLower = String(project.status || '').toLowerCase().trim();
    if (project.deletedAt) {
      return {
        state: 'not_accepting',
        requestsUsed: used,
        requestsLeft: left,
        lastReason: 'Project deleted',
      };
    }
    if (statusLower === 'closed') {
      return {
        state: 'closed',
        requestsUsed: used,
        requestsLeft: left,
        lastReason: project.closureReason,
      };
    }
    if (this.projectsService.isLocked(project) || project.isCompleted || statusLower === 'completed') {
      return {
        state: 'not_accepting',
        requestsUsed: used,
        requestsLeft: left,
        lastReason: 'Project completed',
      };
    }

    // 4. Does user have an active pending request?
    const pendingReq = this.items.find(
      (r) =>
        String(r.userId) === uid &&
        String(r.projectId) === String(projectId) &&
        String(r.status || '').toLowerCase() === 'pending',
    );
    if (pendingReq) {
      return { state: 'pending', requestsUsed: used, requestsLeft: left };
    }

    // 5. Does user have rejected requests?
    const rejectedReqs = this.items.filter(
      (r) =>
        String(r.userId) === uid &&
        String(r.projectId) === String(projectId) &&
        String(r.status || '').toLowerCase() === 'rejected',
    );
    const lastRejected = rejectedReqs[rejectedReqs.length - 1];

    if (rejectedReqs.length > 0) {
      if (left <= 0) {
        return {
          state: 'rejected_final',
          requestsUsed: used,
          requestsLeft: 0,
          lastReason: lastRejected?.rejectionReason || (lastRejected as any)?.reason,
        };
      }
      if (this.projectsService.isFull(project)) {
        return {
          state: 'full',
          requestsUsed: used,
          requestsLeft: left,
          lastReason: lastRejected?.rejectionReason || (lastRejected as any)?.reason,
        };
      }
      return {
        state: 'rejected_can_retry',
        requestsUsed: used,
        requestsLeft: left,
        lastReason: lastRejected?.rejectionReason || (lastRejected as any)?.reason,
      };
    }

    // 6. If user has reached request limit (e.g. 2 withdrawn requests):
    if (used >= 2) {
      return {
        state: 'rejected_final',
        requestsUsed: used,
        requestsLeft: 0,
      };
    }

    // 7. Is project full?
    if (this.projectsService.isFull(project)) {
      return { state: 'full', requestsUsed: used, requestsLeft: left };
    }

    return { state: 'none', requestsUsed: used, requestsLeft: left };
  }

  create(createJoinRequestDto: CreateJoinRequestDto, requesterId?: string): JoinRequestEntity {
    if (!createJoinRequestDto.userId && requesterId) {
      createJoinRequestDto.userId = requesterId;
    }
    if (requesterId && createJoinRequestDto.userId && requesterId !== createJoinRequestDto.userId) {
      throw new ForbiddenException('You can only submit join requests for yourself.');
    }

    const targetUserId = String(createJoinRequestDto.userId);
    const targetProjectId = String(createJoinRequestDto.projectId);

    // Rule: Maximum 2 requests per project
    const used = this.requestsUsed(targetUserId, targetProjectId);
    if (used >= 2) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'REQUEST_LIMIT_REACHED',
        message: 'You have reached the maximum limit of 2 join requests for this project.',
      });
    }

    let project: any;
    try {
      project = this.projectsService.findById(targetProjectId, undefined, { includeDeleted: true });
    } catch {
      project = this.projectsService.projectsRepository?.findById(targetProjectId);
    }
    if (!project) {
      throw new BadRequestException(`Project with ID ${targetProjectId} not found.`);
    }

    // Fix 3: Check Deleted project
    if (project.deletedAt || (project as any).isDeleted) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'PROJECT_NOT_ACCEPTING_REQUESTS',
        message: 'This project is not accepting applications.',
      });
    }

    // Check Closed status
    const statusLower = String(project.status || '').toLowerCase().trim();
    if (statusLower === 'closed') {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'PROJECT_CLOSED',
        message: 'This project is closed and no longer accepts applications.',
      });
    }

    // Fix 3: Check Completed status
    if (
      this.projectsService.isLocked(project) ||
      (project as any).isCompleted === true ||
      statusLower === 'completed'
    ) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'PROJECT_NOT_ACCEPTING_REQUESTS',
        message: 'This project is completed and no longer accepts applications.',
      });
    }

    // Role check via getProjectRole: One role per person policy
    const existingRole = typeof this.projectsService?.getProjectRole === 'function'
      ? this.projectsService.getProjectRole(project.id, targetUserId)
      : getProjectRole(project, targetUserId);
    if (existingRole === 'Owner' || String(project.ownerId) === targetUserId) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'ALREADY_PROJECT_OWNER',
        message: 'Project owners cannot apply to their own project.',
      });
    }
    if (existingRole === 'Mentor') {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'ALREADY_PROJECT_MENTOR',
        message: 'The assigned mentor cannot apply as a collaborator.',
      });
    }
    if (existingRole === 'Collaborator') {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'ALREADY_MEMBER',
        message: 'You are already a member of this project.',
      });
    }

    // Check Project Full
    if (this.projectsService.isFull(project)) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'PROJECT_FULL',
        message: 'This project is full.',
      });
    }

    // Check Removed / Banned Member
    if (Array.isArray(project.removedUsers)) {
      const removedRecord = project.removedUsers.find(
        (r: any) =>
          String(r.userId || r.id) === targetUserId ||
          (r.userName &&
            createJoinRequestDto.userName &&
            r.userName.toLowerCase() === createJoinRequestDto.userName.toLowerCase()),
      );
      if (removedRecord) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'Forbidden',
          code: 'BANNED',
          message: `You were removed from this project with reason: "${removedRecord.reason}". Re-applying is not permitted.`,
        });
      }
    }

    // Check Already Member
    const existingCollabs = Array.isArray(project.collaborators) ? project.collaborators : [];
    const isAlreadyMember = existingCollabs.some((c: any) =>
      typeof c === 'string' ? String(c) === targetUserId : String(c.id || c.userId) === targetUserId,
    );
    if (isAlreadyMember) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'ALREADY_MEMBER',
        message: 'You are already a collaborator on this project.',
      });
    }

    // Check Already Pending
    const hasPending = this.items.some(
      (req) =>
        String(req.projectId) === targetProjectId &&
        String(req.userId) === targetUserId &&
        String(req.status || '').toLowerCase() === 'pending',
    );
    if (hasPending) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'ALREADY_PENDING',
        message: 'A pending join request already exists for this project.',
      });
    }

    // Active project membership cap check (max 3 non-finished memberships)
    if (typeof this.projectsService?.assertCanJoinProject === 'function') {
      this.projectsService.assertCanJoinProject(targetUserId);
    }

    // Fix 3: One open item per person and project. Cannot apply if owner invite is pending.
    const hasPendingInvite = this.projectInvitesService?.hasPendingInvite?.(targetProjectId, targetUserId);
    if (hasPendingInvite) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'INVITE_PENDING_FROM_OWNER',
        message: 'The owner has already invited you. Accept or decline the invitation instead.',
      });
    }

    const now = this.clockService?.now() || new Date();
    const nowIso = now.toISOString();
    const joinRequest: JoinRequestEntity = {
      ...createJoinRequestDto,
      userName: createJoinRequestDto.userName || 'Collaborator',
      status: 'pending',
      sentAt: nowIso,
      viewedAt: undefined,
      countedTowardLimit: true,
      createdAt: now,
      updatedAt: now,
    } as any;
    const created = super.create(joinRequest);

    try {
      this.auditService.log({
        action: 'join-request-sent',
        actor: created.userName || 'Collaborator',
        target: `Project #${created.projectId}`,
        entityType: 'join_request',
        entityId: created.id,
        event: `${created.userName || 'User'} sent join request for project #${created.projectId}`,
        details: { role: created.role, requestsUsed: used + 1 },
      });
    } catch (err: any) {
      console.warn('[join-requests.service] Suppressed audit error:', err?.message || err);
    }

    try {
      if (project && (project.ownerId || (project as any).owner)) {
        const ownerTarget = String(project.ownerId || (project as any).owner);
        this.notificationsService.create({
          userId: ownerTarget,
          type: 'JOIN_REQUEST',
          priority: 'immediate',
          bypassDigest: true,
          title: 'New Join Request',
          message: `${created.userName || 'A collaborator'} applied to join "${project.title || project.name || 'your project'}".`,
          readStatus: false,
          referenceId: created.projectId,
          metadata: { projectId: created.projectId, requestId: created.id },
          link: `/owner/workspace/${created.projectId}?tab=members&section=requests`,
        });
      }
    } catch (err: any) {
      console.warn('[join-requests.service] Suppressed notification error:', err?.message || err);
    }

    return created;
  }

  private readonly projectQueues = new Map<string, Promise<any>>();

  async runInProjectQueue<T>(projectId: string, fn: () => Promise<T> | T): Promise<T> {
    const key = String(projectId);
    const prev = this.projectQueues.get(key) || Promise.resolve();
    let result: T;
    let error: any;
    const next = prev
      .catch(() => {})
      .then(async () => {
        try {
          result = await fn();
        } catch (err) {
          error = err;
        }
      });
    this.projectQueues.set(key, next);
    await next;
    if (this.projectQueues.get(key) === next) {
      this.projectQueues.delete(key);
    }
    if (error) {
      throw error;
    }
    return result!;
  }

  async update(id: string, updateJoinRequestDto: UpdateJoinRequestDto, callerUser?: any): Promise<JoinRequestEntity> {
    if (
      (updateJoinRequestDto.status as any) === 'Invited' ||
      (updateJoinRequestDto.status as any) === 'Declined'
    ) {
      throw new BadRequestException(
        "The 'Invited' and 'Declined' statuses are no longer supported. Joining is apply-only.",
      );
    }

    const currentCheck = this.findOne(id);
    if (!currentCheck) {
      throw new BadRequestException(`Join request with id ${id} not found.`);
    }

    return this.runInProjectQueue(currentCheck.projectId, async () => {
      const current = this.findOne(id);
      if (!current) {
        throw new BadRequestException(`Join request with id ${id} not found.`);
      }

      if (this.projectsService.isLocked(current.projectId)) {
        throw new BadRequestException('Project is locked. Join requests cannot be modified.');
      }

      const isApproval = (updateJoinRequestDto.status || '').toLowerCase() === 'approved';
      const isRejection = (updateJoinRequestDto.status || '').toLowerCase() === 'rejected';

      if (isApproval || isRejection) {
        const curStatus = (current.status || '').toLowerCase();
        if (curStatus !== 'pending') {
          throw new ConflictException({
            statusCode: 409,
            error: 'Conflict',
            code: 'REQUEST_ALREADY_DECIDED',
            message: 'This join request has already been decided.',
          });
        }
      }

      if ((isApproval || isRejection) && callerUser) {
        const project = this.projectsService.findById(current.projectId);
        const isOwner =
          isProjectOwner(project, callerUser) ||
          String(project.ownerId) === String(callerUser.uid || callerUser.id);
        const isAdmin = isPlatformAdminOrSuperUser(callerUser);
        if (!isOwner && !isAdmin) {
          throw new ForbiddenException({
            statusCode: 403,
            error: 'Forbidden',
            code: 'FORBIDDEN',
            message: 'Only the project owner can approve or reject join requests.',
          });
        }
      }

      // Rejection reason & feedback validation
      let rejectionReason: string | undefined;
      let feedbackReasons: string[] = [];
      let feedbackExplanation: string | undefined;
      if (isRejection) {
        let fbPayload = updateJoinRequestDto.feedback;
        if (!fbPayload) {
          if (Array.isArray(updateJoinRequestDto.reasons) && updateJoinRequestDto.reasons.length > 0) {
            fbPayload = {
              reasons: updateJoinRequestDto.reasons,
              explanation: updateJoinRequestDto.explanation,
            };
          } else if (updateJoinRequestDto.reasons && Array.isArray(updateJoinRequestDto.reasons) && updateJoinRequestDto.reasons.length === 0) {
            fbPayload = { reasons: [] };
          } else if (updateJoinRequestDto.reason || updateJoinRequestDto.rejectionReason) {
            fbPayload = {
              reasons: ['OTHER'],
              explanation: updateJoinRequestDto.reason || updateJoinRequestDto.rejectionReason,
            };
          } else {
            fbPayload = { reasons: [] };
          }
        }

        if (this.feedbackService) {
          const validated = this.feedbackService.validate('REJECT_APPLICATION', fbPayload, callerUser, current);
          rejectionReason = validated.explanation || validated.reasons.join(', ');
          feedbackReasons = validated.reasons;
          feedbackExplanation = validated.explanation;
        } else {
          const rawReason = updateJoinRequestDto.reason || updateJoinRequestDto.rejectionReason;
          const trimmed = typeof rawReason === 'string' ? rawReason.trim() : '';
          if (!trimmed || trimmed.length < 10 || trimmed.length > 500) {
            throw new BadRequestException({
              statusCode: 400,
              error: 'Bad Request',
              code: 'REASON_REQUIRED',
              message: 'A rejection reason between 10 and 500 characters is required.',
            });
          }
          rejectionReason = trimmed;
        }
      }

      if (isApproval) {
        const project = this.projectsService.findById(current.projectId);
        const existingRole = typeof this.projectsService?.getProjectRole === 'function'
          ? this.projectsService.getProjectRole(current.projectId, current.userId)
          : getProjectRole(project, current.userId);
        if (existingRole === 'Owner' || String(project?.ownerId) === String(current.userId)) {
          throw new ConflictException({
            statusCode: 409,
            error: 'Conflict',
            code: 'ALREADY_PROJECT_OWNER',
            message: 'Project owners cannot be approved as collaborators.',
          });
        }
        if (existingRole === 'Mentor') {
          throw new ConflictException({
            statusCode: 409,
            error: 'Conflict',
            code: 'ALREADY_PROJECT_MENTOR',
            message: 'The assigned mentor cannot be approved as a collaborator.',
          });
        }
        if (existingRole === 'Collaborator') {
          throw new ConflictException({
            statusCode: 409,
            error: 'Conflict',
            code: 'ALREADY_MEMBER',
            message: 'User is already an active collaborator on this project.',
          });
        }

        if (this.projectsService.isFull(project)) {
          throw new ConflictException({
            statusCode: 409,
            error: 'Conflict',
            code: 'PROJECT_FULL',
            message: 'This project is full.',
          });
        }
        if (typeof this.projectsService?.assertCanJoinProject === 'function') {
          this.projectsService.assertCanJoinProject(current.userId);
        }
        this.projectsService.addCollaborator(current.projectId, {
          id: current.userId,
          name: current.userName || 'Collaborator',
          role: current.role || 'Collaborator',
        });

        // When the last slot is filled, close remaining pending requests with status 'system_closed' (does NOT count against applicants)
        const updatedProject = this.projectsService.findById(current.projectId);
        if (this.projectsService.isFull(updatedProject)) {
          const otherPending = this.items.filter(
            (r) =>
              r.projectId === current.projectId &&
              r.id !== id &&
              String(r.status).toLowerCase() === 'pending',
          );
          const applicantNotices = new Map<string, NotificationGroupedItem[]>();
          const projLabel = project.title || project.name || 'the project';
          for (const req of otherPending) {
            req.status = 'system_closed';
            req.closureReason = 'Project is full';
            req.countedTowardLimit = false;
            req.decidedAt = this.clockService?.nowIso?.() || new Date().toISOString();
            req.updatedAt = new Date();

            const uid = String(req.userId);
            if (!applicantNotices.has(uid)) applicantNotices.set(uid, []);
            applicantNotices.get(uid)!.push({
              label: projLabel,
              link: `/projects/${current.projectId}`,
            });
          }
          for (const [uid, items] of applicantNotices.entries()) {
            try {
              dispatchGroupedNotification(
                this.notificationsService,
                uid,
                `project_full_closed:${current.projectId}`,
                items,
                (groupedItems, count) => ({
                  type: 'APPLICATION_REJECTED',
                  title: 'Project Closed',
                  message:
                    count === 1
                      ? `Your application to join "${projLabel}" was closed because the project is full. This does not count against your limit.`
                      : `${count} applications to "${projLabel}" were closed because the project is full: ${formatGroupedItemList(groupedItems, 10)}`,
                  readStatus: false,
                  referenceId: current.projectId,
                  link: `/projects/${current.projectId}`,
                }),
              );
            } catch (err: any) {
              console.warn('[join-requests.service] Suppressed notification error:', err?.message || err);
            }
          }
        }
      }

      const suggestedProjects = isRejection
        ? this.computeSuggestedProjects(String(current.userId), String(current.projectId))
        : undefined;

      const nowIso = this.clockService?.nowIso?.() || new Date().toISOString();
      const updated = this.updateSync(id, {
        ...updateJoinRequestDto,
        status: isApproval
          ? 'approved'
          : isRejection
            ? 'rejected'
            : updateJoinRequestDto.status !== undefined
              ? updateJoinRequestDto.status
              : current.status,
        rejectionReason: rejectionReason || current.rejectionReason,
        ...(isRejection ? { suggestedProjects } : {}),
        viewedAt: (isApproval || isRejection) ? (current.viewedAt || nowIso) : current.viewedAt,
        decidedAt: (isApproval || isRejection) ? nowIso : current.decidedAt,
        updatedAt: new Date(),
      } as any);

      if (isApproval || isRejection) {
        if (typeof this.projectsService?.recordOwnerAction === 'function') {
          try {
            const callerId = typeof callerUser === 'object' ? (callerUser?.uid || callerUser?.id) : callerUser;
            this.projectsService.recordOwnerAction(current.projectId, callerId ? String(callerId) : undefined, nowIso);
          } catch {}
        }
        const remainingPending = this.items.filter(
          (r) => r.projectId === current.projectId && String(r.status || '').toLowerCase() === 'pending',
        );
        if ((remainingPending.length === 0 || isApproval) && typeof this.projectsService?.clearZombiePause === 'function') {
          try {
            this.projectsService.clearZombiePause(current.projectId);
          } catch {}
        }
      }

      try {
        let projectName = 'the project';
        try {
          const p = this.projectsService.findById(current.projectId);
          if (p) projectName = p.title || p.name || 'the project';
        } catch (err: any) {
          console.warn('[join-requests.service] Suppressed error:', err?.message || err);
        }

        if (isApproval) {
          this.auditService.log({
            action: 'join-request-approved',
            actor: 'Owner',
            target: current.userName || `User #${current.userId}`,
            entityType: 'join_request',
            entityId: id,
            event: `Join request for ${current.userName || 'User'} approved in project #${current.projectId}`,
            details: { status: 'approved' },
          });

          this.notificationsService.create({
            userId: String(current.userId),
            type: 'APPLICATION_APPROVED',
            title: 'Application Approved',
            message: `Your application to join "${projectName}" was approved! Welcome to the team.`,
            readStatus: false,
            referenceId: current.projectId,
            link: `/collaborator/workspace/${current.projectId}`,
          });
        } else if (isRejection) {
          if (this.feedbackService && feedbackReasons.length > 0) {
            try {
              const callerId = typeof callerUser === 'object' ? (callerUser?.uid || callerUser?.id) : callerUser;
              this.feedbackService.record({
                actionType: 'REJECT_APPLICATION',
                entityType: 'APPLICATION',
                entityId: id,
                projectId: current.projectId,
                actorUserId: callerId ? String(callerId) : 'Owner',
                targetUserId: String(current.userId),
                reasons: feedbackReasons,
                explanation: feedbackExplanation,
              });
            } catch (err: any) {
              console.warn('[join-requests.service] Suppressed feedback record error:', err?.message || err);
            }
          }

          this.auditService.log({
            action: 'join-request-rejected',
            actor: 'Owner',
            target: current.userName || `User #${current.userId}`,
            entityType: 'join_request',
            entityId: id,
            event: `Join request for ${current.userName || 'User'} declined in project #${current.projectId}: ${rejectionReason}`,
            details: { status: 'rejected', reason: rejectionReason, reasons: feedbackReasons },
          });

          this.notificationsService.create({
            userId: String(current.userId),
            type: 'APPLICATION_REJECTED',
            title: 'Application Declined',
            message: `Your application to join "${projectName}" was declined. Reason: ${rejectionReason}`,
            readStatus: false,
            referenceId: current.projectId,
            link: `/applied-projects`,
            suggestedProjects: suggestedProjects || [],
            metadata: {
              rejectionReason,
              reasons: feedbackReasons,
              explanation: feedbackExplanation,
              suggestedProjects: suggestedProjects || [],
            },
          });
        }
      } catch (err: any) {
        console.warn('[join-requests.service] Suppressed notification/audit error:', err?.message || err);
      }

      return updated;
    });
  }

  findByProject(projectId: string): JoinRequestEntity[] {
    return this.items.filter((request: JoinRequestEntity) => request.projectId === projectId);
  }

  hasPendingApplication(projectId: string, userId: string): boolean {
    return this.items.some(
      (r) =>
        String(r.projectId) === String(projectId) &&
        String(r.userId) === String(userId) &&
        String(r.status || '').toLowerCase() === 'pending',
    );
  }

  hasOpenItemBetween(projectId: string, userId: string): boolean {
    const hasApp = this.hasPendingApplication(projectId, userId);
    const hasInv = Boolean(this.projectInvitesService?.hasPendingInvite?.(projectId, userId));
    return hasApp || hasInv;
  }

  findByProjectDetailed(projectId: string, statusFilter?: string): any[] {
    const pid = String(projectId);
    let project: any;
    try {
      project = this.projectsService?.findById?.(pid);
    } catch {}

    const projectSkills = project?.requiredSkills || project?.skills || [];
    const normalizedFilter = statusFilter ? statusFilter.toLowerCase().trim() : undefined;

    const matchedRequests = this.items.filter((r) => String(r.projectId) === pid);

    const mappedApplications = matchedRequests.map((r) => {
      let rawUser: any = null;
      if (this.usersService) {
        try {
          rawUser =
            typeof (this.usersService as any).findRawUserById === 'function'
              ? (this.usersService as any).findRawUserById(String(r.userId))
              : this.usersService.findById?.(String(r.userId));
        } catch {}
      }

      const applicantName = r.userName || rawUser?.name || rawUser?.profile?.fullName || 'Applicant';
      const username = rawUser?.username || rawUser?.profile?.username || '';
      const userSkills = rawUser?.skills || rawUser?.profile?.skills || rawUser?.data?.skills || [];
      const match = computeSkillMatch(userSkills, projectSkills);

      const statusLower = String(r.status || '').toLowerCase().trim();
      let filterGroup: 'Pending' | 'Approved' | 'Rejected' | 'All' = 'All';
      if (statusLower === 'pending') {
        filterGroup = 'Pending';
      } else if (statusLower === 'approved') {
        filterGroup = 'Approved';
      } else if (statusLower === 'rejected') {
        filterGroup = 'Rejected';
      }

      return {
        id: r.id,
        projectId: r.projectId,
        userId: r.userId,
        type: 'Applied',
        filterGroup,
        name: applicantName,
        userName: applicantName,
        applicantName,
        username,
        applicantUsername: username,
        role: r.role || 'Collaborator',
        status: r.status,
        message: r.message,
        date: r.sentAt || r.createdAt,
        sentAt: r.sentAt || r.createdAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        decidedAt: r.decidedAt,
        viewedAt: r.viewedAt || null,
        rejectionReason: r.rejectionReason,
        closureReason: (r as any).closureReason,
        countedTowardLimit: r.countedTowardLimit,
        feedbackHistory: this.feedbackService?.findByEntity('APPLICATION', r.id) || [],
        skillMatch: {
          percent: match.percent ?? 0,
          shared: match.shared || [],
          missing: match.missing || [],
        },
        skills: userSkills,
        university: rawUser?.university || '',
        avatar: rawUser?.avatar || (applicantName ? applicantName.charAt(0).toUpperCase() : 'A'),
      };
    });

    // Project Invites (Invited)
    const rawInvites: any[] = this.projectInvitesService
      ? (typeof this.projectInvitesService.findByProjectId === 'function'
          ? this.projectInvitesService.findByProjectId(pid)
          : (this.projectInvitesService as any).invites?.filter((inv: any) => String(inv.projectId) === pid) || [])
      : [];

    const mappedInvites = rawInvites.map((inv: any) => {
      let rawUser: any = null;
      if (this.usersService && inv.invitedUserId) {
        try {
          rawUser =
            typeof (this.usersService as any).findRawUserById === 'function'
              ? (this.usersService as any).findRawUserById(String(inv.invitedUserId))
              : this.usersService.findById?.(String(inv.invitedUserId));
        } catch {}
      }

      const inviteeName = inv.invitedUserName || rawUser?.name || rawUser?.profile?.fullName || inv.invitedUsername || 'Invited Collaborator';
      const username = inv.invitedUsername || rawUser?.username || rawUser?.profile?.username || '';
      const userSkills = rawUser?.skills || rawUser?.profile?.skills || rawUser?.data?.skills || [];
      const match = computeSkillMatch(userSkills, projectSkills);

      const statusLower = String(inv.status || '').toLowerCase().trim();
      let filterGroup: 'Pending' | 'Approved' | 'Rejected' | 'All' = 'All';
      let normalizedStatus = inv.status;
      if (statusLower === 'pending') {
        filterGroup = 'Pending';
        normalizedStatus = 'Pending';
      } else if (statusLower === 'accepted') {
        filterGroup = 'Approved';
        normalizedStatus = 'Accepted';
      } else if (statusLower === 'declined') {
        filterGroup = 'Rejected';
        normalizedStatus = 'Declined';
      } else if (statusLower === 'cancelled') {
        normalizedStatus = 'Cancelled';
      } else if (statusLower === 'expired') {
        normalizedStatus = 'Expired';
      }

      return {
        id: inv.id,
        projectId: inv.projectId,
        userId: inv.invitedUserId,
        type: 'Invited',
        filterGroup,
        name: inviteeName,
        userName: inviteeName,
        applicantName: inviteeName,
        username,
        applicantUsername: username,
        role: 'Collaborator',
        status: normalizedStatus,
        rawStatus: inv.status,
        message: inv.message || 'Direct invitation to join project',
        date: inv.createdAt,
        sentAt: inv.createdAt,
        createdAt: inv.createdAt,
        updatedAt: inv.respondedAt || inv.createdAt,
        decidedAt: inv.respondedAt,
        viewedAt: null,
        rejectionReason: undefined,
        closureReason: undefined,
        feedbackHistory: this.feedbackService?.findByEntity('INVITE', inv.id) || [],
        skillMatch: {
          percent: match.percent ?? 0,
          shared: match.shared || [],
          missing: match.missing || [],
        },
        skills: userSkills,
        university: rawUser?.university || '',
        avatar: rawUser?.avatar || (inviteeName ? inviteeName.charAt(0).toUpperCase() : 'A'),
      };
    });

    const combined = [...mappedApplications, ...mappedInvites];
    combined.sort((a, b) => {
      const dateA = new Date(a.date || a.createdAt || 0).getTime();
      const dateB = new Date(b.date || b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    if (normalizedFilter && normalizedFilter !== 'all') {
      return combined.filter((item) => {
        const fgLower = item.filterGroup.toLowerCase();
        const stLower = String(item.status || '').toLowerCase();
        const rawLower = String((item as any).rawStatus || '').toLowerCase();
        return fgLower === normalizedFilter || stLower === normalizedFilter || rawLower === normalizedFilter;
      });
    }

    return combined;
  }

  findForCaller(callerId?: string): any[] {
    if (!callerId) return this.findAll();
    const uid = String(callerId);
    return this.items.filter((r) => {
      if (String(r.userId) === uid) return true;
      try {
        const p = this.projectsService?.findById?.(r.projectId);
        if (p && String(p.ownerId) === uid) return true;
      } catch {}
      return false;
    });
  }

  findByUser(userId: string): JoinRequestEntity[] {
    return this.items.filter((request: JoinRequestEntity) => request.userId === userId);
  }

  findByStatus(status: string): JoinRequestEntity[] {
    return this.items.filter(
      (request: JoinRequestEntity) =>
        String(request.status).toLowerCase() === String(status).toLowerCase(),
    );
  }

  approveRequest(id: string): Promise<JoinRequestEntity> {
    return this.update(id, { status: 'approved' });
  }

  rejectRequest(id: string, reason = 'Application declined by project owner'): Promise<JoinRequestEntity> {
    return this.update(id, { status: 'rejected', reason });
  }

  completeApprovedRequests(projectId: string): void {
    const approved = this.items.filter(
      (r) =>
        r.projectId === projectId &&
        String(r.status || '').toLowerCase() === 'approved',
    );
    for (const req of approved) {
      req.status = 'completed';
      req.updatedAt = new Date();
    }
  }

  markUserRemoved(projectId: string, userId: string, reason: string): void {
    const userReqs = this.items.filter(
      (r) =>
        r.projectId === projectId &&
        (String(r.userId) === String(userId) ||
          (r.userName && r.userName.toLowerCase() === String(userId).toLowerCase())),
    );
    for (const req of userReqs) {
      req.status = 'removed';
      (req as any).removalReason = reason;
      req.updatedAt = new Date();
    }
  }

  markUserLeft(projectId: string, userId: string): void {
    const userReqs = this.items.filter(
      (r) =>
        r.projectId === projectId &&
        (String(r.userId) === String(userId) || r.userName === userId),
    );
    for (const req of userReqs) {
      req.status = 'left';
      req.updatedAt = new Date();
    }
  }

  closePendingRequestsForProject(projectId: string, reason: string): number {
    return this.closePendingRequestsDetailed(projectId, reason).count;
  }

  closePendingRequestsDetailed(
    projectId: string,
    reason: string,
  ): { count: number; items: NotificationGroupedItem[] } {
    const pending = this.items.filter(
      (r) =>
        r.projectId === projectId &&
        String(r.status || '').toLowerCase() === 'pending',
    );
    const now = this.clockService?.now() || new Date();
    const nowIso = now.toISOString();
    let projectTitle = `Project ${projectId}`;
    try {
      const p = this.projectsService?.findById?.(projectId);
      if (p) projectTitle = p.title || p.name || projectTitle;
    } catch {}

    const byApplicant = new Map<string, NotificationGroupedItem[]>();
    const closedItemsForOwner: NotificationGroupedItem[] = [];

    for (const req of pending) {
      req.status = 'system_closed';
      (req as any).closureReason = reason;
      req.countedTowardLimit = false;
      req.decidedAt = nowIso;
      req.updatedAt = now;

      const uid = String(req.userId);
      if (!byApplicant.has(uid)) byApplicant.set(uid, []);
      byApplicant.get(uid)!.push({
        label: projectTitle,
        link: `/projects/${projectId}`,
      });
      closedItemsForOwner.push({
        label: req.userName ? `Request from ${req.userName}` : `Join request #${req.id}`,
        link: `/owner/workspace/${projectId}`,
      });
    }

    for (const [applicantId, items] of byApplicant.entries()) {
      try {
        dispatchGroupedNotification(
          this.notificationsService,
          applicantId,
          `join_requests_closed:${projectId}`,
          items,
          (groupedItems, count) => ({
            type: 'PROJECT_CLOSED',
            priority: 'immediate',
            title: count > 1 ? `Join Requests Closed (${count})` : 'Join Request Closed',
            message:
              count === 1
                ? `Your application to "${projectTitle}" was closed by the system: ${reason}. This does not count against your application limit.`
                : `${count} applications to "${projectTitle}" were closed (${reason}): ${formatGroupedItemList(groupedItems, 10)}`,
            readStatus: false,
            referenceId: projectId,
            link: `/projects/${projectId}`,
          }),
        );
      } catch (err: any) {
        console.warn('[join-requests.service] Suppressed notification error:', err?.message || err);
      }
    }

    return { count: pending.length, items: closedItemsForOwner };
  }

  /**
   * Records viewedAt timestamp when the project owner opens the request list for a project.
   */
  markViewedForProject(projectId: string, viewerUserId?: string): void {
    if (!projectId || !viewerUserId) return;
    let project: any;
    try {
      project = this.projectsService.findById(projectId);
    } catch {
      return;
    }
    if (!project || String(project.ownerId) !== String(viewerUserId)) {
      return;
    }
    const nowIso = this.clockService?.nowIso?.() || new Date().toISOString();
    for (const req of this.items) {
      if (
        String(req.projectId) === String(projectId) &&
        String(req.status || '').toLowerCase() === 'pending' &&
        !req.viewedAt
      ) {
        req.viewedAt = nowIso;
      }
    }
  }

  markViewedSingle(id: string, viewerUserId?: string): void {
    if (!id || !viewerUserId) return;
    const req = this.findOne(id);
    if (!req || String(req.status || '').toLowerCase() !== 'pending' || req.viewedAt) {
      return;
    }
    try {
      const project = this.projectsService.findById(req.projectId);
      if (project && String(project.ownerId) === String(viewerUserId)) {
        req.viewedAt = this.clockService?.nowIso?.() || new Date().toISOString();
      }
    } catch {}
  }

  /**
   * Early-withdraw refund eligibility: within 2 hours of sending AND viewedAt empty AND still pending.
   */
  isEarlyWithdrawEligible(req: JoinRequestEntity, nowMs?: number): boolean {
    if (!req || String(req.status || '').toLowerCase() !== 'pending') {
      return false;
    }
    if (req.viewedAt) {
      return false;
    }
    const sentMs = new Date((req.sentAt || req.createdAt || 0) as any).getTime();
    if (isNaN(sentMs) || sentMs <= 0) {
      return false;
    }
    const currentMs = nowMs ?? (this.clockService?.now()?.getTime() || Date.now());
    const elapsedMs = currentMs - sentMs;
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
    return elapsedMs >= 0 && elapsedMs <= TWO_HOURS_MS;
  }

  /**
   * Withdraws a request: sets status to 'withdrawn'.
   * Policy Rule (Phase 12): Withdrawing within 2 hours before owner opens/decides restores the slot
   * (countedTowardLimit = false); later or viewed withdrawals still count toward the 2-request limit.
   */
  withdrawRequest(
    id: string,
    callerUserId?: string,
    callerRole?: string,
    feedbackPayload?: { reasons?: string[]; explanation?: string },
  ): { withdrawn: boolean; slotRestored: boolean; countedTowardLimit: boolean; requestsUsed: number; requestsLeft: number; feedback?: any } {
    const current = this.findOne(id);
    if (!current) {
      return { withdrawn: false, slotRestored: false, countedTowardLimit: true, requestsUsed: 0, requestsLeft: 2 };
    }
    if (callerUserId) {
      const isOwnerOfReq = String(current.userId) === String(callerUserId);
      const isAdmin = isPlatformAdminOrSuperUser({ uid: callerUserId, id: callerUserId, role: callerRole });
      if (!isOwnerOfReq && !isAdmin) {
        throw new ForbiddenException('You can only withdraw your own join request.');
      }
    }
    if (this.projectsService.isLocked(current.projectId)) {
      throw new BadRequestException('Project is locked. Join requests cannot be withdrawn.');
    }
    if (String(current.status || '').toLowerCase() !== 'pending') {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'REQUEST_ALREADY_DECIDED',
        message: 'Only pending join requests can be withdrawn.',
      });
    }

    let feedbackRecord: any;
    if (this.feedbackService) {
      const fb = feedbackPayload || { reasons: ['OTHER'], explanation: 'Withdrawn by applicant' };
      const validated = this.feedbackService.validate('WITHDRAW_APPLICATION', fb, callerUserId, current);
      let targetOwnerId: string | undefined;
      try {
        const proj = this.projectsService?.findById?.(current.projectId);
        if (proj?.ownerId) targetOwnerId = String(proj.ownerId);
      } catch {}
      feedbackRecord = this.feedbackService.record({
        actionType: 'WITHDRAW_APPLICATION',
        entityType: 'APPLICATION',
        entityId: id,
        projectId: current.projectId,
        actorUserId: String(callerUserId || current.userId),
        targetUserId: targetOwnerId,
        reasons: validated.reasons,
        explanation: validated.explanation,
      });
    }

    const now = this.clockService?.now() || new Date();
    const nowIso = now.toISOString();
    const slotRestored = this.isEarlyWithdrawEligible(current, now.getTime());

    current.status = 'withdrawn';
    current.countedTowardLimit = !slotRestored;
    current.decidedAt = nowIso;
    current.updatedAt = now;

    const used = this.requestsUsed(current.userId, current.projectId);
    const left = Math.max(0, 2 - used);

    try {
      this.auditService.log({
        action: 'join-request-withdrawn',
        actor: current.userName || current.userId,
        target: `Project #${current.projectId}`,
        entityType: 'join_request',
        entityId: current.id,
        event: `${current.userName || 'User'} withdrew join request for project #${current.projectId} (slotRestored=${slotRestored})`,
        details: { slotRestored, countedTowardLimit: current.countedTowardLimit, requestsUsed: used },
      });
    } catch {}

    try {
      this.notificationsService.create({
        userId: String(current.userId),
        type: 'JOIN_REQUEST_WITHDRAWN',
        title: 'Join Request Withdrawn',
        message: slotRestored
          ? `Your pending request was withdrawn within 2 hours before review. Your application slot has been restored (${left}/2 remaining).`
          : `Your pending request was withdrawn. Because ${current.viewedAt ? 'the owner already viewed it' : 'more than 2 hours had elapsed'}, it still counts toward your 2-request limit (${left}/2 remaining).`,
        readStatus: false,
        referenceId: current.projectId,
        link: `/projects/${current.projectId}`,
      });
    } catch {}

    return {
      withdrawn: true,
      slotRestored,
      countedTowardLimit: Boolean(current.countedTowardLimit),
      requestsUsed: used,
      requestsLeft: left,
      feedback: feedbackRecord,
    };
  }

  override remove(id: string): void {
    this.withdrawRequest(id);
  }

  async withdrawAsync(
    id: string,
    callerUserId?: string,
    callerRole?: string,
    feedbackPayload?: { reasons?: string[]; explanation?: string },
  ): Promise<{ withdrawn: boolean; slotRestored: boolean; countedTowardLimit: boolean; requestsUsed: number; requestsLeft: number; feedback?: any }> {
    const current = this.findOne(id);
    if (!current) {
      return { withdrawn: false, slotRestored: false, countedTowardLimit: true, requestsUsed: 0, requestsLeft: 2 };
    }
    return this.runInProjectQueue(current.projectId, async () => {
      return this.withdrawRequest(id, callerUserId, callerRole, feedbackPayload);
    });
  }

  findMyRequests(userId: string): any[] {
    const userReqs = this.items.filter((r) => String(r.userId) === String(userId));
    return userReqs.map((r) => {
      let projectTitle = 'Project';
      let projectStatus = 'Open';
      let ownerName = 'Project Owner';
      let projectDueDate: any;
      try {
        const p = this.projectsService.findById(r.projectId);
        if (p) {
          projectTitle = p.title || p.name || 'Project';
          projectStatus = p.status || 'Open';
          ownerName = p.owner || 'Project Owner';
          projectDueDate = p.dueDate;
        }
      } catch {}

      const used = this.requestsUsed(userId, r.projectId);
      const left = Math.max(0, 2 - used);

      return {
        id: r.id,
        projectId: r.projectId,
        project: projectTitle,
        projectTitle,
        projectStatus,
        projectDueDate,
        owner: ownerName,
        userId: r.userId,
        userName: r.userName,
        status: r.status,
        message: r.message,
        rejectionReason: r.rejectionReason,
        closureReason: (r as any).closureReason,
        sentAt: r.sentAt || r.createdAt,
        viewedAt: r.viewedAt || null,
        countedTowardLimit: r.countedTowardLimit !== false && String(r.status || '').toLowerCase() !== 'system_closed',
        earlyWithdrawEligible: this.isEarlyWithdrawEligible(r),
        feedbackHistory: this.feedbackService?.findByEntity('APPLICATION', r.id) || [],
        requestsUsed: used,
        requestsLeft: left,
        suggestedProjects: (r as any).suggestedProjects || [],
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        decidedAt: r.decidedAt,
      };
    });
  }

  /**
   * Computes up to 3 open non-full non-closed projects matching the applicant's skills,
   * excluding projects owned by, already joined/removed from, or already applied to by the user.
   */
  computeSuggestedProjects(userId: string, rejectedProjectId: string): Array<{
    id: string;
    title: string;
    description: string;
    requiredSkills: string[];
    ownerId: string;
    owner: string;
    percent: number;
    shared: string[];
    missing: string[];
  }> {
    const uid = String(userId || '').trim();
    if (!uid || typeof this.projectsService?.findAll !== 'function') return [];

    let applicantUser: any = null;
    if (this.usersService) {
      try {
        applicantUser =
          typeof this.usersService.findRawUserById === 'function'
            ? this.usersService.findRawUserById(uid)
            : this.usersService.findById?.(uid);
      } catch {}
    }
    const rawUserSkills =
      applicantUser?.skills ||
      applicantUser?.profile?.skills ||
      applicantUser?.data?.skills ||
      [];
    if (normalizeSkills(rawUserSkills).length === 0) {
      return [];
    }

    const appliedProjectIds = new Set(
      this.items
        .filter((r) => {
          if (String(r.userId) !== uid) return false;
          const st = String(r.status || '').toLowerCase();
          return st !== 'withdrawn' && st !== 'system_closed';
        })
        .map((r) => String(r.projectId)),
    );

    const openProjects: any[] = this.projectsService.findAll() || [];
    const candidates: Array<{
      id: string;
      title: string;
      description: string;
      requiredSkills: string[];
      ownerId: string;
      owner: string;
      percent: number;
      shared: string[];
      missing: string[];
    }> = [];

    for (const p of openProjects) {
      if (!p) continue;
      const pid = String(p.id);
      if (pid === String(rejectedProjectId)) continue;
      if (String(p.ownerId) === uid) continue;
      if (appliedProjectIds.has(pid)) continue;

      const st = String(p.status || '').toLowerCase().trim();
      if (p.isCompleted || st === 'closed' || st === 'completed' || st === 'cancelled') {
        continue;
      }
      if (this.projectsService.isFull?.(p)) continue;

      const collabs = Array.isArray(p.collaborators) ? p.collaborators : [];
      const isMember = collabs.some((c: any) =>
        typeof c === 'string' ? String(c) === uid : String(c?.id || c?.userId || '') === uid,
      );
      if (isMember) continue;

      const removed = Array.isArray(p.removedUsers) ? p.removedUsers : [];
      if (removed.some((r: any) => String(r?.userId || r?.id || '') === uid)) continue;

      const projSkills = Array.isArray(p.requiredSkills) && p.requiredSkills.length > 0
        ? p.requiredSkills
        : p.skills || [];
      const match = computeSkillMatch(rawUserSkills, projSkills);
      if (match.percent === null || match.shared.length === 0) continue;

      candidates.push({
        id: pid,
        title: p.title || p.name || pid,
        description: p.description || p.desc || '',
        requiredSkills: Array.isArray(projSkills) ? projSkills : [],
        ownerId: String(p.ownerId || ''),
        owner: p.owner || 'Project Owner',
        percent: match.percent,
        shared: match.shared,
        missing: match.missing,
      });
    }

    candidates.sort((a, b) => {
      if (b.percent !== a.percent) return b.percent - a.percent;
      if (b.shared.length !== a.shared.length) return b.shared.length - a.shared.length;
      return a.id.localeCompare(b.id);
    });

    return candidates.slice(0, 3);
  }

  /**
   * Release all join requests tied to a deleted account:
   * - Pending requests are closed as system_closed (never counted against applicant).
   * - Approved requests transition to 'left' so project seat counters and UI members lists clear immediately.
   * - All requests by the deleted user are anonymized to "Deleted user".
   */
  anonymizeUser(userId: string, anonymizedId: string): number {
    const res = this.releaseForDeletedUser(userId, anonymizedId);
    return res.totalTouched;
  }

  releaseForDeletedUser(
    userId: string,
    anonymizedId: string,
  ): { totalTouched: number; closedPendingCount: number; releasedApprovedCount: number } {
    const uid = String(userId || '');
    const now = this.clockService ? this.clockService.now() : new Date();
    const nowIso = now.toISOString();
    let totalTouched = 0;
    let closedPendingCount = 0;
    let releasedApprovedCount = 0;

    for (const req of this.items) {
      if (String(req.userId) === uid) {
        const statusLower = String(req.status || '').toLowerCase().trim();
        if (statusLower === 'pending') {
          (req as any).status = 'system_closed';
          (req as any).closureReason = 'Closed because applicant account was deleted';
          (req as any).countedTowardLimit = false;
          (req as any).decidedAt = nowIso;
          (req as any).updatedAt = now;
          closedPendingCount += 1;
        } else if (statusLower === 'approved') {
          (req as any).status = 'left';
          (req as any).closureReason = 'Collaborator account deleted';
          (req as any).leftAt = nowIso;
          (req as any).updatedAt = now;
          releasedApprovedCount += 1;
        }

        (req as any).userName = 'Deleted user';
        (req as any).email = `${anonymizedId}@deleted.local`;
        (req as any).userIsDeleted = true;
        totalTouched += 1;
      }
    }
    return { totalTouched, closedPendingCount, releasedApprovedCount };
  }

  /**
   * Calculates median response time for an owner over the last 10 decided join requests
   * to preserve "usually replies in N days" functionality.
   */
  public computeOwnerResponseTime(ownerId: string): { medianHours: number | null; sample: number } {
    const ownerIdStr = String(ownerId || '').trim();
    if (!ownerIdStr) {
      return { medianHours: null, sample: 0 };
    }

    const allProjects = (typeof this.projectsService?.findAll === 'function'
      ? this.projectsService.findAll(true)
      : []) || [];
    const ownedProjectIds = new Set(
      allProjects
        .filter((p: any) => String(p.ownerId || p.owner) === ownerIdStr)
        .map((p: any) => String(p.id)),
    );

    const allRequests = typeof this.findAll === 'function'
      ? this.findAll()
      : ((this as any).items || []);

    const ownerRequests = allRequests.filter(
      (r: any) => ownedProjectIds.has(String(r.projectId)) || String(r.projectOwnerId) === ownerIdStr,
    );

    // Filter decided requests
    const decided = ownerRequests.filter((r: any) => {
      const s = String(r.status || '').toLowerCase();
      return (s === 'approved' || s === 'accepted' || s === 'rejected') && (r.decidedAt || r.updatedAt);
    });

    // Sort by decision time descending (newest decisions first)
    decided.sort((a: any, b: any) => {
      const timeA = new Date(a.decidedAt || a.updatedAt).getTime();
      const timeB = new Date(b.decidedAt || b.updatedAt).getTime();
      return timeB - timeA;
    });

    const recentDecided = decided.slice(0, 10);
    if (recentDecided.length === 0) {
      return { medianHours: null, sample: 0 };
    }

    const hoursList: number[] = recentDecided.map((r: any) => {
      const createdTime = new Date(r.createdAt || 0).getTime();
      const decidedTime = new Date(r.decidedAt || r.updatedAt || 0).getTime();
      if (isNaN(createdTime) || isNaN(decidedTime) || decidedTime < createdTime) {
        return 0;
      }
      return (decidedTime - createdTime) / (1000 * 60 * 60);
    });

    hoursList.sort((a, b) => a - b);
    const mid = Math.floor(hoursList.length / 2);
    let median = 0;
    if (hoursList.length % 2 === 1) {
      median = hoursList[mid];
    } else {
      median = (hoursList[mid - 1] + hoursList[mid]) / 2;
    }

    return {
      medianHours: Number(median.toFixed(1)),
      sample: hoursList.length,
    };
  }
}
