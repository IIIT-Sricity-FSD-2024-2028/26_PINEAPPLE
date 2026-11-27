import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
  Optional,
} from '@nestjs/common';
import { LeaveRequestsRepository, LeaveRequest } from './leave-requests.repository';
import { ProjectsRepository, Project } from './projects.repository';
import { ProjectsService, isProjectOwner } from './projects.service';
import { TasksRepository } from '../tasks/tasks.repository';
import { UsersRepository } from '../users/users.repository';
import { NotificationsService } from '../notifications/notifications.service';
import { ClockService } from '../common/services/clock.service';
import { normalizeRole } from '../common/utils/role.util';

export const LEAVE_REQUEST_COOLDOWN_HOURS = 24;
export const LEAVE_REQUEST_REMINDER_HOURS = 72; // 3 days
export const LEAVE_REQUEST_AUTO_APPROVE_HOURS = 168; // 7 days

export interface LeaveRequestDto {
  reasons: string[];
  explanation?: string;
  category?: string;
}

export interface RejectLeaveRequestDto {
  reasons: string[];
  explanation: string;
}

@Injectable()
export class LeaveRequestsService {
  constructor(
    private readonly leaveRequestsRepo: LeaveRequestsRepository,
    private readonly projectsRepo: ProjectsRepository,
    @Inject(forwardRef(() => ProjectsService))
    private readonly projectsService: ProjectsService,
    private readonly tasksRepo: TasksRepository,
    private readonly notificationsService: NotificationsService,
    @Optional() private readonly usersRepo?: UsersRepository,
    @Optional() private readonly clockService?: ClockService,
  ) {}

  private nowMs(): number {
    return this.clockService ? this.clockService.now().getTime() : Date.now();
  }

  private nowIso(): string {
    return this.clockService ? this.clockService.nowIso() : new Date().toISOString();
  }

