import {
  Injectable,
  Inject,
  Optional,
  forwardRef,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  PROJECT_CATEGORIES,
  STARTER_TASK_CONSTRAINTS,
  STARTER_TASK_TEMPLATES,
  StarterTaskEffort,
  StarterTaskTemplateItem,
  normalizeProjectCategory,
} from './config/starter-task-templates.config';
import { ProjectsRepository } from './projects.repository';
import { isProjectLocked, isVisibleProject } from './project-visibility.util';
import { TasksService } from '../tasks/tasks.service';
import { TaskStatus } from '../tasks/dto/create-task.dto';
import { JoinRequestsService } from '../join-requests/join-requests.service';
import { AuditService } from '../audit/audit.service';
import { ClockService } from '../common/services/clock.service';
import { isProjectOwner, isPlatformAdminOrSuperUser } from '../common/utils/role.util';
import { ApplyTaskTemplatesDto } from './dto/apply-task-templates.dto';

export interface SkippedStarterTaskItem {
  key: string;
  code?: string;
  reason: string;
}

export interface ApplyStarterTemplatesResult {
  created: any[];
  skipped: SkippedStarterTaskItem[];
}

const EFFORT_TO_PRIORITY: Record<StarterTaskEffort, 'Low' | 'Medium' | 'High'> = {
  small: 'Low',
  medium: 'Medium',
  large: 'High',
};

@Injectable()
export class TemplatesService {
  private readonly fallbackQueues = new Map<string, Promise<any>>();
  private readonly templateIndexByKey: Map<string, StarterTaskTemplateItem>;

  constructor(
    private readonly projectsRepository: ProjectsRepository,
    @Inject(forwardRef(() => TasksService))
    private readonly tasksService: any,
    private readonly auditService: AuditService,
    private readonly moduleRef: ModuleRef,
    @Optional()
    @Inject(forwardRef(() => JoinRequestsService))
    private readonly joinRequestsService?: any,
    @Optional()
    private readonly clockService?: ClockService,
  ) {
    this.templateIndexByKey = new Map<string, StarterTaskTemplateItem>();
    for (const category of PROJECT_CATEGORIES) {
      for (const item of STARTER_TASK_TEMPLATES[category] || []) {
        this.templateIndexByKey.set(item.key, item);
      }
    }
  }

  getForCategory(category?: string): {
    category: string;
    items: StarterTaskTemplateItem[];
  } {
    const resolvedCategory = normalizeProjectCategory(category);
    const list = STARTER_TASK_TEMPLATES[resolvedCategory] || STARTER_TASK_TEMPLATES.General;
    return {
      category: resolvedCategory,
      items: list.map((item) => ({ ...item })),
    };
  }

  getAllCategories(): string[] {
    return [...PROJECT_CATEGORIES];
  }

  private isProjectOwnerById(project: any, callerUser: any): boolean {
    if (!project || !callerUser) return false;
    const callerId =
      typeof callerUser === 'string'
        ? callerUser.trim()
        : String(callerUser?.uid || callerUser?.id || callerUser?.userId || callerUser?.sub || '').trim();
    if (!callerId) return false;
    const ownerId =
      project.ownerId !== undefined && project.ownerId !== null
        ? String(project.ownerId).trim()
        : project.owner && typeof project.owner === 'object' && project.owner.id
          ? String(project.owner.id).trim()
          : '';
    return Boolean(ownerId && ownerId === callerId) || isProjectOwner(project, callerUser);
  }

