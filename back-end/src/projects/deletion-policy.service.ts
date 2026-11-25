import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Inject,
  forwardRef,
  Optional,
} from '@nestjs/common';
import { ProjectsRepository, Project } from './projects.repository';
import { isProjectOwner, isPlatformAdminOrSuperUser } from '../common/utils/role.util';
import { TasksService } from '../tasks/tasks.service';
import { MentorMarketplaceService } from '../mentor-marketplace/mentor-marketplace.service';
import { JoinRequestsService } from '../join-requests/join-requests.service';
import { ProjectInvitesService } from './invites.service';
import { ClockService } from '../common/services/clock.service';

export interface DeletionBlocker {
  code: string;
  message: string;
  count: number;
  actionRoute?: string;
}

export interface DeletionImpact {
  activeCollaborators: number;
  mentorAssigned: boolean;
  pendingRequests: number;
  pendingInvites: number;
  openTasks: number;
  tasksInProgress: number;
  pendingSessionsToRefund: number;
}

export interface DeletionEvaluation {
  allowed: boolean;
  blockers: DeletionBlocker[];
  impact: DeletionImpact;
  requiresReason: boolean;
  noticeHours: number;
  mode: 'immediate' | 'scheduled';
  project: Project;
  isOwner: boolean;
  isAdmin: boolean;
  isAlreadyScheduled?: boolean;
}

@Injectable()
export class DeletionPolicyService {
  constructor(
    private readonly projectsRepository: ProjectsRepository,
    @Inject(forwardRef(() => TasksService))
    @Optional()
    private readonly tasksService?: any,
    @Inject(forwardRef(() => MentorMarketplaceService))
    @Optional()
    private readonly mentorMarketplaceService?: any,
    @Inject(forwardRef(() => JoinRequestsService))
    @Optional()
    private readonly joinRequestsService?: any,
    @Inject(forwardRef(() => ProjectInvitesService))
    @Optional()
    private readonly projectInvitesService?: any,
    @Optional()
    private readonly clockService?: ClockService,
  ) {}

