import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  forwardRef,
  Optional,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { TasksRepository, Task } from './tasks.repository';
import { CreateTaskDto, TaskStatus } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { GamificationService } from '../gamification/gamification.service';
import { ProjectsService } from '../projects/projects.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { normalizeRole, isProjectOwner, isPlatformAdminOrSuperUser, getProjectRole } from '../common/utils/role.util';
import { PlatformConfigService } from '../platform-config/platform-config.service';
import {
  NotificationsService,
  NotificationGroupedItem,
  dispatchGroupedNotification,
  formatGroupedItemList,
} from '../notifications/notifications.service';
import { FeedbackService } from '../feedback/feedback.service';
import { ClockService } from '../common/services/clock.service';
import { ContentFilterService } from '../common/services/content-filter.service';
import { TASK_REWARDS, getTaskReward } from './tasks.constants';
import { assertSafeHttpUrl } from '../common/utils/url.util';
import { calculateReviewCredit, formatDurationWords, ReviewCreditResult } from './review-credit.util';
import { REVIEW_CREDIT_CONFIG } from './review-credit.config';

/**
 * Single canonical XP & Reputation calculation function:
 * High: 40 XP / +8 Rep, Medium: 20 XP / +8 Rep, Low: 10 XP / +8 Rep
 */
export function calculateTaskXp(
  priority?: string,
  _standardXp?: number,
): { xp: number; rep: number } {
  return getTaskReward(priority);
}


/**
 * Aliases accepted by the API so both the current
 * front-end vocabulary ('Open', 'Approved', ...) and the
 * canonical enum values keep working side-by-side.
 * Comparisons are case-insensitive.
 */
const STATUS_ALIASES: Record<string, TaskStatus> = {
  'to do': TaskStatus.ToDo,
  todo: TaskStatus.ToDo,
  'to-do': TaskStatus.ToDo,
  open: TaskStatus.ToDo,
  'in progress': TaskStatus.InProgress,
  'in-progress': TaskStatus.InProgress,
  inprogress: TaskStatus.InProgress,
  'in review': TaskStatus.InReview,
  'under review': TaskStatus.InReview,
  'under-review': TaskStatus.InReview,
  inreview: TaskStatus.InReview,
  submitted: TaskStatus.InReview,
  completed: TaskStatus.Completed,
  done: TaskStatus.Completed,
  approved: TaskStatus.Completed,
};