  async createRequest(projectId: string, userId: string, dto: LeaveRequestDto): Promise<LeaveRequest> {
    const project = this.projectsRepo.findById(projectId);
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found.`);
    }

    const projStatus = String(project.status || '').toLowerCase().trim();
    if (
      project.isCompleted === true ||
      projStatus === 'completed' ||
      projStatus === 'closed' ||
      projStatus === 'cancelled' ||
      (project as any).isDeleted === true ||
      Boolean((project as any).deletedAt)
    ) {
      throw new HttpException(
        {
          statusCode: HttpStatus.CONFLICT,
          error: 'Conflict',
          code: 'PROJECT_LOCKED',
          message: 'Project is locked. Members cannot leave a completed or closed project.',
        },
        HttpStatus.CONFLICT,
      );
    }

    const userForCheck = { uid: userId, id: userId };
    const isOwner = isProjectOwner(project, userForCheck) || String(project.ownerId) === String(userId);
    if (isOwner) {
      throw new HttpException(
        {
          statusCode: HttpStatus.FORBIDDEN,
          error: 'Forbidden',
          code: 'OWNER_CANNOT_LEAVE',
          message: 'Project owner cannot leave their own project.',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    const isMentor =
      (project.mentorId && String(project.mentorId) === String(userId)) ||
      (project.mentor && String(project.mentor) === String(userId));
    if (isMentor) {
      throw new HttpException(
        {
          statusCode: HttpStatus.FORBIDDEN,
          error: 'Forbidden',
          code: 'MENTOR_CANNOT_LEAVE',
          message: 'A mentor cannot leave or be removed once a project has started.',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    // Check membership
    const rawCollabs = Array.isArray(project.collaborators) ? project.collaborators : [];
    const isMember = rawCollabs.some((c: any) =>
      (typeof c === 'string' && (c === userId || c.toLowerCase() === userId.toLowerCase())) ||
      (typeof c === 'object' &&
        (String(c.id || c.userId) === String(userId) ||
          (c.name && c.name.toLowerCase() === userId.toLowerCase()))),
    );

    if (!isMember) {
      throw new HttpException(
        {
          statusCode: HttpStatus.FORBIDDEN,
          error: 'Forbidden',
          code: 'NOT_A_MEMBER',
          message: 'You are not a member of this project.',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    // Check existing pending request
    const pending = this.leaveRequestsRepo.findPendingByProjectAndUser(projectId, userId);
    if (pending) {
      throw new HttpException(
        {
          statusCode: HttpStatus.CONFLICT,
          error: 'Conflict',
          code: 'LEAVE_REQUEST_PENDING',
          message: 'You already have a pending leave request for this project.',
        },
        HttpStatus.CONFLICT,
      );
    }

    // Check cooldown from last rejection (24 hours)
    const latest = this.leaveRequestsRepo.findLatestByProjectAndUser(projectId, userId);
    if (latest && latest.status === 'rejected' && latest.decidedAt) {
      const decidedAtMs = new Date(latest.decidedAt).getTime();
      const diffMs = this.nowMs() - decidedAtMs;
      const cooldownMs = LEAVE_REQUEST_COOLDOWN_HOURS * 60 * 60 * 1000;
      if (diffMs < cooldownMs) {
        const remainingMs = cooldownMs - diffMs;
        const remainingHours = Math.max(1, Math.ceil(remainingMs / (60 * 60 * 1000)));
        const retryAt = new Date(decidedAtMs + cooldownMs).toISOString();
        throw new HttpException(
          {
            statusCode: HttpStatus.CONFLICT,
            error: 'Conflict',
            code: 'LEAVE_REQUEST_COOLDOWN',
            message: `You cannot submit another leave request yet. Cooldown active for ${remainingHours} hours.`,
            retryAfterHours: remainingHours,
            retryAt,
          },
          HttpStatus.CONFLICT,
        );
      }
    }

    // Validate reasons
    const reasons = Array.isArray(dto?.reasons) ? dto.reasons : [];
    const explanation = (dto?.explanation || '').trim();

    if (reasons.length === 0) {
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          code: 'REASON_REQUIRED',
          message: 'At least one reason must be selected.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (reasons.includes('OTHER') && (!explanation || explanation.length < 10)) {
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          code: 'REASON_REQUIRED',
          message: 'An explanation of at least 10 characters is required when Other is selected.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (explanation.length > 500) {
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          code: 'REASON_TOO_LONG',
          message: 'Explanation must not exceed 500 characters.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const user = this.usersRepo?.findById(userId);
    const userName = user?.name || user?.username || userId;
    const userAvatar = (user as any)?.avatarUrl || user?.avatar || (user?.profile as any)?.avatarUrl || (user?.profile as any)?.avatar;

    const request = this.leaveRequestsRepo.create({
      projectId,
      userId,
      userName,
      userAvatar,
      reasons,
      explanation,
      status: 'pending',
    });

    // Notify project owner
    try {
      const projectTitle = project.title || project.name || `Project ${projectId}`;
      this.notificationsService.create({
        userId: String(project.ownerId),
        type: 'LEAVE_REQUEST_SUBMITTED',
        title: 'Leave request submitted',
        message: `${userName} has requested to leave "${projectTitle}".`,
        readStatus: false,
        referenceId: projectId,
        link: `/owner/workspace/${projectId}`,
      });
    } catch (err: any) {
      console.warn('[LeaveRequestsService] Failed to notify owner:', err?.message || err);
    }

    return request;
  }

  async withdrawRequest(projectId: string, userId: string): Promise<{ success: boolean; message: string }> {
    const pending = this.leaveRequestsRepo.findPendingByProjectAndUser(projectId, userId);
    if (!pending) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        code: 'LEAVE_REQUEST_NOT_FOUND',
        message: 'No pending leave request found to withdraw.',
      });
    }

    this.leaveRequestsRepo.update(pending.id, {
      status: 'withdrawn',
      decidedAt: this.nowIso(),
      decidedBy: userId,
    });

    return {
      success: true,
      message: 'Leave request successfully withdrawn.',
    };
  }

  async getMyRequest(projectId: string, userId: string): Promise<LeaveRequest | null> {
    const pending = this.leaveRequestsRepo.findPendingByProjectAndUser(projectId, userId);
    if (pending) return pending;
    return this.leaveRequestsRepo.findLatestByProjectAndUser(projectId, userId) || null;
  }

  async listRequestsForProject(projectId: string, callerUserId: string, callerRole?: string): Promise<any[]> {
    const project = this.projectsRepo.findById(projectId);
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found.`);
    }

    const userForCheck = { uid: callerUserId, id: callerUserId };
    const isOwner = isProjectOwner(project, userForCheck) || String(project.ownerId) === String(callerUserId);
    const normRole = normalizeRole(callerRole);
    const isAdmin = ['admin', 'superuser', 'administrator'].includes(normRole);

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'FORBIDDEN',
        message: 'Only the project owner can view leave requests.',
      });
    }

    const requests = this.leaveRequestsRepo.findByProjectId(projectId);
    const allProjectTasks = this.tasksRepo.findAllByProjectId(projectId) || [];

    return requests.map((req) => {
      const user = this.usersRepo?.findById(req.userId);
      const userTasks = allProjectTasks.filter(
        (t) => String(t.assigneeId || t.assignedTo || '') === String(req.userId),
      );

      let open = 0;
      let inProgress = 0;
      let inReview = 0;
      let approved = 0;

      for (const t of userTasks) {
        const st = String(t.status || '').toLowerCase().replace(/[\s-_]/g, '');
        if (st === 'todo' || st === 'open') {
          open++;
        } else if (st === 'inprogress') {
          inProgress++;
        } else if (st === 'inreview') {
          inReview++;
        } else if (st === 'done' || st === 'completed' || st === 'approved') {
          approved++;
        }
      }

      return {
        ...req,
        member: {
          id: req.userId,
          name: req.userName || user?.name || user?.username || req.userId,
          username: user?.username || '',
          avatarUrl: (user as any)?.avatarUrl || user?.avatar || (user?.profile as any)?.avatarUrl || (user?.profile as any)?.avatar || req.userAvatar || null,
          avatar: (user as any)?.avatarUrl || user?.avatar || (user?.profile as any)?.avatar || req.userAvatar || '',
        },
        taskSummary: {
          open,
          inProgress,
          inReview,
          approved,
        },
      };
    });
  }

  async approveRequest(
    requestId: string,
    callerUserId: string,
    callerRole?: string,
  ): Promise<{ success: boolean; leaveRequest: LeaveRequest }> {
    const req = this.leaveRequestsRepo.findById(requestId);
    if (!req) {
      throw new NotFoundException(`Leave request ${requestId} not found.`);
    }

    const project = this.projectsRepo.findById(req.projectId);
    if (!project) {
      throw new NotFoundException(`Project ${req.projectId} not found.`);
    }

    const userForCheck = { uid: callerUserId, id: callerUserId };
    const isOwner = isProjectOwner(project, userForCheck) || String(project.ownerId) === String(callerUserId);
    const normRole = normalizeRole(callerRole);
    const isAdmin = ['admin', 'superuser', 'administrator'].includes(normRole);

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'FORBIDDEN',
        message: 'Only the project owner can approve leave requests.',
      });
    }

    if (req.status !== 'pending') {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'REQUEST_ALREADY_DECIDED',
        message: `This leave request is already ${req.status}.`,
      });
    }

    // Execute member departure
    this.projectsService.executeMemberDeparture(
      req.projectId,
      req.userId,
      req.reasons,
      req.explanation,
      callerUserId,
    );

    const updated = this.leaveRequestsRepo.update(req.id, {
      status: 'approved',
      decidedAt: this.nowIso(),
      decidedBy: callerUserId,
    });

    // Notify member
    try {
      const projectTitle = project.title || project.name || `Project ${req.projectId}`;
      this.notificationsService.create({
        userId: req.userId,
        type: 'LEAVE_REQUEST_APPROVED',
        title: 'Leave request approved',
        message: `Your request to leave "${projectTitle}" has been approved.`,
        readStatus: false,
        referenceId: req.projectId,
        link: `/projects/${req.projectId}`,
      });
    } catch (err: any) {
      console.warn('[LeaveRequestsService] Failed to notify member of approval:', err?.message || err);
    }

    return {
      success: true,
      leaveRequest: updated,
    };
  }

  async rejectRequest(
    requestId: string,
    callerUserId: string,
    callerRole: string | undefined,
    dto: RejectLeaveRequestDto,
  ): Promise<{ success: boolean; leaveRequest: LeaveRequest }> {
    const req = this.leaveRequestsRepo.findById(requestId);
    if (!req) {
      throw new NotFoundException(`Leave request ${requestId} not found.`);
    }

    const project = this.projectsRepo.findById(req.projectId);
    if (!project) {
      throw new NotFoundException(`Project ${req.projectId} not found.`);
    }

    const userForCheck = { uid: callerUserId, id: callerUserId };
    const isOwner = isProjectOwner(project, userForCheck) || String(project.ownerId) === String(callerUserId);
    const normRole = normalizeRole(callerRole);
    const isAdmin = ['admin', 'superuser', 'administrator'].includes(normRole);

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'FORBIDDEN',
        message: 'Only the project owner can reject leave requests.',
      });
    }

    if (req.status !== 'pending') {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'REQUEST_ALREADY_DECIDED',
        message: `This leave request is already ${req.status}.`,
      });
    }

    const reasons = Array.isArray(dto?.reasons) ? dto.reasons : [];
    const explanation = (dto?.explanation || '').trim();

    if (reasons.length === 0) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'REASON_REQUIRED',
        message: 'At least one rejection reason is required.',
      });
    }

    if (!explanation || explanation.length < 10) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'REASON_REQUIRED',
        message: 'An explanation of at least 10 characters is required for rejection.',
      });
    }

    if (explanation.length > 500) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'REASON_TOO_LONG',
        message: 'Explanation must not exceed 500 characters.',
      });
    }

    const updated = this.leaveRequestsRepo.update(req.id, {
      status: 'rejected',
      rejectionReasons: reasons,
      rejectionExplanation: explanation,
      decidedAt: this.nowIso(),
      decidedBy: callerUserId,
    });

    // Notify member
    try {
      const projectTitle = project.title || project.name || `Project ${req.projectId}`;
      this.notificationsService.create({
        userId: req.userId,
        type: 'LEAVE_REQUEST_REJECTED',
        title: 'Leave request declined',
        message: `Your request to leave "${projectTitle}" was declined by the owner: ${explanation}`,
        readStatus: false,
        referenceId: req.projectId,
        link: `/collaborator/workspace/${req.projectId}`,
      });
    } catch (err: any) {
      console.warn('[LeaveRequestsService] Failed to notify member of rejection:', err?.message || err);
    }

    return {
      success: true,
      leaveRequest: updated,
    };
  }

  async processHourlyAutomation(): Promise<{ approvedCount: number; reminderCount: number }> {
    const pendingRequests = this.leaveRequestsRepo.findAllPending();
    const nowMs = this.nowMs();
    let approvedCount = 0;
    let reminderCount = 0;

    const autoApproveMs = LEAVE_REQUEST_AUTO_APPROVE_HOURS * 60 * 60 * 1000;
    const reminderMs = LEAVE_REQUEST_REMINDER_HOURS * 60 * 60 * 1000;

    for (const req of pendingRequests) {
      const createdMs = new Date(req.createdAt).getTime();
      const elapsedMs = nowMs - createdMs;

      const project = this.projectsRepo.findById(req.projectId);
      if (!project) continue;
      const projectTitle = project.title || project.name || `Project ${req.projectId}`;

      // Auto-approve after 7 days
      if (elapsedMs >= autoApproveMs) {
        try {
          this.projectsService.executeMemberDeparture(
            req.projectId,
            req.userId,
            req.reasons,
            req.explanation,
            'system',
          );
          this.leaveRequestsRepo.update(req.id, {
            status: 'approved',
            decidedAt: this.nowIso(),
            decidedBy: 'system',
          });
          approvedCount++;

          // Notify member and owner
          this.notificationsService.create({
            userId: req.userId,
            type: 'LEAVE_REQUEST_AUTO_APPROVED',
            title: 'Leave request auto-approved',
            message: `Your request to leave "${projectTitle}" has been automatically approved after 7 days without owner decision.`,
            readStatus: false,
            referenceId: req.projectId,
            link: `/projects/${req.projectId}`,
          });

          this.notificationsService.create({
            userId: String(project.ownerId),
            type: 'LEAVE_REQUEST_AUTO_APPROVED',
            title: 'Leave request auto-approved',
            message: `Leave request from ${req.userName || req.userId} in "${projectTitle}" was automatically approved after 7 days.`,
            readStatus: false,
            referenceId: req.projectId,
            link: `/owner/workspace/${req.projectId}`,
          });
        } catch (err: any) {
          console.warn(`[LeaveRequestsService] Auto-approval failed for request ${req.id}:`, err?.message || err);
        }
      } else if (elapsedMs >= reminderMs && !req.reminderSentAt) {
        // Send reminder after 3 days
        try {
          this.leaveRequestsRepo.update(req.id, {
            reminderSentAt: this.nowIso(),
          });
          reminderCount++;

          this.notificationsService.create({
            userId: String(project.ownerId),
            type: 'LEAVE_REQUEST_REMINDER',
            title: 'Pending leave request reminder',
            message: `A leave request from ${req.userName || req.userId} in "${projectTitle}" has been pending for over 3 days. Please review it.`,
            readStatus: false,
            referenceId: req.projectId,
            link: `/owner/workspace/${req.projectId}`,
          });
        } catch (err: any) {
          console.warn(`[LeaveRequestsService] Reminder notification failed for request ${req.id}:`, err?.message || err);
        }
      }
    }

    return { approvedCount, reminderCount };
  }
}