  evaluate(projectId: string, actor: any): DeletionEvaluation {
    const project = this.projectsRepository.findById(projectId);
    if (!project) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        code: 'PROJECT_NOT_FOUND',
        message: `Project with ID ${projectId} not found.`,
      });
    }

    if (project.deletedAt) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        code: 'PROJECT_NOT_FOUND',
        message: `Project with ID ${projectId} not found.`,
      });
    }

    const isOwner =
      isProjectOwner(project, actor) ||
      String(project.ownerId) === String(actor?.uid || actor?.id);
    const isAdmin = isPlatformAdminOrSuperUser(actor);

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'NOT_PROJECT_OWNER',
        message: 'Only the project owner or an administrator can delete this project.',
      });
    }

    const blockers: DeletionBlocker[] = [];

    // Retrieve scoped entities
    const tasks =
      this.tasksService && typeof this.tasksService.findAllByProjectId === 'function'
        ? this.tasksService.findAllByProjectId(projectId)
        : Array.isArray(project.tasks)
          ? project.tasks
          : [];

    const allSessions =
      this.mentorMarketplaceService &&
      typeof this.mentorMarketplaceService.findAllSessions === 'function'
        ? this.mentorMarketplaceService.findAllSessions()
        : [];
    const sessions = allSessions.filter(
      (s: any) => String(s.projectId) === String(projectId),
    );

    const requests =
      this.joinRequestsService &&
      typeof this.joinRequestsService.findByProject === 'function'
        ? this.joinRequestsService.findByProject(projectId)
        : Array.isArray((project as any).requests)
          ? (project as any).requests
          : [];

    const invites =
      this.projectInvitesService &&
      typeof this.projectInvitesService.findByProject === 'function'
        ? this.projectInvitesService.findByProject(projectId)
        : [];

    // 1. Hard Blocker: PROJECT_HAS_HISTORY (Recorded work)
    const approvedTasks = tasks.filter((t: any) => {
      const st = String(t.status || '').toLowerCase().trim();
      return st === 'completed' || st === 'approved';
    });
    const isProjectCompleted =
      project.isCompleted === true ||
      String(project.status || '').toLowerCase().trim() === 'completed';
    const hasRecordedSession = sessions.some((s: any) => {
      const st = String(s.status || '').toLowerCase().trim();
      return st === 'completed' || st === 'released' || st === 'partly_paid';
    });

    if (approvedTasks.length > 0 || isProjectCompleted || hasRecordedSession) {
      blockers.push({
        code: 'PROJECT_HAS_HISTORY',
        message: 'This project has recorded work. Close it instead',
        count: approvedTasks.length || 1,
        actionRoute: `/projects/${projectId}/close`,
      });
    }

    // 2. Hard Blocker: TASKS_IN_REVIEW
    const inReviewTasks = tasks.filter((t: any) => {
      const st = String(t.status || '').toLowerCase().trim();
      return st === 'in review' || st === 'in-review' || st === 'submitted';
    });
    if (inReviewTasks.length > 0) {
      blockers.push({
        code: 'TASKS_IN_REVIEW',
        message: `${inReviewTasks.length} task(s) are in review. Approve or request changes first.`,
        count: inReviewTasks.length,
        actionRoute: `/workspace/${projectId}/tasks`,
      });
    }

    // 3. Hard Blocker: OPEN_DISPUTE
    const openDisputes = sessions.filter((s: any) => {
      const st = String(s.status || '').toLowerCase().trim();
      const hasDisputeMethod =
        this.mentorMarketplaceService &&
        typeof this.mentorMarketplaceService.hasOpenDispute === 'function' &&
        this.mentorMarketplaceService.hasOpenDispute(s.id);
      return st === 'disputed' || Boolean(hasDisputeMethod);
    });
    if (openDisputes.length > 0) {
      blockers.push({
        code: 'OPEN_DISPUTE',
        message: 'An escrow dispute is open on this project.',
        count: openDisputes.length,
        actionRoute: `/projects/${projectId}/escrow`,
      });
    }

    // 4. Hard Blocker: MENTOR_ENGAGEMENT_ACTIVE
    const activeMentorSessions = sessions.filter((s: any) => {
      const st = String(s.status || '').toLowerCase().trim();
      return st === 'active' || st === 'accepted';
    });
    const hasAssignedMentor = Boolean(
      project.mentorId ||
      (Array.isArray(project.members) &&
        project.members.some((m: any) => String(m.role || '').toLowerCase() === 'mentor')),
    );
    if (activeMentorSessions.length > 0 && hasAssignedMentor) {
      blockers.push({
        code: 'MENTOR_ENGAGEMENT_ACTIVE',
        message: 'A mentor is assigned and has an active or accepted session.',
        count: activeMentorSessions.length,
        actionRoute: `/projects/${projectId}/mentor`,
      });
    }

    // 5. Hard Blocker: MONEY_IN_FLIGHT / PROJECT_HAS_ACTIVE_ESCROW
    const moneyInFlight = sessions.filter((s: any) => {
      const st = String(s.status || '').toLowerCase().trim();
      return (
        st === 'escrow_funded' ||
        st === 'payout_pending' ||
        (st === 'disputed' && !openDisputes.includes(s))
      );
    });
    if (moneyInFlight.length > 0) {
      blockers.push({
        code: 'PROJECT_HAS_ACTIVE_ESCROW',
        message:
          'Cannot delete a project with an active or accepted mentor session or held escrow funds. Close the project first so Phase 9 escrow refunds run.',
        count: moneyInFlight.length,
        actionRoute: `/projects/${projectId}/escrow`,
      });
    }

    // Compute Impact
    const activeCollaborators = (project.members || []).filter((m: any) => {
      const r = String(m.role || '').toLowerCase().trim();
      return r !== 'owner' && r !== 'mentor' && r !== 'former member';
    }).length;

    const mentorAssigned = Boolean(
      project.mentorId ||
      (Array.isArray(project.members) &&
        project.members.some((m: any) => String(m.role || '').toLowerCase() === 'mentor')),
    );

    const pendingRequests = requests.filter(
      (r: any) => String(r.status || '').toLowerCase().trim() === 'pending',
    ).length;

    const pendingInvites = invites.filter(
      (i: any) => String(i.status || '').toLowerCase().trim() === 'pending',
    ).length;

    const openTasks = tasks.filter((t: any) => {
      const st = String(t.status || '').toLowerCase().trim();
      return st === 'open' || st === 'todo' || st === 'to-do' || st === 'to do';
    }).length;

    const tasksInProgress = tasks.filter((t: any) => {
      const st = String(t.status || '').toLowerCase().trim();
      return st === 'in-progress' || st === 'in progress';
    }).length;

    const pendingSessionsToRefund = sessions.filter((s: any) => {
      const st = String(s.status || '').toLowerCase().trim();
      return st === 'payment_pending' || st === 'pending';
    }).length;

    // Mode & Reason determination
    const hasInvolvedPeople = activeCollaborators > 0 || mentorAssigned;
    const envNotice = process.env.DELETE_NOTICE_HOURS;
    const defaultNotice = envNotice !== undefined ? parseInt(envNotice, 10) : 48;

    let mode: 'immediate' | 'scheduled' = 'immediate';
    let noticeHours = 0;
    let requiresReason = false;

    if (isAdmin) {
      mode = 'immediate';
      noticeHours = 0;
      requiresReason = true;
    } else if (isOwner) {
      if (hasInvolvedPeople) {
        noticeHours = defaultNotice;
        mode = defaultNotice > 0 ? 'scheduled' : 'immediate';
        requiresReason = true;
      } else {
        noticeHours = 0;
        mode = 'immediate';
        requiresReason = false;
      }
    }

    return {
      allowed: blockers.length === 0,
      blockers,
      impact: {
        activeCollaborators,
        mentorAssigned,
        pendingRequests,
        pendingInvites,
        openTasks,
        tasksInProgress,
        pendingSessionsToRefund,
      },
      requiresReason,
      noticeHours,
      mode,
      project,
      isOwner,
      isAdmin,
      isAlreadyScheduled: Boolean(project.deletionScheduledAt),
    };
  }
}