@Injectable()
export class TasksService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TasksService.name);
  constructor(
    private readonly tasksRepository: TasksRepository,
    private readonly gamificationService: GamificationService,
    @Inject(forwardRef(() => ProjectsService))
    private readonly projectsService: any,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: any,
    private readonly auditService: AuditService,
    private readonly platformConfigService: PlatformConfigService,
    private readonly notificationsService: NotificationsService,
    @Optional() private readonly clockService?: ClockService,
    @Optional()
    @Inject(forwardRef(() => ProjectAccessService))
    private readonly projectAccessService?: ProjectAccessService,
    @Optional() private readonly contentFilterService?: ContentFilterService,
    @Optional() private readonly moduleRef?: ModuleRef,
    @Optional() private readonly feedbackService?: FeedbackService,
  ) {}

  private getProjectAccessService(): ProjectAccessService | undefined {
    if (this.projectAccessService) return this.projectAccessService;
    try {
      return this.moduleRef?.get(ProjectAccessService, { strict: false });
    } catch {
      return undefined;
    }
  }

  onApplicationBootstrap() {
    if (this.feedbackService) {
      const taskResolver = (taskId: string) => {
        const task = this.findById(taskId);
        if (!task) return { exists: false, parties: [] };
        let ownerId: string | undefined;
        try {
          const proj = this.projectsService?.findById?.(task.projectId);
          if (proj?.ownerId) ownerId = String(proj.ownerId);
        } catch {}
        const parties: string[] = [];
        if (task.assigneeId && task.assigneeId.toLowerCase() !== 'unassigned') {
          parties.push(String(task.assigneeId));
        }
        if (ownerId && !parties.includes(ownerId)) {
          parties.push(ownerId);
        }
        return {
          exists: true,
          projectId: task.projectId,
          parties,
          actorId: ownerId,
          targetId: task.assigneeId ? String(task.assigneeId) : undefined,
        };
      };
      this.feedbackService.registerEntityResolver('TASK', taskResolver);
      this.feedbackService.registerEntityResolver('TASK_REVIEW', taskResolver);
      this.feedbackService.registerEntityResolver('SUBMISSION', taskResolver);
    }
    try {
      this.recalculateUserStats();
    } catch (e) {
      console.warn('Initial user stats recalculation notice:', e);
    }
    try {
      this.backfillTaskDueDates();
    } catch (e) {
      console.warn('Task due dates backfill notice:', e);
    }
    try {
      this.backfillTaskAssignedAt();
    } catch (e) {
      console.warn('Task assignedAt backfill notice:', e);
    }
  }

  backfillTaskAssignedAt(): void {
    const allTasks = this.tasksRepository.findAll();
    const fallbackIso = '2025-01-02T00:00:00.000Z';
    let count = 0;
    for (const task of allTasks) {
      const hasAssignee =
        (task.assigneeId && task.assigneeId.toLowerCase() !== 'unassigned') ||
        (task.assignee && task.assignee.toLowerCase() !== 'unassigned');
      if (hasAssignee && !task.assignedAt) {
        const assignedIso = (task as any).createdAt || fallbackIso;
        task.assignedAt = assignedIso;
        this.tasksRepository.update(task.id, { assignedAt: assignedIso } as any);
        count++;
      }
    }
    if (count > 0) {
      this.logger.log(`[TasksService] Backfilled assignedAt on ${count} existing assigned task(s).`);
    }
  }

  backfillTaskDueDates(): void {
    const allTasks = this.tasksRepository.findAll();
    let backfilledCount = 0;
    for (const task of allTasks) {
      if (!task.dueDate) {
        const proj = this.projectsService ? this.projectsService.findRawById(task.projectId) : null;
        const fallbackDate = proj?.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        task.dueDate = fallbackDate;
        this.tasksRepository.update(task.id, { dueDate: fallbackDate } as any);
        backfilledCount++;
      }
    }
    if (backfilledCount > 0) {
      this.logger.log(`[TasksService] Backfilled ${backfilledCount} existing tasks without a due date.`);
    }
  }

  recalculateUserStats(userId?: string): void {
    const users = userId ? [this.usersService.findById(userId)] : this.usersService.findAll();

    for (const user of users) {
      if (!user) continue;
      const uid = String(user.id);
      const stats = this.gamificationService.getUserStats(uid);

      this.usersService.update(user.id, {
        profile: {
          ...user.profile,
          xp: stats.totalXp,
          tasksCount: stats.tasksCompleted,
        },
      } as any);
      (user as any).xp = stats.totalXp;
    }
  }

  enrichTaskAssignee(task: Task): Task {
    if (!task) return task;

    // 1. If assigneeId is provided, resolve assigneeName & assignee
    if (task.assigneeId && task.assigneeId.toLowerCase() !== 'unassigned') {
      if (!task.assigneeName || !task.assignee || task.assignee === 'Unassigned') {
        const user = this.usersService.findUserSafe(task.assigneeId);
        if (user) {
          task.assigneeName = user.name;
          task.assignee = user.name;
          task.assignedTo = user.name;
        } else {
          try {
            const project = this.projectsService ? this.projectsService.findRawById(task.projectId) : null;
            const collabs = project && Array.isArray(project.collaborators) ? project.collaborators : [];
            const found = collabs.find(
              (c: any) =>
                typeof c === 'object' &&
                (String(c.id) === String(task.assigneeId) || String(c.userId) === String(task.assigneeId)),
            );
            if (found && found.name) {
              task.assigneeName = found.name;
              task.assignee = found.name;
              task.assignedTo = found.name;
            }
          } catch (err: any) {
        console.warn('[tasks.service] Suppressed non-critical error:', err?.message || err);
      }
        }
      }
    } else if ((task.assignee || task.assigneeName) && (!task.assigneeId || task.assigneeId.toLowerCase() === 'unassigned')) {
      // 2. Old tasks with only a name: map name to id once, using the project members / users
      const rawName = (task.assigneeName || task.assignee || '').trim();
      if (rawName && rawName.toLowerCase() !== 'unassigned') {
        try {
          const project = this.projectsService ? this.projectsService.findRawById(task.projectId) : null;
          const collabs = project && Array.isArray(project.collaborators) ? project.collaborators : [];
          const found = collabs.find((c: any) => {
            if (typeof c === 'string') return c.toLowerCase() === rawName.toLowerCase();
            return (
              (c.name && c.name.toLowerCase() === rawName.toLowerCase()) ||
              (c.id && String(c.id) === rawName) ||
              (c.userId && String(c.userId) === rawName)
            );
          });
          if (found) {
            task.assigneeId = typeof found === 'object' ? String(found.id || found.userId) : String(found);
            task.assigneeName = typeof found === 'object' && found.name ? found.name : rawName;
            task.assignee = task.assigneeName;
            task.assignedTo = task.assigneeName;
          } else {
            const user = this.usersService
              .findAll()
              .find(
                (u) =>
                  (u.name && u.name.toLowerCase() === rawName.toLowerCase()) ||
                  String(u.id) === rawName,
              );
            if (user) {
              task.assigneeId = String(user.id);
              task.assigneeName = user.name;
              task.assignee = user.name;
              task.assignedTo = user.name;
            }
          }
        } catch (err: any) {
        console.warn('[tasks.service] Suppressed non-critical error:', err?.message || err);
      }
      }
    }

    if (task.assigneeName && !task.assignee) {
      task.assignee = task.assigneeName;
    }
    if (task.assignee && !task.assigneeName) {
      task.assigneeName = task.assignee;
    }
    if (!task.assigneeName && !task.assignee && !task.assigneeId) {
      task.assignee = 'Unassigned';
      task.assigneeName = 'Unassigned';
    }
    const sClean = String(task.status || '').toLowerCase().replace(/[\s-_]/g, '');
    const isDone = sClean === 'completed' || sClean === 'approved' || sClean === 'done';
    const nowMs = this.clockService ? this.clockService.now().getTime() : Date.now();
    task.isOverdue = Boolean(!isDone && task.dueDate && new Date(task.dueDate).getTime() < nowMs);

    if (task.projectId && (task.assigneeId || task.assignee)) {
      try {
        const proj = this.projectsService ? this.projectsService.findRawById(task.projectId) : null;
        if (proj) {
          const role = getProjectRole(proj, task.assigneeId || task.assignee);
          task.assigneeRole = role || undefined;
        }
      } catch (err: any) {
        console.warn('[tasks.service] Suppressed non-critical error:', err?.message || err);
      }
    }

    (task as any).feedbackHistory = this.feedbackService?.findByEntity('TASK', task.id) || [];

    return task;
  }

  private validateTaskAssignee(projectId: string, assignee?: string, assigneeId?: string): void {
    if (!assignee && !assigneeId) return;
    const trimmedAssignee = (assignee || '').trim();
    if (!trimmedAssignee && !assigneeId) return;
    if (trimmedAssignee.toLowerCase() === 'unassigned') return;
    if (assigneeId && assigneeId.toLowerCase() === 'unassigned') return;

    const project = this.projectsService.findById(projectId);
    const collabs = Array.isArray(project.collaborators) ? project.collaborators : [];

    // Project owner is a valid team member
    const isOwner =
      (assigneeId && String(project.ownerId) === String(assigneeId)) ||
      (trimmedAssignee && (project.owner === trimmedAssignee || String(project.ownerId) === trimmedAssignee));

    // Project collaborators are valid team members
    const isCollab = collabs.some((c: any) => {
      if (typeof c === 'string') {
        return (assigneeId && String(c) === String(assigneeId)) || (trimmedAssignee && c.toLowerCase() === trimmedAssignee.toLowerCase());
      }
      return (
        (assigneeId && (String(c.id) === String(assigneeId) || String(c.userId) === String(assigneeId))) ||
        (trimmedAssignee && (
          (c.name && c.name.toLowerCase() === trimmedAssignee.toLowerCase()) ||
          (c.id && String(c.id) === trimmedAssignee) ||
          (c.userId && String(c.userId) === trimmedAssignee)
        ))
      );
    });

    // Project mentor is also a valid team member
    const isMentor =
      (assigneeId && (
        String(project.mentorId) === String(assigneeId) ||
        (typeof project.mentor === 'object' && project.mentor !== null && (String((project.mentor as any)?.id) === String(assigneeId) || String((project.mentor as any)?.userId) === String(assigneeId)))
      )) ||
      (trimmedAssignee && (
        (typeof project.mentor === 'string' && project.mentor.toLowerCase() === trimmedAssignee.toLowerCase()) ||
        (typeof project.mentor === 'object' && project.mentor !== null && (project.mentor as any)?.name && (project.mentor as any).name.toLowerCase() === trimmedAssignee.toLowerCase())
      ));

    if (!isOwner && !isCollab && !isMentor) {
      const user = assigneeId ? this.usersService.findUserSafe(assigneeId) : null;
      if (!user) {
        throw new BadRequestException('Task assignment is allowed only to existing project members.');
      }
    }
  }

  normaliseStatusValue(status?: string): TaskStatus | undefined {
    if (!status) return undefined;
    const key = status.trim().toLowerCase();
    const cleanKey = key.replace(/[\s-_]/g, '');
    const mapped = STATUS_ALIASES[cleanKey] || STATUS_ALIASES[key];
    if (mapped) return mapped;
    const rawMatch = Object.values(TaskStatus).find(
      (value) => value.toLowerCase().replace(/[\s-_]/g, '') === cleanKey,
    );
    return rawMatch as TaskStatus | undefined;
  }

  private extractCallerContext(callerOrId?: any, callerRole?: string) {
    if (callerOrId && typeof callerOrId === 'object') {
      const uid = callerOrId.uid || callerOrId.id;
      const role = callerRole || callerOrId.role || callerOrId.roleName;
      return {
        callerObj: { ...callerOrId, uid, id: uid, role },
        callerUserId: uid ? String(uid) : undefined,
        callerRole: role ? String(role) : undefined,
      };
    }
    const uid = callerOrId ? String(callerOrId) : undefined;
    return {
      callerObj: uid ? { uid, id: uid, role: callerRole } : undefined,
      callerUserId: uid,
      callerRole,
    };
  }

  private assertTaskProjectMatch(task: Task, suppliedProjectId?: string): void {
    if (suppliedProjectId === undefined || suppliedProjectId === null) return;
    const trimmed = String(suppliedProjectId).trim();
    if (trimmed && trimmed !== String(task.projectId)) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        code: 'TASK_NOT_FOUND',
        message: `Task with ID ${task.id} not found.`,
      });
    }
  }

  private assertInitialStatusAllowed(rawStatus?: string): void {
    if (rawStatus === undefined || rawStatus === null) return;
    const trimmed = String(rawStatus).trim();
    if (!trimmed) return;
    const clean = trimmed.toLowerCase().replace(/[\s-_]/g, '');
    if (clean !== 'open' && clean !== 'todo') {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'INVALID_INITIAL_STATUS',
        message: 'New tasks must start in Open status.',
      });
    }
  }

  findAllByProjectId(projectId: string, callerOrId?: any, callerRole?: string): Task[] {
    const { callerObj } = this.extractCallerContext(callerOrId, callerRole);
    const access = this.getProjectAccessService();
    if (callerObj && access) {
      access.assertMemberOrOwner(callerObj, projectId, { action: 'list_tasks' });
    }
    return this.tasksRepository.findAllByProjectId(projectId).map((t) => this.enrichTaskAssignee(t));
  }

  resetUnapprovedTasksForUser(projectId: string, userIdOrName: string): Task[] {
    return this.releaseMemberTasksOnDeparture({
      userId: userIdOrName,
      userName: userIdOrName,
      projectId,
      reason: 'left',
      notifyOnSuspend: false,
    }).releasedTasks;
  }

  private isReleasableOpenOrInProgress(task: Task): boolean {
    const normStatus = (task.status || '').toLowerCase().trim();
    const isToDo =
      normStatus === 'todo' ||
      normStatus === 'to-do' ||
      normStatus === 'to do' ||
      normStatus === 'open' ||
      normStatus === 'pending';
    const isInProgress =
      normStatus === 'in-progress' || normStatus === 'in progress' || normStatus === 'inprogress';
    return isToDo || isInProgress;
  }

  private resetTaskToUnassignedOpen(task: Task): Task {
    task.assignee = 'Unassigned';
    task.assigneeName = 'Unassigned';
    task.assigneeId = undefined;
    task.assignedTo = 'Unassigned';
    task.status = TaskStatus.ToDo;
    task.proofLink = undefined;
    task.proofUrl = undefined;
    (task as any).proof_link = undefined;
    task.inReviewSince = undefined;
    task.reviewReminderSentAt = undefined;
    task.assignedAt = undefined;
    this.tasksRepository.update(task.id, task);
    return task;
  }

  /**
   * Single shared release helper for member leave, removal, suspension, or inactivity task release.
   * Only Open / To Do and In Progress tasks are returned to Unassigned and To Do.
   * Tasks in In Review (with their proof URLs) and Completed remain completely untouched.
   */
  releaseMemberTasksOnDeparture(options: {
    userId: string;
    userName?: string;
    projectId?: string;
    reason?: 'left' | 'suspended' | 'removed' | 'inactive';
    notifyOnSuspend?: boolean;
  }): { releasedTasks: Task[]; affectedProjectIds: string[] } {
    const targets = [options.userId, options.userName]
      .filter(Boolean)
      .map((s) => String(s).trim().toLowerCase());
    if (targets.length === 0) return { releasedTasks: [], affectedProjectIds: [] };

    const scopedTasks = options.projectId
      ? this.tasksRepository.findAllByProjectId(options.projectId)
      : this.tasksRepository.findAll();

    const releasedTasks: Task[] = [];
    const projectMap = new Map<string, Task[]>();

    for (const task of scopedTasks) {
      const isAssigned = targets.some(
        (t) =>
          (task.assigneeId && String(task.assigneeId).toLowerCase() === t) ||
          (task.assigneeName && String(task.assigneeName).toLowerCase() === t) ||
          (task.assignee && String(task.assignee).toLowerCase() === t),
      );

      if (!isAssigned) continue;

      if (this.isReleasableOpenOrInProgress(task)) {
        this.resetTaskToUnassignedOpen(task);
        releasedTasks.push(task);

        if (!projectMap.has(task.projectId)) {
          projectMap.set(task.projectId, []);
        }
        projectMap.get(task.projectId)!.push(task);
      }
    }

    if (options.reason === 'suspended' && options.notifyOnSuspend !== false) {
      const byOwner = new Map<
        string,
        {
          items: NotificationGroupedItem[];
          projectIds: string[];
          projectTitles: Set<string>;
        }
      >();

      for (const [projectId, tasks] of projectMap.entries()) {
        const taskTitles = tasks.map((t) => t.title || t.id).join(', ');
        let project: any = null;
        try {
          project = this.projectsService.findById(projectId);
        } catch (err: any) {
          this.logger.warn(`Failed to load project ${projectId} for released task notification: ${err?.message}`);
        }
        const projectTitle = project?.title || project?.name || `Project ${projectId}`;

        if (project && project.ownerId) {
          const oid = String(project.ownerId);
          if (!byOwner.has(oid)) {
            byOwner.set(oid, { items: [], projectIds: [], projectTitles: new Set() });
          }
          const bucket = byOwner.get(oid)!;
          bucket.projectIds.push(projectId);
          bucket.projectTitles.add(projectTitle);
          for (const t of tasks) {
            bucket.items.push({
              label: t.title || t.id,
              link: `/owner/workspace/${projectId}`,
            });
          }
        }

        try {
          this.auditService.log({
            action: 'tasks-released-suspension',
            actor: 'System',
            target: `User #${options.userId}`,
            entityType: 'project',
            entityId: projectId,
            event: `Tasks released back to Open due to collaborator suspension: ${taskTitles}`,
            details: { releasedTaskIds: tasks.map((t) => t.id) },
          });
        } catch (err: any) {
          this.logger.warn(`Failed to log audit for task release: ${err?.message}`);
        }
      }

      for (const [ownerId, bucket] of byOwner.entries()) {
        try {
          const singleProjectTitle =
            bucket.projectTitles.size === 1
              ? Array.from(bucket.projectTitles)[0]
              : undefined;
          const primaryProjectId = bucket.projectIds[0];
          dispatchGroupedNotification(
            this.notificationsService,
            ownerId,
            `tasks_released:suspended:${options.userId}`,
            bucket.items,
            (items, count) => ({
              type: 'TASK_RELEASED',
              title: singleProjectTitle
                ? `${count} ${count === 1 ? 'task' : 'tasks'} released from ${singleProjectTitle}`
                : `${count} tasks released across ${bucket.projectTitles.size} projects`,
              message: singleProjectTitle
                ? `${count} ${count === 1 ? 'task' : 'tasks'} released from ${singleProjectTitle} after collaborator suspension: ${formatGroupedItemList(items, 10)}`
                : `${count} tasks released across ${bucket.projectTitles.size} projects after collaborator suspension: ${formatGroupedItemList(items, 10)}`,
              readStatus: false,
              referenceId: primaryProjectId,
              link: `/owner/workspace/${primaryProjectId}`,
              priority: 'immediate',
              metadata: singleProjectTitle
                ? { projectTitle: singleProjectTitle }
                : undefined,
            }),
          );
        } catch (err: any) {
          this.logger.warn(`Failed to notify project owner ${ownerId} for released tasks: ${err?.message}`);
        }
      }
    }

    return {
      releasedTasks,
      affectedProjectIds: Array.from(projectMap.keys()),
    };
  }

  releaseOpenAndInProgressTasksForProjectMember(
    projectId: string,
    userIdOrName: string,
    memberName?: string,
  ): Task[] {
    return this.releaseMemberTasksOnDeparture({
      userId: userIdOrName,
      userName: memberName,
      projectId,
      reason: 'inactive',
      notifyOnSuspend: false,
    }).releasedTasks;
  }

  releaseCollaboratorTasks(userId: string): { releasedTasks: Task[]; affectedProjectIds: string[] } {
    return this.releaseMemberTasksOnDeparture({
      userId,
      reason: 'suspended',
      notifyOnSuspend: true,
    });
  }

  findAll(): Task[] {
    return this.tasksRepository.findAll().map((t) => this.enrichTaskAssignee(t));
  }

  findById(id: string, callerOrId?: any, callerRole?: string, suppliedProjectId?: string): Task {
    const task = this.tasksRepository.findById(id);
    if (!task) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        code: 'TASK_NOT_FOUND',
        message: `Task with ID ${id} not found.`,
      });
    }
    this.assertTaskProjectMatch(task, suppliedProjectId);
    const { callerObj } = this.extractCallerContext(callerOrId, callerRole);
    const access = this.getProjectAccessService();
    if (callerObj && access) {
      access.assertMemberOrOwner(callerObj, task.projectId, {
        taskId: id,
        action: 'read_task',
      });
    }
    return this.enrichTaskAssignee(task);
  }

  create(
    createTaskDto: CreateTaskDto,
    callerOrId?: any,
    callerRole?: string,
    options?: { enforceInitialStatus?: boolean },
  ): Task {
    const { callerObj, callerUserId } = this.extractCallerContext(callerOrId, callerRole);
    const access = this.getProjectAccessService();
    if (callerObj && access) {
      access.assertOwnerOrAdmin(callerObj, createTaskDto.projectId, {
        action: 'create_task',
      });
    }
    if (options?.enforceInitialStatus) {
      this.assertInitialStatusAllowed(createTaskDto.status);
    }
    if (this.projectsService.isLocked(createTaskDto.projectId)) {
      throw new BadRequestException('Project is locked. Tasks cannot be created.');
    }
    const platformConfig = this.platformConfigService?.getConfig?.() as any;
    const maxTasksPerProject = Number(platformConfig?.taskLimitPerProject) || 30;
    const existingTasks =
      typeof this.tasksRepository?.findAllByProjectId === 'function'
        ? this.tasksRepository.findAllByProjectId(createTaskDto.projectId) || []
        : [];
    if (existingTasks.length >= maxTasksPerProject) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'TASK_LIMIT_REACHED',
        message: `A project can have at most ${maxTasksPerProject} tasks.`,
        currentCount: existingTasks.length,
        maxAllowed: maxTasksPerProject,
      });
    }
    this.contentFilterService?.assertClean(
      { title: createTaskDto.title, description: createTaskDto.description },
      ['title', 'description'],
      { actorId: String(callerUserId || 'owner'), entityType: 'task' },
    );
    if (callerUserId) {
      (createTaskDto as any).callerUserId = callerUserId;
    }

    // Phase 4 Rule: Task due date is required, must not be in past, must not be after project due date
    if (!createTaskDto.dueDate) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'DUE_DATE_REQUIRED',
        message: 'Task due date is required.',
      });
    }
    const dueTime = new Date(createTaskDto.dueDate).getTime();
    if (isNaN(dueTime)) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'DUE_DATE_REQUIRED',
        message: 'Invalid task due date format.',
      });
    }
    const now = this.clockService ? this.clockService.now() : new Date();
    const todayMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0);
    if (dueTime < todayMidnight) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'DUE_DATE_PAST',
        message: 'Task due date cannot be in the past.',
      });
    }

    const project = this.projectsService.findById(createTaskDto.projectId);
    if (project?.dueDate) {
      const projectDueTime = new Date(project.dueDate).getTime();
      if (!isNaN(projectDueTime) && dueTime > projectDueTime) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          code: 'DUE_DATE_AFTER_PROJECT',
          message: "Task due date cannot be after the project's due date.",
        });
      }
    }

    if (createTaskDto.proofLink) {
      assertSafeHttpUrl(createTaskDto.proofLink, 'proofLink', undefined, this.auditService);
    }
    if (createTaskDto.proofUrl) {
      assertSafeHttpUrl(createTaskDto.proofUrl, 'proofUrl', undefined, this.auditService);
    }

    this.validateTaskAssignee(createTaskDto.projectId, createTaskDto.assignee, createTaskDto.assigneeId);

    let assigneeId = createTaskDto.assigneeId;
    let assigneeName = createTaskDto.assigneeName || createTaskDto.assignee;

    if (assigneeId && (!assigneeName || assigneeName.toLowerCase() === 'unassigned')) {
      const user = this.usersService.findUserSafe(assigneeId);
      if (user) assigneeName = user.name;
    } else if (assigneeName && assigneeName.toLowerCase() !== 'unassigned' && !assigneeId) {
      const user = this.usersService.findAll().find(
        (u) => (u.name && u.name.toLowerCase() === assigneeName!.toLowerCase()) || String(u.id) === assigneeName,
      );
      if (user) assigneeId = String(user.id);
    }

    const taskReward = calculateTaskXp(createTaskDto.priority || createTaskDto.difficulty);
    const createdNowIso = this.clockService ? this.clockService.nowIso() : new Date().toISOString();
    const normInitStatus = this.normaliseStatusValue(createTaskDto.status);
    const created = this.tasksRepository.create({
      ...createTaskDto,
      status: normInitStatus || createTaskDto.status || TaskStatus.ToDo,
      xpReward: taskReward.xp,
      assigneeId: assigneeId || undefined,
      assigneeName: assigneeName || 'Unassigned',
      assignee: assigneeName || 'Unassigned',
      assignedTo: assigneeName || 'Unassigned',
      ...(assigneeId && assigneeId.toLowerCase() !== 'unassigned' ? { assignedAt: createdNowIso } : {}),
      ...(normInitStatus === TaskStatus.InReview ? { inReviewSince: createdNowIso, submittedAt: createdNowIso } : {}),
    } as any);
    this.projectsService.recalculateAndPersistProgress(createTaskDto.projectId);

    try {
      this.auditService.log({
        action: 'task-created',
        actor: created.assignee || 'Owner',
        target: created.title,
        entityType: 'task',
        entityId: created.id,
        event: `Task "${created.title}" was created in project #${created.projectId}`,
        details: { status: created.status, xp: created.xpReward || 10 },
      });
    } catch (err: any) {
        console.warn('[tasks.service] Suppressed non-critical error:', err?.message || err);
      }

    if (created.assigneeId && created.assigneeId.toLowerCase() !== 'unassigned') {
      try {
        let projectName = 'Project';
        try {
          const p = this.projectsService.findById(created.projectId);
          if (p) projectName = p.title || p.name || 'Project';
        } catch (err: any) {
        console.warn('[tasks.service] Suppressed non-critical error:', err?.message || err);
      }
        this.notificationsService.create({
          userId: String(created.assigneeId),
          type: 'TASK_ASSIGNED',
          title: 'Task Assigned',
          message: `You were assigned to task "${created.title}" in project "${projectName}".`,
          readStatus: false,
          referenceId: created.projectId,
        });
      } catch (err: any) {
        console.warn('[tasks.service] Suppressed non-critical error:', err?.message || err);
      }
    }

    if (this.projectsService && typeof this.projectsService.recordMemberActivity === 'function' && (createTaskDto as any).callerUserId) {
      try {
        this.projectsService.recordMemberActivity(createTaskDto.projectId, String((createTaskDto as any).callerUserId));
      } catch {}
    }

    return this.enrichTaskAssignee(created);
  }

  private validateRejectionReason(rawReason?: string): string {
    const trimmed = typeof rawReason === 'string' ? rawReason.trim() : '';
    if (!trimmed || trimmed.length < 10 || trimmed.length > 500) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'REASON_REQUIRED',
        message: 'A rejection reason between 10 and 500 characters is required.',
      });
    }
    return trimmed;
  }

  private resolveCallerPrivilege(project: any, callerUserId?: string, callerRole?: string) {
    const normRole = callerRole ? normalizeRole(callerRole) : undefined;
    const callerUser = { uid: callerUserId, id: callerUserId, role: callerRole };
    const isOwner = callerUserId ? isProjectOwner(project, callerUser) : false;
    const isAdmin = isPlatformAdminOrSuperUser(callerUser);
    const isOwnerOrAdmin = callerUserId
      ? (isOwner || isAdmin)
      : (normRole !== 'collaborator' && normRole !== 'mentor');
    return { normRole, callerUser, isOwner, isAdmin, isOwnerOrAdmin };
  }

  private isTaskInReview(task: Task): boolean {
    const clean = String(task?.status || '').toLowerCase().replace(/[\s-_]/g, '');
    return clean === 'inreview' || clean === 'underreview' || clean === 'submitted';
  }

  private isTaskCompleted(task: Task): boolean {
    const clean = String(task?.status || '').toLowerCase().replace(/[\s-_]/g, '');
    return clean === 'completed' || clean === 'approved' || clean === 'done';
  }

  /**
   * Canonical task approval path used by both project owners and the 7-day auto-approve job.
   */
  approveTask(
    id: string,
    options?: {
      actorId?: string;
      actorRole?: string;
      autoApproved?: boolean;
      extraUpdates?: Partial<Task>;
    },
  ): Task {
    const existingTask = this.findById(id);
    if (!options?.autoApproved && this.projectsService.isLocked(existingTask.projectId)) {
      throw new BadRequestException('Project is locked. Tasks cannot be modified.');
    }
    if (this.gamificationService.hasEntryForTask(id) || existingTask.xpAwarded) {
      throw new BadRequestException('XP and reputation have already been awarded for this task.');
    }

    const parentProject = this.projectsService.findById(existingTask.projectId);
    if (!options?.autoApproved) {
      const access = this.getProjectAccessService();
      if (options?.actorId && access) {
        access.assertOwnerOrAdmin(
          { uid: options.actorId, id: options.actorId, role: options.actorRole },
          existingTask.projectId,
          { taskId: id, action: 'approve_task' },
        );
      }
      const { isOwnerOrAdmin } = this.resolveCallerPrivilege(
        parentProject,
        options?.actorId,
        options?.actorRole,
      );
      if (!isOwnerOrAdmin) {
        throw new ForbiddenException('Only project owners can approve tasks.');
      }
    }

    const isAutoApproved = Boolean(options?.autoApproved);
    const approvedNowIso = this.clockService ? this.clockService.nowIso() : new Date().toISOString();
    const updatedTask = this.tasksRepository.update(id, {
      ...(options?.extraUpdates || {}),
      status: TaskStatus.Completed,
      autoApproved: isAutoApproved,
      approvedAt: approvedNowIso,
      rejectionReason: undefined,
      rejectedAt: undefined,
      rejectedBy: undefined,
    } as any);
    if (!updatedTask) {
      throw new NotFoundException(`Task with ID ${id} not found.`);
    }

    const priorityRaw = (
      updatedTask.priority ||
      updatedTask.difficulty ||
      existingTask.priority ||
      existingTask.difficulty ||
      ''
    )
      .trim()
      .toLowerCase();

    const { xp: xpReward, rep: repReward } = calculateTaskXp(priorityRaw);

    let userIdToAward = updatedTask.assigneeId || existingTask.assigneeId;
    const targetAssigneeName = updatedTask.assignee || existingTask.assignee;

    if (!userIdToAward && targetAssigneeName && targetAssigneeName.toLowerCase() !== 'unassigned') {
      const foundUser = this.usersService.findAll().find(
        (u) => u.name?.toLowerCase() === targetAssigneeName.toLowerCase() || u.id === targetAssigneeName,
      );
      userIdToAward = foundUser ? foundUser.id : targetAssigneeName;
    }

    if (userIdToAward && userIdToAward.toLowerCase() !== 'unassigned') {
      this.gamificationService.recordTaskApproval({
        userId: userIdToAward,
        taskId: id,
        projectId: updatedTask.projectId || existingTask.projectId,
        xp: xpReward,
        rep: repReward,
        reason: isAutoApproved
          ? `Task Auto-Approved: ${updatedTask.title || existingTask.title}`
          : `Task Approved: ${updatedTask.title || existingTask.title}`,
      });

      updatedTask.xpReward = xpReward;
      updatedTask.xpAwarded = true;
      updatedTask.awardedXp = xpReward;
      updatedTask.awardedRep = repReward;
      this.tasksRepository.update(id, {
        xpReward,
        xpAwarded: true,
        awardedXp: xpReward,
        awardedRep: repReward,
      } as any);

      try {
        const userStats = this.gamificationService.getUserStats(userIdToAward);
        const userObj = this.usersService.findById(userIdToAward);
        if (userObj) {
          let projectName = 'Project';
          try {
            if (parentProject) projectName = (parentProject as any).title || (parentProject as any).name || 'Project';
          } catch (err: any) {
            console.warn('[tasks.service] Suppressed non-critical error:', err?.message || err);
          }

          const existingProjects = Array.isArray(userObj.data?.projects) ? [...userObj.data.projects] : [];
          const projIdx = existingProjects.findIndex(
            (p: any) => p.name === projectName || p.id === (updatedTask.projectId || existingTask.projectId),
          );
          const finalLink = updatedTask.proofLink || (updatedTask as any).proofUrl || '#';
          const contributionDesc = updatedTask.title || 'Task deliverable';

          if (projIdx >= 0) {
            existingProjects[projIdx] = {
              ...existingProjects[projIdx],
              contribution: contributionDesc,
              finalLink,
              status: 'Completed',
            };
          } else {
            existingProjects.push({
              id: updatedTask.projectId,
              name: projectName,
              role: 'Collaborator',
              contribution: contributionDesc,
              finalLink,
              status: 'Completed',
            });
          }

          this.usersService.update(userIdToAward, {
            profile: {
              ...userObj.profile,
              xp: userStats.totalXp,
              tasksCount: userStats.tasksCompleted,
            },
            data: {
              ...userObj.data,
              projects: existingProjects,
            },
          } as any);
          (userObj as any).xp = userStats.totalXp;
        }
      } catch (err: any) {
        console.warn('[tasks.service] Suppressed non-critical error:', err?.message || err);
      }
    }

    this.projectsService.recalculateAndPersistProgress(existingTask.projectId);

    try {
      const awardTarget = updatedTask.assigneeId || existingTask.assigneeId;
      if (awardTarget && awardTarget.toLowerCase() !== 'unassigned') {
        this.notificationsService.create({
          userId: String(awardTarget),
          type: isAutoApproved ? 'TASK_AUTO_APPROVED' : 'TASK_APPROVED',
          title: isAutoApproved ? 'Task Auto-Approved' : 'Task Approved',
          message: isAutoApproved
            ? `Your submission for "${updatedTask.title}" was auto-approved after 7 days because the owner did not review it in time (+${xpReward} XP awarded).`
            : `🎉 Your submission for "${updatedTask.title}" was approved!`,
          readStatus: false,
          referenceId: updatedTask.projectId,
          link: `/collaborator/workspace/${updatedTask.projectId}`,
        });
      }
      if (isAutoApproved && parentProject?.ownerId) {
        this.notificationsService.create({
          userId: String(parentProject.ownerId),
          type: 'TASK_AUTO_APPROVED',
          title: 'Task Auto-Approved After 7 Days',
          message: `Task "${updatedTask.title}" was auto-approved after 7 days with no review.`,
          readStatus: false,
          referenceId: updatedTask.projectId,
          link: `/owner/workspace/${updatedTask.projectId}`,
        });
      }
    } catch (err: any) {
      console.warn('[tasks.service] Suppressed non-critical error:', err?.message || err);
    }

    try {
      this.auditService.log({
        action: isAutoApproved ? 'task-auto-approved' : 'task-approved',
        actor: isAutoApproved ? 'System' : (options?.actorId ? String(options.actorId) : 'Owner'),
        target: updatedTask.title,
        entityType: 'task',
        entityId: updatedTask.id,
        event: isAutoApproved
          ? `Task "${updatedTask.title}" was auto-approved after 7 days (+XP awarded)`
          : `Task "${updatedTask.title}" was approved by owner (+XP awarded)`,
        details: { status: TaskStatus.Completed, autoApproved: isAutoApproved },
      });
    } catch {}

    if (
      !isAutoApproved &&
      options?.actorId &&
      this.projectsService &&
      typeof this.projectsService.recordMemberActivity === 'function'
    ) {
      try {
        this.projectsService.recordMemberActivity(existingTask.projectId, String(options.actorId));
      } catch {}
    }

    return this.enrichTaskAssignee(updatedTask);
  }

  /**
   * Canonical task rejection / send-back-for-revision handler.
   */
  rejectTask(
    id: string,
    rawReason?: string,
    callerUserId?: string,
    callerRole?: string,
    targetStatus: TaskStatus = TaskStatus.ToDo,
    actionType = 'REJECT_WORK',
    feedbackPayload?: any,
  ): Task {
    const existingTask = this.findById(id);
    const access = this.getProjectAccessService();
    if (callerUserId && access) {
      access.assertOwnerOrAdmin(
        { uid: callerUserId, id: callerUserId, role: callerRole },
        existingTask.projectId,
        { taskId: id, action: 'reject_task' },
      );
    }
    if (this.projectsService.isLocked(existingTask.projectId)) {
      throw new BadRequestException('Project is locked. Tasks cannot be modified.');
    }
    if (this.isTaskCompleted(existingTask)) {
      throw new BadRequestException('Completed tasks cannot be sent back for revision.');
    }

    // Phase 29: Trigger condition - only tasks currently in review can be rejected
    if (!this.isTaskInReview(existingTask)) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'TASK_NOT_IN_REVIEW',
        message: 'Only tasks currently in review can be rejected or sent back for revisions.',
      });
    }

    // Phase 29: Once per submission & idempotency
    const currentSubmissionAt = existingTask.submittedAt || existingTask.inReviewSince;
    if (
      existingTask.lastCreditedSubmissionAt &&
      currentSubmissionAt &&
      existingTask.lastCreditedSubmissionAt === currentSubmissionAt
    ) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'ALREADY_REVIEWED',
        message: 'This submission has already been reviewed or credited.',
      });
    }

    const parentProject = this.projectsService.findById(existingTask.projectId);
    const { isOwnerOrAdmin } = this.resolveCallerPrivilege(parentProject, callerUserId, callerRole);
    if (!isOwnerOrAdmin) {
      throw new ForbiddenException('Only project owners can reject submitted tasks.');
    }

    let trimmedReason: string;
    let feedbackRecord: any;
    if (this.feedbackService) {
      let fb = feedbackPayload?.reasons !== undefined
        ? { reasons: feedbackPayload.reasons, explanation: feedbackPayload.explanation }
        : ((feedbackPayload as any)?.feedback || (rawReason ? { reasons: ['OTHER'], explanation: rawReason } : undefined));
      if (!fb) {
        fb = { reasons: [] };
      }
      const validated = this.feedbackService.validate(actionType, fb, { uid: callerUserId, id: callerUserId, role: callerRole }, existingTask);
      trimmedReason = validated.explanation || validated.reasons.join(', ');
      feedbackRecord = this.feedbackService.record({
        actionType,
        entityType: 'TASK',
        entityId: id,
        projectId: existingTask.projectId,
        actorUserId: callerUserId || 'Owner',
        targetUserId: existingTask.assigneeId ? String(existingTask.assigneeId) : undefined,
        reasons: validated.reasons,
        explanation: validated.explanation,
      });
    } else {
      trimmedReason = this.validateRejectionReason(rawReason);
    }
    const nowIso = this.clockService ? this.clockService.nowIso() : new Date().toISOString();
    const rejectedBy = callerUserId ? String(callerUserId) : (callerRole || 'Owner');
    const history = Array.isArray(existingTask.rejectionHistory) ? [...existingTask.rejectionHistory] : [];
    history.push({ reason: trimmedReason, at: nowIso, by: rejectedBy });

    const nextStatus =
      targetStatus === TaskStatus.InProgress || targetStatus === TaskStatus.ToDo
        ? targetStatus
        : TaskStatus.ToDo;

    // Phase 29: Review Time Credit Calculation & Preconditions
    const hasActiveAssignee = Boolean(existingTask.assigneeId && existingTask.assigneeId.toLowerCase() !== 'unassigned');
    const hasDueDate = Boolean(existingTask.dueDate);
    let creditResult: ReviewCreditResult = {
      creditMs: 0,
      creditMinutes: 0,
      newDueDate: existingTask.dueDate || null,
      previousDueDate: existingTask.dueDate || null,
      reviewDurationMs: 0,
      formattedDuration: '0 minutes',
      requiresProjectExtension: false,
      minProjectDueDate: null,
    };

    if (REVIEW_CREDIT_CONFIG.ENABLED && hasActiveAssignee && hasDueDate && currentSubmissionAt) {
      const creditedSoFarMs = (existingTask.dueDateHistory || [])
        .filter((h) => h.reason === 'REVIEW_CREDIT')
        .reduce((sum, h) => sum + (h.creditMs || 0), 0);

      creditResult = calculateReviewCredit({
        submittedAt: currentSubmissionAt,
        rejectedAt: nowIso,
        dueDate: existingTask.dueDate,
        mode: REVIEW_CREDIT_CONFIG.MODE,
        minMinutes: REVIEW_CREDIT_CONFIG.MIN_MINUTES,
        perEventCapDays: REVIEW_CREDIT_CONFIG.MAX_PER_EVENT_DAYS,
        perTaskCapDays: REVIEW_CREDIT_CONFIG.MAX_PER_TASK_DAYS,
        creditedSoFarMs,
        projectDueDate: parentProject?.dueDate,
      });

      if (creditResult.skippedReason) {
        this.logger.log(`[ReviewCredit] Task ${id} review credit skipped: ${creditResult.skippedReason}`);
      }
    }

    // Phase 29: Solution 3 Enforcement - Mandatory Project Deadline Cascade
    let projectDeadlineExtended = false;
    if (creditResult.creditMs > 0 && creditResult.requiresProjectExtension) {
      const extendedProjectDueDate =
        feedbackPayload?.extendedProjectDueDate || feedbackPayload?.projectDueDate;
      const projectReason =
        feedbackPayload?.projectReason ||
        feedbackPayload?.projectDeadlineReason ||
        feedbackPayload?.projectExtensionReason;

      if (!extendedProjectDueDate) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          code: 'PROJECT_DEADLINE_EXTENSION_REQUIRED',
          message: `Task review credit extends task deadline to ${creditResult.newDueDate}, which exceeds project deadline (${parentProject?.dueDate}). The project deadline must be extended to at least ${creditResult.newDueDate}.`,
          details: {
            newDueDate: creditResult.newDueDate,
            currentProjectDueDate: parentProject?.dueDate,
            minProjectDueDate: creditResult.newDueDate,
            reviewCreditMs: creditResult.creditMs,
          },
        });
      }

      const extProjTime = new Date(extendedProjectDueDate).getTime();
      if (isNaN(extProjTime)) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          code: 'DEADLINE_NOT_FUTURE',
          message: 'Invalid project deadline date format.',
        });
      }

      const minRequiredTime = new Date(creditResult.newDueDate!).getTime();
      if (extProjTime < minRequiredTime) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          code: 'DEADLINE_BEFORE_TASKS',
          message: `New project deadline cannot be earlier than task due date (${creditResult.newDueDate}).`,
        });
      }

      const trimmedProjReason = typeof projectReason === 'string' ? projectReason.trim() : '';
      if (!trimmedProjReason || trimmedProjReason.length < 10) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          code: 'REASON_REQUIRED',
          message: 'A reason of at least 10 characters is required to extend the project deadline.',
        });
      }

      // Extend project deadline atomically before updating task
      const callerUserObj = callerUserId ? this.usersService.findUserSafe(callerUserId) : null;
      this.projectsService.changeDeadline(
        existingTask.projectId,
        { dueDate: new Date(extendedProjectDueDate).toISOString(), reason: trimmedProjReason },
        callerUserObj || { uid: callerUserId, id: callerUserId, role: callerRole, name: 'Project Owner' },
        callerRole,
      );
      projectDeadlineExtended = true;
    }

    let nextDueDate = existingTask.dueDate;
    const dueDateHistory = Array.isArray(existingTask.dueDateHistory) ? [...existingTask.dueDateHistory] : [];

    if (creditResult.creditMs > 0 && creditResult.newDueDate) {
      nextDueDate = creditResult.newDueDate;
      dueDateHistory.push({
        previousDueDate: existingTask.dueDate || '',
        newDueDate: creditResult.newDueDate,
        creditMs: creditResult.creditMs,
        reason: 'REVIEW_CREDIT',
        at: nowIso,
        extendedProject: projectDeadlineExtended,
      });
    }

    const persistPayload: any = {
      status: nextStatus,
      rejectionReason: trimmedReason,
      rejectedAt: nowIso,
      rejectedBy,
      rejectionHistory: history,
      inReviewSince: undefined,
      reviewReminderSentAt: undefined,
      autoApproved: undefined,
      lastCreditedSubmissionAt: currentSubmissionAt || nowIso,
    };

    if (creditResult.creditMs > 0 && creditResult.newDueDate) {
      persistPayload.dueDate = nextDueDate;
      persistPayload.dueDateHistory = dueDateHistory;
      persistPayload.dueSoonNotifiedAt = undefined;
      persistPayload.overdueNotifiedAt = undefined;
      const nowMs = this.clockService ? new Date(this.clockService.now()).getTime() : Date.now();
      if (new Date(nextDueDate).getTime() > nowMs) {
        persistPayload.isOverdue = false;
      }
    }

    const updatedTask = this.tasksRepository.update(id, persistPayload);
    if (!updatedTask) {
      throw new NotFoundException(`Task with ID ${id} not found.`);
    }

    this.projectsService.recalculateAndPersistProgress(existingTask.projectId);

    let creditExplanation = '';
    if (creditResult.creditMs > 0 && creditResult.newDueDate) {
      creditExplanation = ` Because review took ${creditResult.formattedDuration}, task deadline was extended by the same duration. New deadline: ${new Date(creditResult.newDueDate).toLocaleDateString()}.`;
    }

    try {
      const revTarget = updatedTask.assigneeId || existingTask.assigneeId;
      if (revTarget && revTarget.toLowerCase() !== 'unassigned') {
        this.notificationsService.create({
          userId: String(revTarget),
          type: 'TASK_REJECTED',
          title: 'Task Revision Requested',
          message: `⚠️ Your submission for task "${updatedTask.title}" was requested for revisions. Reason: ${trimmedReason}.${creditExplanation}`,
          readStatus: false,
          referenceId: updatedTask.projectId,
          link: `/collaborator/workspace/${updatedTask.projectId}`,
          metadata: {
            taskId: updatedTask.id,
            rejectionReason: trimmedReason,
            reasons: feedbackRecord?.reasons,
            explanation: feedbackRecord?.explanation,
            rejectedAt: nowIso,
            reviewCreditMs: creditResult.creditMs,
            reviewDuration: creditResult.formattedDuration,
            newDueDate: creditResult.newDueDate,
            projectDeadlineExtended,
          },
        });
      }
    } catch (err: any) {
      console.warn('[tasks.service] Suppressed non-critical error:', err?.message || err);
    }

    try {
      this.auditService.log({
        action: 'task-rejected',
        actor: rejectedBy,
        target: updatedTask.title,
        entityType: 'task',
        entityId: updatedTask.id,
        event: `Submission for task "${updatedTask.title}" was requested for revisions: ${trimmedReason}`,
        details: { reason: trimmedReason, reasons: feedbackRecord?.reasons, rejectedAt: nowIso },
      });
    } catch {}

    if (creditResult.creditMs > 0) {
      try {
        this.auditService.log({
          action: 'TASK_REVIEW_CREDIT_APPLIED',
          actor: rejectedBy,
          target: updatedTask.title,
          entityType: 'task',
          entityId: updatedTask.id,
          event: `Review credit applied to task "${updatedTask.title}": extended by ${creditResult.creditMinutes} minutes`,
          details: {
            taskId: updatedTask.id,
            creditMinutes: creditResult.creditMinutes,
            creditMs: creditResult.creditMs,
            previousDueDate: existingTask.dueDate,
            newDueDate: creditResult.newDueDate,
            projectDeadlineExtended,
          },
        });
      } catch {}
    }

    if (callerUserId && this.projectsService && typeof this.projectsService.recordMemberActivity === 'function') {
      try {
        this.projectsService.recordMemberActivity(existingTask.projectId, String(callerUserId));
      } catch {}
    }

    return this.enrichTaskAssignee(updatedTask);
  }

  /**
   * Dedicated task review decision endpoint (`decision: 'approve' | 'reject'`).
   */
  reviewTask(
    id: string,
    payload: {
      decision?: string;
      status?: string;
      reason?: string;
      rejectionReason?: string;
      projectId?: string;
      feedback?: any;
      reasons?: string[];
      explanation?: string;
      extendedProjectDueDate?: string;
      projectDueDate?: string;
      projectReason?: string;
      projectDeadlineReason?: string;
      projectExtensionReason?: string;
    },
    callerOrId?: any,
    callerRole?: string,
    suppliedProjectId?: string,
  ): Task {
    const existingTask = this.findById(id);
    this.assertTaskProjectMatch(existingTask, suppliedProjectId ?? payload?.projectId);
    const { callerObj, callerUserId, callerRole: effRole } = this.extractCallerContext(callerOrId, callerRole);
    const access = this.getProjectAccessService();
    if (callerObj && access) {
      access.assertOwnerOrAdmin(callerObj, existingTask.projectId, {
        taskId: id,
        action: 'review_task',
      });
    }
    const decisionRaw = String(payload?.decision || payload?.status || '').trim().toLowerCase();
    if (decisionRaw === 'approve' || decisionRaw === 'approved' || decisionRaw === 'completed' || decisionRaw === 'done') {
      return this.approveTask(id, { actorId: callerUserId, actorRole: effRole, autoApproved: false });
    }
    if (
      decisionRaw === 'reject' ||
      decisionRaw === 'rejected' ||
      decisionRaw === 'open' ||
      decisionRaw === 'to do' ||
      decisionRaw === 'todo' ||
      decisionRaw === 'revision' ||
      decisionRaw === 'changes_requested'
    ) {
      const isChangesRequested = decisionRaw === 'changes_requested' || decisionRaw === 'revision';
      const actionType = isChangesRequested ? 'REQUEST_CHANGES' : 'REJECT_WORK';
      return this.rejectTask(
        id,
        payload?.reason ?? payload?.rejectionReason ?? payload?.explanation,
        callerUserId,
        effRole,
        TaskStatus.ToDo,
        actionType,
        payload,
      );
    }
    throw new BadRequestException('Review decision must be "approve" or "reject".');
  }

  /**
   * Unassign / drop a task. Always requires a reason.
   */
  unassignTask(
    id: string,
    reason?: string,
    callerOrId?: any,
    callerRole?: string,
    suppliedProjectId?: string,
    feedbackPayload?: any,
  ): Task {
    const existingTask = this.findById(id);
    this.assertTaskProjectMatch(existingTask, suppliedProjectId);
    const { callerObj, callerUserId, callerRole: effRole } = this.extractCallerContext(callerOrId, callerRole);
    const access = this.getProjectAccessService();
    if (callerObj && access) {
      access.assertMemberOrOwner(callerObj, existingTask.projectId, {
        taskId: id,
        action: 'unassign_task',
      });
    }
    if (this.projectsService.isLocked(existingTask.projectId)) {
      throw new BadRequestException('Project is locked. Tasks cannot be modified.');
    }
    if (this.isTaskInReview(existingTask) || this.isTaskCompleted(existingTask)) {
      throw new BadRequestException('Cannot unassign a task that is already in review or completed.');
    }

    const currentAssigneeName = existingTask.assigneeName || existingTask.assignee || 'Unassigned';
    const hasAssignee = Boolean(
      (existingTask.assigneeId && existingTask.assigneeId.toLowerCase() !== 'unassigned') ||
      (currentAssigneeName && currentAssigneeName.toLowerCase() !== 'unassigned'),
    );
    if (!hasAssignee) {
      throw new BadRequestException('Task is not currently assigned.');
    }

    const parentProject = this.projectsService.findById(existingTask.projectId);
    const { isOwnerOrAdmin } = this.resolveCallerPrivilege(parentProject, callerUserId, effRole);
    const callerUser = callerUserId ? this.usersService.findUserSafe(callerUserId) : null;
    const isSelfAssignee = Boolean(
      (callerUserId && existingTask.assigneeId && String(existingTask.assigneeId) === String(callerUserId)) ||
      (callerUser &&
        ((existingTask.assigneeName && existingTask.assigneeName.toLowerCase() === callerUser.name.toLowerCase()) ||
          (existingTask.assignee && existingTask.assignee.toLowerCase() === callerUser.name.toLowerCase()))),
    );

    if (!isOwnerOrAdmin && !isSelfAssignee) {
      throw new ForbiddenException('You can only unassign tasks currently assigned to you.');
    }

    const isCollaboratorDrop = !isOwnerOrAdmin && isSelfAssignee;
    const actionType = isCollaboratorDrop ? 'DROP_TASK' : 'UNASSIGN_FROM_TASK';

    let trimmedReason = typeof reason === 'string' ? reason.trim() : '';
    let feedbackRecord: any;

    const nowMs = this.clockService ? new Date(this.clockService.now()).getTime() : Date.now();
    const taskDueMs = existingTask.dueDate ? new Date(existingTask.dueDate).getTime() : 0;
    const isLateDrop = isCollaboratorDrop && taskDueMs > 0 && (taskDueMs - nowMs) < 24 * 60 * 60 * 1000;

    if (isCollaboratorDrop && isLateDrop) {
      if (!trimmedReason || trimmedReason.length < 10 || trimmedReason.length > 300) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          code: 'REASON_REQUIRED',
          message: 'A reason between 10 and 300 characters is required for dropping a task within 24 hours of its deadline.',
        });
      }
    } else if (feedbackPayload && (feedbackPayload.reasons || feedbackPayload.explanation)) {
      if (this.feedbackService) {
        const validated = this.feedbackService.validate(actionType, feedbackPayload, callerObj || callerUserId, existingTask);
        trimmedReason = validated.explanation || validated.reasons.join(', ');
        feedbackRecord = this.feedbackService.record({
          actionType,
          entityType: 'TASK',
          entityId: id,
          projectId: existingTask.projectId,
          actorUserId: callerUserId || 'User',
          targetUserId: isCollaboratorDrop ? String(parentProject?.ownerId) : String(existingTask.assigneeId),
          reasons: validated.reasons,
          explanation: validated.explanation,
        });
      }
    }

    const actorLabel = callerUser?.name || currentAssigneeName || callerUserId || 'Collaborator';
    this.resetTaskToUnassignedOpen(existingTask);
    this.projectsService.recalculateAndPersistProgress(existingTask.projectId);

    if (parentProject?.ownerId) {
      try {
        const notifTitle = isCollaboratorDrop ? 'Collaborator Dropped Task' : 'Task Unassigned';
        const targetNotifUser = isCollaboratorDrop ? String(parentProject.ownerId) : String(existingTask.assigneeId);
        this.notificationsService.create({
          userId: targetNotifUser,
          type: 'TASK_UNASSIGNED',
          title: notifTitle,
          message: trimmedReason
            ? `${actorLabel} ${isCollaboratorDrop ? 'dropped' : 'unassigned you from'} task "${existingTask.title}". Reason: ${trimmedReason}`
            : `${actorLabel} ${isCollaboratorDrop ? 'dropped' : 'unassigned you from'} task "${existingTask.title}". It is now Unassigned and Open.`,
          readStatus: false,
          referenceId: existingTask.projectId,
          link: isCollaboratorDrop
            ? `/owner/workspace/${existingTask.projectId}`
            : `/collaborator/workspace/${existingTask.projectId}`,
          metadata: {
            taskId: existingTask.id,
            reason: trimmedReason,
            reasons: feedbackRecord?.reasons,
            explanation: feedbackRecord?.explanation,
            ...(existingTask.dueDate ? { dueAt: existingTask.dueDate } : {}),
          },
        });
      } catch {}
    }

    try {
      this.auditService.log({
        action: 'task-unassigned',
        actor: actorLabel,
        target: existingTask.title,
        entityType: 'task',
        entityId: existingTask.id,
        event: trimmedReason
          ? `Task "${existingTask.title}" unassigned/dropped: ${trimmedReason}`
          : `Task "${existingTask.title}" returned to Unassigned`,
        details: { reason: trimmedReason || undefined, reasons: feedbackRecord?.reasons },
      });
    } catch {}

    if (callerUserId && this.projectsService && typeof this.projectsService.recordMemberActivity === 'function') {
      try {
        this.projectsService.recordMemberActivity(existingTask.projectId, String(callerUserId));
      } catch {}
    }

    return this.enrichTaskAssignee(existingTask);
  }

  update(
    id: string,
    updateTaskDto: UpdateTaskDto,
    callerOrId?: any,
    callerRole?: string,
    suppliedProjectId?: string,
  ): Task {
    // 1. Fetch the existing task state so we can detect status changes and project lock
    const existingTask = this.findById(id);
    this.assertTaskProjectMatch(existingTask, suppliedProjectId ?? (updateTaskDto as any)?.projectId);

    const { callerObj, callerUserId, callerRole: effRole } = this.extractCallerContext(callerOrId, callerRole);
    const access = this.getProjectAccessService();
    if (callerObj && access) {
      access.assertMemberOrOwner(callerObj, existingTask.projectId, {
        taskId: id,
        action: 'update_task',
      });
    }

    if (this.projectsService.isLocked(existingTask.projectId)) {
      throw new BadRequestException('Project is locked. Tasks cannot be modified.');
    }

    const parentProject = this.projectsService.findById(existingTask.projectId);
    const { normRole, isOwnerOrAdmin } = this.resolveCallerPrivilege(parentProject, callerUserId, effRole);

    // Phase 13 Role-based field whitelist on PATCH/PUT /tasks/:id
    if (!isOwnerOrAdmin) {
      if (updateTaskDto.dueDate !== undefined && updateTaskDto.dueDate !== existingTask.dueDate) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'Forbidden',
          code: 'FORBIDDEN_FIELD',
          message: 'Only the project owner or administrators can change a task due date.',
        });
      }
      const ownerOnlyFields: Array<keyof UpdateTaskDto> = [
        'title',
        'description',
        'xpReward',
        'priority',
        'difficulty',
        'projectId',
      ];
      for (const field of ownerOnlyFields) {
        if (updateTaskDto[field] !== undefined && updateTaskDto[field] !== (existingTask as any)[field]) {
          throw new ForbiddenException({
            statusCode: 403,
            error: 'Forbidden',
            code: 'FORBIDDEN_FIELD',
            message: `Collaborators cannot modify restricted field "${String(field)}".`,
          });
        }
      }
    }

    this.contentFilterService?.assertClean(
      { title: updateTaskDto.title, description: updateTaskDto.description },
      ['title', 'description'],
      { actorId: String(callerUserId || 'user'), entityType: 'task', entityId: id },
    );

    // Handle self-unassignment when requested via PATCH /tasks/:id
    const isUnassigningViaPatch =
      updateTaskDto.assigneeId === '' ||
      updateTaskDto.assigneeId === 'Unassigned' ||
      updateTaskDto.assignee === 'Unassigned' ||
      updateTaskDto.assigneeName === 'Unassigned';

    if (!isOwnerOrAdmin) {
      // 1. Collaborators can unassign themself (with 24h rule), but cannot reassign to someone else
      if (
        (updateTaskDto.assignee !== undefined && updateTaskDto.assignee !== existingTask.assignee) ||
        (updateTaskDto.assigneeId !== undefined && updateTaskDto.assigneeId !== existingTask.assigneeId) ||
        (updateTaskDto.assigneeName !== undefined && updateTaskDto.assigneeName !== existingTask.assigneeName)
      ) {
        if (isUnassigningViaPatch) {
          return this.unassignTask(
            id,
            updateTaskDto.reason ?? updateTaskDto.rejectionReason,
            callerUserId,
            callerRole,
          );
        }
        throw new ForbiddenException('Collaborators cannot reassign tasks.');
      }

      // 2. Status transition authorization
      if (updateTaskDto.status !== undefined) {
        const targetStatus = this.normaliseStatusValue(updateTaskDto.status);
        if (targetStatus === TaskStatus.Completed) {
          throw new ForbiddenException('Only project owners can approve tasks.');
        }
        if (
          this.isTaskInReview(existingTask) &&
          (targetStatus === TaskStatus.ToDo || targetStatus === TaskStatus.InProgress)
        ) {
          throw new ForbiddenException('Only project owners can reject submitted tasks.');
        }
        if (targetStatus === TaskStatus.InProgress || targetStatus === TaskStatus.InReview) {
          // Enforce collaborator can only start/submit task assigned to them
          const callerUser = callerUserId ? this.usersService.findUserSafe(callerUserId) : null;
          const isMatchId = callerUserId && existingTask.assigneeId && String(existingTask.assigneeId) === String(callerUserId);
          const isMatchName = callerUser && (
            (existingTask.assigneeName && existingTask.assigneeName.toLowerCase() === callerUser.name.toLowerCase()) ||
            (existingTask.assignee && existingTask.assignee.toLowerCase() === callerUser.name.toLowerCase())
          );
          if (!isMatchId && !isMatchName) {
            throw new ForbiddenException('You cannot start or submit a task that is not assigned to you.');
          }
        }
      }
    } else if (isUnassigningViaPatch && !updateTaskDto.status) {
      // Allow owner unassignment of To Do / In Progress via PATCH too if status not specified
      const sClean = String(existingTask.status || '').toLowerCase().replace(/[\s-_]/g, '');
      if (sClean === 'inreview' || sClean === 'completed' || sClean === 'approved' || sClean === 'done') {
        throw new BadRequestException('Cannot reassign a task that is already in progress, in review, or completed.');
      }
    }

    if (
      updateTaskDto.assignee !== undefined ||
      updateTaskDto.assigneeId !== undefined ||
      updateTaskDto.assigneeName !== undefined
    ) {
      // Phase 3a: reject reassignment of tasks that are In Progress, In Review, or Approved
      const statusClean = String(existingTask.status || '').toLowerCase().replace(/[\s-_]/g, '');
      const isStatusLocked =
        statusClean === 'inprogress' ||
        statusClean === 'inreview' ||
        statusClean === 'completed' ||
        statusClean === 'approved' ||
        statusClean === 'done';
      if (isStatusLocked) {
        const isChangingAssignee =
          (updateTaskDto.assigneeId !== undefined && String(updateTaskDto.assigneeId) !== String(existingTask.assigneeId)) ||
          (updateTaskDto.assigneeName !== undefined && String(updateTaskDto.assigneeName) !== String(existingTask.assigneeName)) ||
          (updateTaskDto.assignee !== undefined && String(updateTaskDto.assignee) !== String(existingTask.assignee));
        if (isChangingAssignee) {
          throw new BadRequestException('Cannot reassign a task that is already in progress, in review, or completed.');
        }
      }

      if (isUnassigningViaPatch) {
        updateTaskDto.assigneeId = undefined;
        updateTaskDto.assigneeName = 'Unassigned';
        updateTaskDto.assignee = 'Unassigned';
      } else {
        this.validateTaskAssignee(
          existingTask.projectId,
          updateTaskDto.assignee || updateTaskDto.assigneeName,
          updateTaskDto.assigneeId,
        );

        let targetId = updateTaskDto.assigneeId;
        let targetName = updateTaskDto.assigneeName || updateTaskDto.assignee;

        if (targetId && (!targetName || targetName === 'Unassigned')) {
          const user = this.usersService.findUserSafe(targetId);
          if (user) targetName = user.name;
        } else if (targetName && targetName.toLowerCase() !== 'unassigned' && !targetId) {
          const user = this.usersService
            .findAll()
            .find(
              (u) =>
                (u.name && u.name.toLowerCase() === targetName!.toLowerCase()) ||
                String(u.id) === targetName,
            );
          if (user) targetId = String(user.id);
        }

        updateTaskDto.assigneeId = targetId;
        updateTaskDto.assigneeName = targetName;
        updateTaskDto.assignee = targetName;
      }
    }

    // Phase 4 + 13: Due date change enforcement (owner/admin only)
    if (updateTaskDto.dueDate !== undefined && updateTaskDto.dueDate !== existingTask.dueDate) {
      if (!isOwnerOrAdmin) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'Forbidden',
          code: 'FORBIDDEN_FIELD',
          message: 'Only the project owner or administrators can change a task due date.',
        });
      }

      const isApproved = this.isTaskCompleted(existingTask);
      if (isApproved) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          code: 'DUE_DATE_LOCKED',
          message: 'Task due date is locked because the task has already been approved.',
        });
      }

      const now = this.clockService ? this.clockService.now() : new Date();
      const existingDueTime = existingTask.dueDate ? new Date(existingTask.dueDate).getTime() : 0;
      if (existingDueTime && existingDueTime < now.getTime()) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          code: 'DUE_DATE_LOCKED',
          message: 'Task due date is locked because the due date has already passed.',
        });
      }

      if (!updateTaskDto.dueDate) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          code: 'DUE_DATE_REQUIRED',
          message: 'Task due date is required.',
        });
      }
      const newDueTime = new Date(updateTaskDto.dueDate).getTime();
      if (isNaN(newDueTime)) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          code: 'DUE_DATE_REQUIRED',
          message: 'Invalid task due date format.',
        });
      }
      const todayMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0);
      if (newDueTime < todayMidnight) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          code: 'DUE_DATE_PAST',
          message: 'Task due date cannot be in the past.',
        });
      }

      if (parentProject?.dueDate) {
        const projectDueTime = new Date(parentProject.dueDate).getTime();
        if (!isNaN(projectDueTime) && newDueTime > projectDueTime) {
          throw new BadRequestException({
            statusCode: 400,
            error: 'Bad Request',
            code: 'DUE_DATE_AFTER_PROJECT',
            message: "Task due date cannot be after the project's due date.",
          });
        }
      }
    }

    // 2. Validate any proof links before touching the repository
    if (updateTaskDto.proofLink !== undefined && updateTaskDto.proofLink !== null && updateTaskDto.proofLink !== '') {
      assertSafeHttpUrl(updateTaskDto.proofLink, 'proofLink', callerUserId, this.auditService);
    }
    if (updateTaskDto.proofUrl !== undefined && updateTaskDto.proofUrl !== null && updateTaskDto.proofUrl !== '') {
      assertSafeHttpUrl(updateTaskDto.proofUrl, 'proofUrl', callerUserId, this.auditService);
    }

    // Delegate In Review -> Completed/Approved through canonical approveTask
    const targetNormStatus = updateTaskDto.status !== undefined
      ? this.normaliseStatusValue(updateTaskDto.status)
      : undefined;
    const cleanIncomingStatus = String(updateTaskDto.status || '').toLowerCase().replace(/[\s-_]/g, '');
    const isApproval =
      targetNormStatus === TaskStatus.Completed ||
      cleanIncomingStatus === 'completed' ||
      cleanIncomingStatus === 'approved' ||
      cleanIncomingStatus === 'done';

    if (isApproval) {
      const { status: _st, reason: _r, rejectionReason: _rr, ...nonStatusUpdates } = updateTaskDto as any;
      return this.approveTask(id, {
        actorId: callerUserId,
        actorRole: callerRole,
        autoApproved: false,
        extraUpdates: nonStatusUpdates,
      });
    }

    // Delegate In Review -> To Do / Open / In Progress through canonical rejectTask
    if (
      this.isTaskInReview(existingTask) &&
      (targetNormStatus === TaskStatus.ToDo || targetNormStatus === TaskStatus.InProgress)
    ) {
      return this.rejectTask(
        id,
        updateTaskDto.reason ?? updateTaskDto.rejectionReason,
        callerUserId,
        callerRole,
        targetNormStatus,
      );
    }

    // Strip non-assignable / system-managed fields from external payload
    const {
      projectId: _ignoredProjectId,
      reason: _ignoredReason,
      rejectionReason: _ignoredRejReason,
      xpAwarded: _x1,
      awardedXp: _x2,
      awardedRep: _x3,
      autoApproved: _x4,
      rejectionHistory: _x5,
      inReviewSince: _x6,
      reviewReminderSentAt: _x7,
      rejectedAt: _x8,
      rejectedBy: _x9,
      assignedAt: _x10,
      approvedAt: _x11,
      ...sanitizedDto
    } = updateTaskDto as any;

    const nowIso = this.clockService ? this.clockService.nowIso() : new Date().toISOString();
    const persistPayload: any = { ...sanitizedDto };
    if (isUnassigningViaPatch) {
      persistPayload.assignedAt = undefined;
    } else if (
      updateTaskDto.assigneeId &&
      String(updateTaskDto.assigneeId).toLowerCase() !== 'unassigned' &&
      (String(updateTaskDto.assigneeId) !== String(existingTask.assigneeId || '') ||
        !existingTask.assignedAt)
    ) {
      persistPayload.assignedAt = nowIso;
    }
    if (targetNormStatus) {
      persistPayload.status = targetNormStatus;
    }

    // Track review submission timestamps & clear stale visible rejection on new submission (preserving history)
    if (targetNormStatus === TaskStatus.InReview) {
      persistPayload.inReviewSince = this.isTaskInReview(existingTask)
        ? (existingTask.inReviewSince || nowIso)
        : nowIso;
      persistPayload.submittedAt = persistPayload.inReviewSince;
      persistPayload.reviewReminderSentAt = undefined;
      persistPayload.rejectionReason = undefined;
      persistPayload.rejectedAt = undefined;
      persistPayload.rejectedBy = undefined;
    }

    if (updateTaskDto.dueDate !== undefined && updateTaskDto.dueDate !== existingTask.dueDate) {
      const history = Array.isArray(existingTask.dueDateHistory) ? [...existingTask.dueDateHistory] : [];
      history.push({
        previousDueDate: existingTask.dueDate || '',
        newDueDate: updateTaskDto.dueDate,
        creditMs: 0,
        reason: 'Owner update',
        at: nowIso,
      });
      persistPayload.dueDateHistory = history;
    }

    const updatedTask = this.tasksRepository.update(id, persistPayload);
    if (!updatedTask) {
      throw new NotFoundException(`Task with ID ${id} not found.`);
    }

    this.projectsService.recalculateAndPersistProgress(existingTask.projectId);

    try {
      if (updateTaskDto.assignee && updateTaskDto.assignee !== existingTask.assignee) {
        this.auditService.log({
          action: 'task-assigned',
          actor: 'Owner',
          target: updatedTask.title,
          entityType: 'task',
          entityId: updatedTask.id,
          event: `Task "${updatedTask.title}" was assigned to ${updatedTask.assignee}`,
          details: { assignee: updatedTask.assignee },
        });

        if (updatedTask.assigneeId && updatedTask.assigneeId.toLowerCase() !== 'unassigned') {
          try {
            let projectName = 'Project';
            try {
              if (parentProject) projectName = parentProject.title || parentProject.name || 'Project';
            } catch (err: any) {
              console.warn('[tasks.service] Suppressed non-critical error:', err?.message || err);
            }
            this.notificationsService.create({
              userId: String(updatedTask.assigneeId),
              type: 'TASK_ASSIGNED',
              title: 'Task Assigned',
              message: `You were assigned to task "${updatedTask.title}" in project "${projectName}".`,
              readStatus: false,
              referenceId: updatedTask.projectId,
              link: `/collaborator/workspace/${updatedTask.projectId}`,
            });
          } catch (err: any) {
            console.warn('[tasks.service] Suppressed non-critical error:', err?.message || err);
          }
        }
      }
      if (updateTaskDto.status && updatedTask.status !== existingTask.status) {
        const s = String(updatedTask.status || '').toLowerCase();
        const sClean = s.replace(/[\s-_]/g, '');
        let auditAction = 'task-status-updated';
        let auditText = `Task "${updatedTask.title}" status changed to ${updatedTask.status}`;
        if (sClean === 'inprogress') {
          auditAction = 'task-started';
          auditText = `Task "${updatedTask.title}" was started by ${updatedTask.assignee || 'collaborator'}`;
        } else if (sClean === 'inreview' || sClean === 'submitted') {
          auditAction = 'task-submitted';
          auditText = `Deliverables submitted for task "${updatedTask.title}"`;

          try {
            if (parentProject?.ownerId) {
              this.notificationsService.create({
                userId: String(parentProject.ownerId),
                type: 'TASK_SUBMITTED',
                title: 'Task Deliverables Submitted',
                message: `${updatedTask.assignee || 'Collaborator'} submitted deliverables for task "${updatedTask.title}".`,
                readStatus: false,
                referenceId: updatedTask.projectId,
                link: `/owner/workspace/${updatedTask.projectId}`,
              });
            }
          } catch (err: any) {
            console.warn('[tasks.service] Suppressed non-critical error:', err?.message || err);
          }
        }
        this.auditService.log({
          action: auditAction,
          actor: updatedTask.assignee || 'User',
          target: updatedTask.title,
          entityType: 'task',
          entityId: updatedTask.id,
          event: auditText,
          details: { status: updatedTask.status },
        });
      }
    } catch (err: any) {
      console.warn('[tasks.service] Suppressed non-critical error:', err?.message || err);
    }

    if (callerUserId && this.projectsService && typeof this.projectsService.recordMemberActivity === 'function') {
      try {
        this.projectsService.recordMemberActivity(existingTask.projectId, String(callerUserId));
      } catch {}
    }

    return this.enrichTaskAssignee(updatedTask);
  }

  /**
   * Status update. Accepts a `status` string (aliases allowed) and optional proof/notes/reason.
   * Delegates the actual persistence, rejection validation & XP handling to {@link update}.
   */
  updateStatus(
    id: string,
    payload: UpdateTaskStatusDto,
    callerOrId?: any,
    callerRole?: string,
    suppliedProjectId?: string,
  ): Task {
    const { callerUserId } = this.extractCallerContext(callerOrId, callerRole);
    const normalised = this.normaliseIncomingStatus(payload);
    const updatePayload: UpdateTaskDto = { status: normalised };
    if (payload.projectId !== undefined) {
      updatePayload.projectId = payload.projectId;
    }
    if (payload.proofLink !== undefined || payload.proofUrl !== undefined) {
      const linkToValidate = payload.proofLink || payload.proofUrl;
      if (linkToValidate) {
        assertSafeHttpUrl(linkToValidate, 'proofLink', callerUserId, this.auditService);
      }
      updatePayload.proofLink = payload.proofLink || payload.proofUrl;
      updatePayload.proofUrl = payload.proofUrl || payload.proofLink;
    }
    if (payload.notes !== undefined) {
      updatePayload.notes = payload.notes;
    }
    if (payload.reason !== undefined) {
      updatePayload.reason = payload.reason;
    }
    if (payload.rejectionReason !== undefined) {
      updatePayload.rejectionReason = payload.rejectionReason;
    }
    return this.update(id, updatePayload, callerOrId, callerRole, suppliedProjectId);
  }

  private normaliseIncomingStatus(payload: UpdateTaskStatusDto): TaskStatus {
    if (payload?.status) {
      const key = payload.status.trim().toLowerCase();
      const cleanKey = key.replace(/[\s-_]/g, '');
      const mapped = STATUS_ALIASES[cleanKey] || STATUS_ALIASES[key];
      if (mapped) return mapped;
      // Also accept the raw enum values.
      const rawMatch = Object.values(TaskStatus).find(
        (value) => value.toLowerCase().replace(/[\s-_]/g, '') === cleanKey,
      );
      if (rawMatch) return rawMatch as TaskStatus;
    }
    throw new BadRequestException('Provide a valid status value.');
  }

  delete(id: string, callerOrId?: any, callerRole?: string, suppliedProjectId?: string): void {
    const existingTask = this.findById(id);
    this.assertTaskProjectMatch(existingTask, suppliedProjectId);
    const { callerObj, callerUserId } = this.extractCallerContext(callerOrId, callerRole);
    const access = this.getProjectAccessService();
    if (callerObj && access) {
      access.assertOwnerOrAdmin(callerObj, existingTask.projectId, {
        taskId: id,
        action: 'delete_task',
      });
    } else if (access) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Forbidden resource',
      });
    }
    if (this.projectsService.isLocked(existingTask.projectId)) {
      throw new BadRequestException('Project is locked. Tasks cannot be deleted.');
    }
    const statusLower = String(existingTask.status || '').trim().toLowerCase();
    const isApprovedOrCompleted =
      ['approved', 'completed', 'done'].includes(statusLower) ||
      Boolean(existingTask.approvedAt);
    if (isApprovedOrCompleted) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'TASK_APPROVED',
        message: 'Cannot delete an approved task.',
      });
    }

    const hasAssignee = Boolean(
      (existingTask.assigneeId && String(existingTask.assigneeId).trim().toLowerCase() !== 'unassigned') ||
      (existingTask.assignedTo && String(existingTask.assignedTo).trim().toLowerCase() !== 'unassigned') ||
      (existingTask.assignee && String(existingTask.assignee).trim().toLowerCase() !== 'unassigned') ||
      (existingTask.assigneeName && String(existingTask.assigneeName).trim().toLowerCase() !== 'unassigned')
    );
    if (hasAssignee) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'TASK_ASSIGNED',
        message: 'Cannot delete an assigned task. Unassign the task before deleting.',
      });
    }

    const isDeleted = this.tasksRepository.delete(id);
    if (!isDeleted) {
      throw new NotFoundException(`Task with ID ${id} not found.`);
    }
    this.projectsService.recalculateAndPersistProgress(existingTask.projectId);
    if (callerUserId && this.projectsService && typeof this.projectsService.recordMemberActivity === 'function') {
      try {
        this.projectsService.recordMemberActivity(existingTask.projectId, String(callerUserId));
      } catch {}
    }
  }

  addComment(
    id: string,
    commentText: string,
    callerOrId?: any,
    callerRole?: string,
    suppliedProjectId?: string,
  ): Task {
    const existingTask = this.findById(id);
    this.assertTaskProjectMatch(existingTask, suppliedProjectId);
    const { callerObj, callerUserId } = this.extractCallerContext(callerOrId, callerRole);
    const access = this.getProjectAccessService();
    if (callerObj && access) {
      access.assertMemberOrOwner(callerObj, existingTask.projectId, {
        taskId: id,
        action: 'comment_task',
      });
    }
    if (this.projectsService.isLocked(existingTask.projectId)) {
      throw new BadRequestException('Project is locked. Comments cannot be added.');
    }
    const trimmed = (commentText || '').trim();
    if (!trimmed) {
      throw new BadRequestException('Comment text is required.');
    }
    this.contentFilterService?.assertClean(
      { text: trimmed },
      ['text'],
      { actorId: String(callerUserId || 'user'), entityType: 'task_comment', entityId: id },
    );
    const nowIso = this.clockService ? this.clockService.nowIso() : new Date().toISOString();
    const comments = Array.isArray((existingTask as any).comments) ? [...(existingTask as any).comments] : [];
    comments.push({
      id: `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId: callerUserId || 'anonymous',
      text: trimmed,
      createdAt: nowIso,
    });
    const updatedTask = this.tasksRepository.update(id, { comments } as any) || existingTask;
    if (callerUserId && this.projectsService && typeof this.projectsService.recordMemberActivity === 'function') {
      try {
        this.projectsService.recordMemberActivity(existingTask.projectId, String(callerUserId));
      } catch {}
    }
    return this.enrichTaskAssignee(updatedTask);
  }
}
