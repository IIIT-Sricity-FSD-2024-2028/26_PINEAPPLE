import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { TasksRepository, Task } from './tasks.repository';
import { CreateTaskDto, TaskStatus } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { GamificationService } from '../gamification/gamification.service';
import { ProjectsService } from '../projects/projects.service';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { normalizeRole } from '../core/guards/roles.guard';
import { PlatformConfigService } from '../platform-config/platform-config.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Single canonical XP & Reputation calculation function reading Platform Config:
 * Low: 0.5x, Medium: 1x, High: 2x standard XP; Rep +8
 */
export function calculateTaskXp(
  priority?: string,
  standardXp = 50,
): { xp: number; rep: number } {
  const p = (priority || '').trim().toLowerCase();
  let multiplier = 1.0;
  if (p === 'high' || p === 'advanced') {
    multiplier = 2.0;
  } else if (p === 'low' || p === 'beginner') {
    multiplier = 0.5;
  } else {
    // Medium, intermediate, or unspecified
    multiplier = 1.0;
  }
  return {
    xp: Math.round(multiplier * standardXp),
    rep: 8,
  };
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
  constructor(
    private readonly tasksRepository: TasksRepository,
    private readonly gamificationService: GamificationService,
    @Inject(forwardRef(() => ProjectsService))
    private readonly projectsService: ProjectsService,
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
    private readonly platformConfigService: PlatformConfigService,
    private readonly notificationsService: NotificationsService,
  ) {}

  onApplicationBootstrap() {
    try {
      this.recalculateUserStats();
    } catch (e) {
      console.warn('Initial user stats recalculation notice:', e);
    }
  }

  recalculateUserStats(userId?: string): void {
    const users = userId ? [this.usersService.findById(userId)] : this.usersService.findAll();
    const allTasks = this.tasksRepository.findAll();
    const standardXp = this.platformConfigService.getConfig().xpPerTaskCompletion || 50;

    for (const user of users) {
      if (!user) continue;
      const uid = String(user.id);
      const uName = (user.name || '').toLowerCase();
      const uEmail = (user.email || '').toLowerCase();

      const userApprovedTasks = allTasks.filter((t) => {
        const tStatus = String(t.status || '').toLowerCase().replace(/[\s-_]/g, '');
        const isDone = tStatus === 'completed' || tStatus === 'approved' || tStatus === 'done';
        if (!isDone) return false;
        const aId = String(t.assigneeId || '');
        const aName = (t.assigneeName || t.assignee || t.assignedTo || '').toLowerCase();
        return aId === uid || aName === uName || aName === uEmail;
      });

      let totalTaskXp = 0;
      let totalTaskRep = 0;
      userApprovedTasks.forEach((t) => {
        const { xp, rep } = calculateTaskXp(t.priority || t.difficulty, standardXp);
        totalTaskXp += xp;
        totalTaskRep += rep;
        if (!t.xpAwarded) {
          t.xpAwarded = true;
          t.awardedXp = xp;
          t.awardedRep = rep;
        }
      });

      const currentProfileXp = Number(user.profile?.xp || 0);
      const finalXp = userApprovedTasks.length > 0 && currentProfileXp === 0 ? totalTaskXp : Math.max(currentProfileXp, totalTaskXp);
      const currentProfileRep = Number(user.profile?.rep || 0);
      const finalRep = userApprovedTasks.length > 0 && currentProfileRep === 0 ? totalTaskRep : Math.max(currentProfileRep, totalTaskRep);
      const finalTasksCount = Math.max(Number(user.profile?.tasksCount || 0), userApprovedTasks.length);

      this.usersService.update(user.id, {
        profile: {
          ...user.profile,
          xp: finalXp,
          rep: finalRep,
          tasksCount: finalTasksCount,
        },
      } as any);
      (user as any).xp = finalXp;
      (user as any).rep = finalRep;
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
            const project = this.projectsService.findById(task.projectId);
            const collabs = Array.isArray(project.collaborators) ? project.collaborators : [];
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
          } catch {
            /* ignore */
          }
        }
      }
    } else if ((task.assignee || task.assigneeName) && (!task.assigneeId || task.assigneeId.toLowerCase() === 'unassigned')) {
      // 2. Old tasks with only a name: map name to id once, using the project members / users
      const rawName = (task.assigneeName || task.assignee || '').trim();
      if (rawName && rawName.toLowerCase() !== 'unassigned') {
        try {
          const project = this.projectsService.findById(task.projectId);
          const collabs = Array.isArray(project.collaborators) ? project.collaborators : [];
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
        } catch {
          /* ignore */
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

  findAllByProjectId(projectId: string): Task[] {
    return this.tasksRepository.findAllByProjectId(projectId).map((t) => this.enrichTaskAssignee(t));
  }

  resetUnapprovedTasksForUser(projectId: string, userIdOrName: string): Task[] {
    const projectTasks = this.tasksRepository.findAllByProjectId(projectId);
    const affected: Task[] = [];
    const target = (userIdOrName || '').trim().toLowerCase();
    if (!target) return affected;

    for (const task of projectTasks) {
      const isAssigned =
        (task.assigneeId && task.assigneeId.toLowerCase() === target) ||
        (task.assigneeName && task.assigneeName.toLowerCase() === target) ||
        (task.assignee && task.assignee.toLowerCase() === target);

      const isCompleted =
        task.status === TaskStatus.Completed ||
        (typeof task.status === 'string' && task.status.toLowerCase() === 'completed');

      if (isAssigned && !isCompleted) {
        task.assignee = 'Unassigned';
        task.assigneeName = 'Unassigned';
        task.assigneeId = undefined;
        task.status = TaskStatus.ToDo;
        affected.push(task);
      }
    }
    return affected;
  }

  findAll(): Task[] {
    return this.tasksRepository.findAll().map((t) => this.enrichTaskAssignee(t));
  }

  findById(id: string): Task {
    const task = this.tasksRepository.findById(id);
    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found.`);
    }
    return this.enrichTaskAssignee(task);
  }

  create(createTaskDto: CreateTaskDto): Task {
    if (this.projectsService.isLocked(createTaskDto.projectId)) {
      throw new BadRequestException('Project is locked. Tasks cannot be created.');
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

    const created = this.tasksRepository.create({
      ...createTaskDto,
      assigneeId: assigneeId || undefined,
      assigneeName: assigneeName || 'Unassigned',
      assignee: assigneeName || 'Unassigned',
      assignedTo: assigneeName || 'Unassigned',
    });
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
    } catch { /* non-critical */ }

    if (created.assigneeId && created.assigneeId.toLowerCase() !== 'unassigned') {
      try {
        let projectName = 'Project';
        try {
          const p = this.projectsService.findById(created.projectId);
          if (p) projectName = p.title || p.name || 'Project';
        } catch { /* ignore */ }
        this.notificationsService.create({
          userId: String(created.assigneeId),
          type: 'TASK_ASSIGNED',
          title: 'Task Assigned',
          message: `You were assigned to task "${created.title}" in project "${projectName}".`,
          readStatus: false,
          referenceId: created.projectId,
        });
      } catch { /* non-critical */ }
    }

    return this.enrichTaskAssignee(created);
  }

  update(id: string, updateTaskDto: UpdateTaskDto, callerUserId?: string, callerRole?: string): Task {
    // 1. Fetch the existing task state so we can detect status changes and project lock
    const existingTask = this.findById(id);

    if (this.projectsService.isLocked(existingTask.projectId)) {
      throw new BadRequestException('Project is locked. Tasks cannot be modified.');
    }

    const normRole = callerRole ? normalizeRole(callerRole) : undefined;
    if (normRole === 'collaborator') {
      // 1. Collaborators cannot reassign tasks
      if (
        (updateTaskDto.assignee !== undefined && updateTaskDto.assignee !== existingTask.assignee) ||
        (updateTaskDto.assigneeId !== undefined && updateTaskDto.assigneeId !== existingTask.assigneeId) ||
        (updateTaskDto.assigneeName !== undefined && updateTaskDto.assigneeName !== existingTask.assigneeName)
      ) {
        throw new ForbiddenException('Collaborators cannot reassign tasks.');
      }

      // 2. Status transition authorization
      if (updateTaskDto.status !== undefined) {
        const targetStatus = this.normaliseStatusValue(updateTaskDto.status);
        if (targetStatus === TaskStatus.Completed) {
          throw new ForbiddenException('Only project owners can approve tasks.');
        }
        if (
          (existingTask.status === TaskStatus.InReview || String(existingTask.status).toLowerCase() === 'in review') &&
          targetStatus === TaskStatus.ToDo
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

      const isUnassigning =
        updateTaskDto.assigneeId === '' ||
        updateTaskDto.assigneeId === 'Unassigned' ||
        updateTaskDto.assignee === 'Unassigned' ||
        updateTaskDto.assigneeName === 'Unassigned';

      if (isUnassigning) {
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

    // 2. Execute the update in the repository
    const updatedTask = this.tasksRepository.update(id, updateTaskDto);
    if (!updatedTask) {
      throw new NotFoundException(`Task with ID ${id} not found.`);
    }

    // 3. Cross-Module Gamification Integration
    // Trigger XP and Reputation rewards when task transitions to 'Completed' / 'Approved'
    const cleanStatus = String(updateTaskDto.status || '').toLowerCase().replace(/[\s-_]/g, '');
    const isApproval =
      updateTaskDto.status === TaskStatus.Completed ||
      cleanStatus === 'completed' ||
      cleanStatus === 'approved' ||
      cleanStatus === 'done';
    const isAlreadyAwarded = Boolean(existingTask.xpAwarded || updatedTask.xpAwarded);

    if (isApproval && !isAlreadyAwarded) {
      const priorityRaw = (
        updatedTask.priority ||
        updatedTask.difficulty ||
        existingTask.priority ||
        existingTask.difficulty ||
        ''
      )
        .trim()
        .toLowerCase();

      const standardXp = this.platformConfigService.getConfig().xpPerTaskCompletion || 50;
      const { xp: xpReward, rep: repReward } = calculateTaskXp(priorityRaw, standardXp);

      // Idempotency: Mark as awarded immediately on both task instance and repository
      updatedTask.xpAwarded = true;
      updatedTask.awardedXp = xpReward;
      updatedTask.awardedRep = repReward;
      this.tasksRepository.update(id, {
        xpAwarded: true,
        awardedXp: xpReward,
        awardedRep: repReward,
      });

      let userIdToAward = updatedTask.assigneeId || existingTask.assigneeId;
      const targetAssigneeName = updatedTask.assignee || existingTask.assignee;

      if (!userIdToAward && targetAssigneeName && targetAssigneeName.toLowerCase() !== 'unassigned') {
        const foundUser = this.usersService.findAll().find(
          (u) => u.name?.toLowerCase() === targetAssigneeName.toLowerCase() || u.id === targetAssigneeName,
        );
        userIdToAward = foundUser ? foundUser.id : targetAssigneeName;
      }

      if (userIdToAward && userIdToAward.toLowerCase() !== 'unassigned') {
        this.gamificationService.awardXp(
          userIdToAward,
          xpReward,
          `Task Approved: ${updatedTask.title}`,
        );
        this.gamificationService.updateReputation(
          userIdToAward,
          repReward,
          `Task Approved: ${updatedTask.title}`,
        );

        try {
          const userObj = this.usersService.findById(userIdToAward);
          if (userObj) {
            const currentXp = (userObj.profile?.xp || 0) + xpReward;
            const currentRep = (userObj.profile?.rep || 0) + repReward;
            const currentTasksCount = (userObj.profile?.tasksCount || 0) + 1;

            let projectName = 'Project';
            try {
              const project = this.projectsService.findById(updatedTask.projectId);
              if (project) projectName = (project as any).title || (project as any).name || 'Project';
            } catch {
              // Ignore if project lookup fails
            }

            const existingProjects = Array.isArray(userObj.data?.projects) ? [...userObj.data.projects] : [];
            const projIdx = existingProjects.findIndex((p: any) => p.name === projectName || p.id === updatedTask.projectId);
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
                xp: currentXp,
                rep: currentRep,
                tasksCount: currentTasksCount,
              },
              data: {
                ...userObj.data,
                projects: existingProjects,
              },
            } as any);
            (userObj as any).xp = currentXp;
            (userObj as any).rep = currentRep;
          }
        } catch (err) {
          // Silently ignore if user record lookup fails
        }
      }
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
              const p = this.projectsService.findById(updatedTask.projectId);
              if (p) projectName = p.title || p.name || 'Project';
            } catch { /* ignore */ }
            this.notificationsService.create({
              userId: String(updatedTask.assigneeId),
              type: 'TASK_ASSIGNED',
              title: 'Task Assigned',
              message: `You were assigned to task "${updatedTask.title}" in project "${projectName}".`,
              readStatus: false,
              referenceId: updatedTask.projectId,
            });
          } catch { /* non-critical */ }
        }
      }
      if (updateTaskDto.status && updateTaskDto.status !== existingTask.status) {
        const s = String(updateTaskDto.status).toLowerCase();
        const sClean = s.replace(/[\s-_]/g, '');
        let auditAction = 'task-status-updated';
        let auditText = `Task "${updatedTask.title}" status changed to ${updateTaskDto.status}`;
        if (sClean === 'inprogress') {
          auditAction = 'task-started';
          auditText = `Task "${updatedTask.title}" was started by ${updatedTask.assignee || 'collaborator'}`;
        } else if (sClean === 'inreview' || sClean === 'submitted') {
          auditAction = 'task-submitted';
          auditText = `Deliverables submitted for task "${updatedTask.title}"`;

          try {
            const project = this.projectsService.findById(updatedTask.projectId);
            if (project?.ownerId) {
              this.notificationsService.create({
                userId: String(project.ownerId),
                type: 'TASK_SUBMITTED',
                title: 'Task Deliverables Submitted',
                message: `${updatedTask.assignee || 'Collaborator'} submitted deliverables for task "${updatedTask.title}".`,
                readStatus: false,
                referenceId: updatedTask.projectId,
              });
            }
          } catch { /* non-critical */ }
        } else if (sClean === 'completed' || sClean === 'approved' || sClean === 'done') {
          auditAction = 'task-approved';
          auditText = `Task "${updatedTask.title}" was approved by owner (+XP awarded)`;

          try {
            const awardTarget = updatedTask.assigneeId || existingTask.assigneeId;
            if (awardTarget && awardTarget.toLowerCase() !== 'unassigned') {
              this.notificationsService.create({
                userId: String(awardTarget),
                type: 'TASK_APPROVED',
                title: 'Task Approved',
                message: `🎉 Your submission for "${updatedTask.title}" was approved!`,
                readStatus: false,
                referenceId: updatedTask.projectId,
              });
            }
          } catch { /* non-critical */ }
        } else if (String(existingTask.status).toLowerCase().replace(/[\s-_]/g, '') === 'inreview' && (sClean === 'open' || sClean === 'todo' || sClean === 'inprogress')) {
          auditAction = 'task-rejected';
          auditText = `Submission for task "${updatedTask.title}" was requested for revisions`;

          try {
            const revTarget = updatedTask.assigneeId || existingTask.assigneeId;
            if (revTarget && revTarget.toLowerCase() !== 'unassigned') {
              this.notificationsService.create({
                userId: String(revTarget),
                type: 'TASK_REJECTED',
                title: 'Task Revision Requested',
                message: `⚠️ Your submission for task "${updatedTask.title}" was requested for revisions.`,
                readStatus: false,
                referenceId: updatedTask.projectId,
              });
            }
          } catch { /* non-critical */ }
        }
        this.auditService.log({
          action: auditAction,
          actor: updatedTask.assignee || 'User',
          target: updatedTask.title,
          entityType: 'task',
          entityId: updatedTask.id,
          event: auditText,
          details: { status: updateTaskDto.status },
        });
      }
    } catch { /* non-critical */ }

    return this.enrichTaskAssignee(updatedTask);
  }

  /**
   * Status update. Accepts a `status` string (aliases allowed) and optional proof/notes.
   * Delegates the actual persistence & XP handling to {@link update}.
   *
   * @throws BadRequestException when `status` is not provided or not recognisable.
   */
  updateStatus(id: string, payload: UpdateTaskStatusDto, callerUserId?: string, callerRole?: string): Task {
    const normalised = this.normaliseIncomingStatus(payload);
    const updatePayload: UpdateTaskDto = { status: normalised };
    if (payload.proofLink !== undefined || payload.proofUrl !== undefined) {
      updatePayload.proofLink = payload.proofLink || payload.proofUrl;
      updatePayload.proofUrl = payload.proofUrl || payload.proofLink;
    }
    if (payload.notes !== undefined) {
      updatePayload.notes = payload.notes;
    }
    return this.update(id, updatePayload, callerUserId, callerRole);
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

  delete(id: string): void {
    const existingTask = this.findById(id);
    if (this.projectsService.isLocked(existingTask.projectId)) {
      throw new BadRequestException('Project is locked. Tasks cannot be deleted.');
    }
    const isDeleted = this.tasksRepository.delete(id);
    if (!isDeleted) {
      throw new NotFoundException(`Task with ID ${id} not found.`);
    }
    this.projectsService.recalculateAndPersistProgress(existingTask.projectId);
  }
}