  getTemplatesForProject(
    projectId: string,
    callerUser: any,
    callerRole?: string,
  ): { category: string; items: StarterTaskTemplateItem[] } {
    const callerObj =
      callerUser && typeof callerUser === 'object'
        ? { ...callerUser, role: callerUser.role || callerUser.roleName || callerRole }
        : { uid: callerUser, id: callerUser, role: callerRole };

    const isAdmin = isPlatformAdminOrSuperUser(callerObj);
    const project = this.projectsRepository.findById(projectId);
    if (!project || (!isAdmin && !isVisibleProject(project, { includeDeleted: false }))) {
      throw new NotFoundException(`Project with ID "${projectId}" not found.`);
    }

    const isOwner = this.isProjectOwnerById(project, callerObj);
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Only the project owner or an administrator can view project starter templates.',
      });
    }

    return this.getForCategory(project.category);
  }

  private async runQueued<T>(projectId: string, fn: () => Promise<T> | T): Promise<T> {
    const jq =
      this.joinRequestsService ||
      (() => {
        try {
          return this.moduleRef?.get(JoinRequestsService, { strict: false });
        } catch {
          return undefined;
        }
      })();
    if (jq && typeof jq.runInProjectQueue === 'function') {
      return jq.runInProjectQueue(projectId, fn);
    }

    const key = String(projectId);
    const prev = this.fallbackQueues.get(key) || Promise.resolve();
    const next = prev.then(() => fn());
    const swallow = next.catch(() => {});
    this.fallbackQueues.set(key, swallow);
    try {
      return await next;
    } finally {
      if (this.fallbackQueues.get(key) === swallow) {
        this.fallbackQueues.delete(key);
      }
    }
  }

  private resolveSafeStarterDueDate(project: any): string {
    const now = this.clockService ? this.clockService.now() : new Date();
    const todayMidnight = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0,
      0,
      0,
      0,
    );
    const defaultTargetMs = now.getTime() + 14 * 24 * 60 * 60 * 1000;

    if (project?.dueDate) {
      const projectDueMs = new Date(project.dueDate).getTime();
      if (!Number.isNaN(projectDueMs)) {
        if (projectDueMs >= todayMidnight) {
          return new Date(Math.min(defaultTargetMs, projectDueMs)).toISOString();
        }
        return new Date(defaultTargetMs).toISOString();
      }
    }
    return new Date(defaultTargetMs).toISOString();
  }

  async applyTemplatesForProject(
    projectId: string,
    callerUser: any,
    callerRole: string | undefined,
    dto: ApplyTaskTemplatesDto,
  ): Promise<ApplyStarterTemplatesResult> {
    const callerObj =
      callerUser && typeof callerUser === 'object'
        ? { ...callerUser, role: callerUser.role || callerUser.roleName || callerRole }
        : { uid: callerUser, id: callerUser, role: callerRole };
    const callerId = String(callerObj?.uid || callerObj?.id || '').trim();
    if (!callerId) {
      throw new ForbiddenException('Only the project owner can apply starter task templates.');
    }

    const project = this.projectsRepository.findById(projectId);
    if (!project || !isVisibleProject(project, { includeDeleted: false })) {
      throw new NotFoundException(`Project with ID "${projectId}" not found.`);
    }

    if (!this.isProjectOwnerById(project, callerObj)) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'OWNER_ONLY',
        message: 'Only the project owner can apply starter task templates.',
      });
    }

    if (isProjectLocked(project)) {
      throw new BadRequestException('Project is locked. Starter tasks cannot be added.');
    }

    const keys = Array.isArray(dto?.keys) ? dto.keys : [];
    if (keys.length === 0) {
      throw new BadRequestException('Select at least one starter task template key.');
    }

    const overrides = dto?.overrides && typeof dto.overrides === 'object' ? dto.overrides : {};

    return this.runQueued(projectId, async () => {
      const tasksService =
        this.tasksService || this.moduleRef?.get(TasksService, { strict: false });
      const existingTasks = tasksService.findAllByProjectId(projectId) || [];
      const existingTitles = new Set<string>(
        existingTasks
          .map((t: any) => String(t?.title || '').trim().toLowerCase())
          .filter(Boolean),
      );

      const dueDate = this.resolveSafeStarterDueDate(project);
      const created: any[] = [];
      const skipped: SkippedStarterTaskItem[] = [];

      for (const rawKey of keys) {
        const key = String(rawKey || '').trim();
        const template = key ? this.templateIndexByKey.get(key) : undefined;
        if (!template) {
          skipped.push({
            key: key || String(rawKey || ''),
            code: 'UNKNOWN_TEMPLATE_KEY',
            reason: 'Unknown starter task template key.',
          });
          continue;
        }

        const override = overrides[key];
        const title = String(
          override?.title !== undefined ? override.title : template.title,
        ).trim();
        const description = String(
          override?.description !== undefined ? override.description : template.description,
        ).trim();

        if (
          title.length < STARTER_TASK_CONSTRAINTS.minTitleLength ||
          title.length > STARTER_TASK_CONSTRAINTS.maxTitleLength
        ) {
          skipped.push({
            key,
            code: 'INVALID_TEMPLATE_INPUT',
            reason: `Task title must be between ${STARTER_TASK_CONSTRAINTS.minTitleLength} and ${STARTER_TASK_CONSTRAINTS.maxTitleLength} characters.`,
          });
          continue;
        }

        if (
          description.length < STARTER_TASK_CONSTRAINTS.minDescriptionLength ||
          description.length > STARTER_TASK_CONSTRAINTS.maxDescriptionLength
        ) {
          skipped.push({
            key,
            code: 'INVALID_TEMPLATE_INPUT',
            reason: `Task description must be between ${STARTER_TASK_CONSTRAINTS.minDescriptionLength} and ${STARTER_TASK_CONSTRAINTS.maxDescriptionLength} characters.`,
          });
          continue;
        }

        const normalizedTitle = title.toLowerCase();
        if (existingTitles.has(normalizedTitle)) {
          skipped.push({
            key,
            code: 'TEMPLATE_TASK_EXISTS',
            reason: 'TEMPLATE_TASK_EXISTS: A task with this title already exists in this project.',
          });
          continue;
        }

        const mappedPriority = EFFORT_TO_PRIORITY[template.effort] || 'Medium';

        try {
          const taskOwnerCaller = { uid: callerId, id: callerId, role: 'Project Owner' };
          const createdTask = tasksService.create(
            {
              projectId,
              title,
              description,
              status: TaskStatus.ToDo,
              dueDate,
              priority: mappedPriority,
              difficulty: mappedPriority,
              effort: template.effort,
              starterTemplateKey: template.key,
            },
            taskOwnerCaller,
            'Project Owner',
            { enforceInitialStatus: true },
          );
          created.push(createdTask);
          existingTitles.add(normalizedTitle);
        } catch (err: any) {
          const errResponse = typeof err?.getResponse === 'function' ? err.getResponse() : err?.response;
          const errCode =
            typeof errResponse === 'object' && errResponse !== null
              ? errResponse.code
              : err?.code;
          const errMsg =
            (typeof errResponse === 'object' && errResponse !== null
              ? errResponse.message
              : typeof errResponse === 'string'
                ? errResponse
                : err?.message) || 'Unable to create starter task.';

          skipped.push({
            key,
            ...(errCode ? { code: String(errCode) } : {}),
            reason: errCode && !String(errMsg).includes(String(errCode))
              ? `${errCode}: ${errMsg}`
              : String(errMsg),
          });
        }
      }

      if (created.length > 0) {
        try {
          this.auditService.log({
            action: 'TEMPLATE_TASKS_ADDED',
            actor: project.owner || `User #${callerId}`,
            performedBy: callerId,
            target: project.id,
            entityType: 'project',
            entityId: project.id,
            event: `Added ${created.length} starter task(s) to project ${project.id}`,
            details: {
              projectId: project.id,
              category: normalizeProjectCategory(project.category),
              addedCount: created.length,
              skippedCount: skipped.length,
            },
          });
        } catch {
          // Non-critical audit failure must not revert created starter tasks
        }
      }

      return { created, skipped };
    });
  }
}
