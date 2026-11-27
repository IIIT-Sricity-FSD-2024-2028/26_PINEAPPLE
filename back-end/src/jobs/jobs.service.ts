import { Injectable, Logger, Inject, forwardRef, Optional, ConflictException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClockService } from '../common/services/clock.service';
import { ProjectsService, isLiveProject } from '../projects/projects.service';
import { ProjectsRepository, Project } from '../projects/projects.repository';
import { JoinRequestsService } from '../join-requests/join-requests.service';
import {
  NotificationsService,
  NotificationGroupedItem,
  dispatchGroupedNotification,
  formatGroupedItemList,
} from '../notifications/notifications.service';
import { TasksRepository, Task } from '../tasks/tasks.repository';
import { ReputationService } from '../moderation/reputation.service';
import { MentorMarketplaceService } from '../mentor-marketplace/mentor-marketplace.service';
import { AuditService } from '../audit/audit.service';
import { UsersRepository } from '../users/users.repository';
import { TasksService } from '../tasks/tasks.service';
import { TaskStatus } from '../tasks/dto/create-task.dto';
import { isSafeHttpUrl } from '../common/utils/url.util';
import { JobRunsService, JobRun } from './job-runs.service';
import { ProjectInvitesService } from '../projects/invites.service';
import { ModerationService } from '../moderation/moderation.service';
import { DataExportService } from '../users/data-export.service';
import { StorageHygieneService } from './storage-hygiene.service';
import { SupportService } from '../support/support.service';
import { LeaveRequestsService } from '../projects/leave-requests.service';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  private jobRunsServiceInstance: JobRunsService;
  private schedulerPaused = false;

  constructor(
    private readonly clockService: ClockService,
    @Inject(forwardRef(() => ProjectsService))
    private readonly projectsService: ProjectsService,
    @Inject(forwardRef(() => ProjectsRepository))
    private readonly projectsRepository: ProjectsRepository,
    @Inject(forwardRef(() => JoinRequestsService))
    private readonly joinRequestsService: JoinRequestsService,
    private readonly notificationsService: NotificationsService,
    @Inject(forwardRef(() => TasksRepository))
    private readonly tasksRepository: TasksRepository,
    @Inject(forwardRef(() => ReputationService))
    private readonly reputationService: ReputationService,
    @Inject(forwardRef(() => MentorMarketplaceService))
    private readonly mentorMarketplaceService: MentorMarketplaceService,
    private readonly auditService: AuditService,
    @Optional()
    jobRunsService?: JobRunsService,
    @Optional()
    private readonly usersRepository?: UsersRepository,
    @Optional()
    @Inject(forwardRef(() => TasksService))
    private readonly tasksService?: TasksService,
    @Optional()
    @Inject(forwardRef(() => ProjectInvitesService))
    private readonly projectInvitesService?: ProjectInvitesService,
    @Optional()
    @Inject(forwardRef(() => ModerationService))
    private readonly moderationService?: ModerationService,
    @Optional()
    @Inject(forwardRef(() => DataExportService))
    private readonly dataExportService?: DataExportService,
    @Optional()
    private readonly storageHygieneService?: StorageHygieneService,
    @Optional()
    @Inject(forwardRef(() => SupportService))
    private readonly supportService?: SupportService,
    @Optional()
    @Inject(forwardRef(() => LeaveRequestsService))
    private readonly leaveRequestsService?: LeaveRequestsService,
  ) {
    this.jobRunsServiceInstance = jobRunsService || new JobRunsService(this.clockService);
  }

  public get jobRunsService(): JobRunsService {
    return this.jobRunsServiceInstance;
  }

  public pauseScheduler(): void {
    this.schedulerPaused = true;
  }

  public resumeScheduler(): void {
    this.schedulerPaused = false;
  }

  public isSchedulerPaused(): boolean {
    return this.schedulerPaused;
  }

  private findProjectForJob(projectId?: string | null): { project: any | null; authoritativeMissing: boolean } {
    if (!projectId) {
      return { project: null, authoritativeMissing: false };
    }
    const pid = String(projectId);
    if (typeof this.projectsRepository?.findById === 'function') {
      const found = this.projectsRepository.findById(pid);
      return { project: found || null, authoritativeMissing: !found };
    }
    if (typeof (this.projectsService as any)?.findById === 'function') {
      const found = (this.projectsService as any).findById(pid);
      return { project: found || null, authoritativeMissing: false };
    }
    if (typeof this.projectsRepository?.findAll === 'function') {
      const all = this.projectsRepository.findAll(true) || [];
      const found = all.find((p: any) => String(p.id) === pid) || null;
      return { project: found, authoritativeMissing: false };
    }
    return { project: null, authoritativeMissing: false };
  }

  private isEntityProjectLive(projectId?: string | null): boolean {
    const { project, authoritativeMissing } = this.findProjectForJob(projectId);
    if (project) {
      return isLiveProject(project);
    }
    if (authoritativeMissing) {
      return false;
    }
    return true;
  }

  /**
   * Closes empty projects after 5 days with no applicants, and sends day 4 reminder.
   * If pending requests exist on day 5, auto-closing is paused and owner is reminded to decide.
   * Idempotent: running multiple times produces identical state.
   */
  async closeEmptyProjects(): Promise<{
    remindersSent: string[];
    pausedProjects: string[];
    closedProjects: string[];
    errors: string[];
    skippedNotLive: number;
  }> {
    const now = this.clockService.now();
    const nowIso = this.clockService.nowIso();
    const remindersSent: string[] = [];
    const pausedProjects: string[] = [];
    const closedProjects: string[] = [];
    const errors: string[] = [];
    let skippedNotLive = 0;

    const pauseRemindersByOwner = new Map<string, { items: NotificationGroupedItem[]; projectIds: string[] }>();
    const day4PendingByOwner = new Map<string, { items: NotificationGroupedItem[]; projectIds: string[] }>();
    const day4EmptyByOwner = new Map<string, { items: NotificationGroupedItem[]; projectIds: string[] }>();

    const allProjects: Project[] = this.projectsRepository.findAll(true);

    for (const project of allProjects) {
      if (!isLiveProject(project)) {
        skippedNotLive += 1;
        continue;
      }

      // Check if project has approved collaborators
      const collabs = Array.isArray(project.collaborators) ? project.collaborators : [];
      let hasApprovedCollabs = collabs.length > 0;
      if (!hasApprovedCollabs) {
        try {
          const reqs = this.joinRequestsService.findByProject(project.id);
          hasApprovedCollabs = reqs.some((r: any) => String(r.status || '').toLowerCase() === 'approved');
        } catch {}
      }

      if (hasApprovedCollabs) {
        continue;
      }

      const createdTime = new Date((project as any).createdAt || 0).getTime();
      if (isNaN(createdTime) || createdTime === 0) {
        continue;
      }

      const ageMs = now.getTime() - createdTime;
      const fourDaysMs = 4 * 24 * 60 * 60 * 1000;
      const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;

      let pendingReqs: any[] = [];
      try {
        pendingReqs = this.joinRequestsService
          .findByProject(project.id)
          .filter((r: any) => String(r.status || '').toLowerCase() === 'pending');
      } catch {}
      const hasPending = pendingReqs.length > 0;

      if (ageMs >= fiveDaysMs) {
        if (hasPending) {
          // Pending requests pause the closing for at most 48 hours. Store pausedAt and remind owner to decide.
          if (!project.pausedAt || !project.pendingReviewReminderSentAt) {
            const pauseStartIso = project.pausedAt || nowIso;
            const graceExpiresIso = new Date(new Date(pauseStartIso).getTime() + 48 * 60 * 60 * 1000).toISOString();
            if (!project.pendingReviewReminderSentAt) {
              try {
                if (project.ownerId) {
                  const oid = String(project.ownerId);
                  if (!pauseRemindersByOwner.has(oid)) {
                    pauseRemindersByOwner.set(oid, { items: [], projectIds: [] });
                  }
                  const bucket = pauseRemindersByOwner.get(oid)!;
                  bucket.items.push({
                    label: project.title || project.name || project.id,
                    link: `/owner/workspace/${project.id}`,
                  });
                  bucket.projectIds.push(project.id);
                }
              } catch (err: any) {
                this.logger.warn(`Failed to collect pause reminder for project ${project.id}: ${err?.message}`);
              }
            }
            project.pausedAt = pauseStartIso;
            project.pendingReviewGraceExpiresAt = graceExpiresIso;
            project.pendingReviewReminderSentAt = project.pendingReviewReminderSentAt || nowIso;
            this.projectsRepository.update(project.id, {
              pausedAt: project.pausedAt,
              pendingReviewGraceExpiresAt: project.pendingReviewGraceExpiresAt,
              pendingReviewReminderSentAt: project.pendingReviewReminderSentAt,
            } as any);
          }
          pausedProjects.push(project.id);
        } else {
          // No pending requests and no approved collaborators -> close project!
          try {
            this.projectsService.closeProject(project.id, 'No applicants within 5 days');
            closedProjects.push(project.id);
          } catch (err: any) {
            this.logger.warn(`Failed to auto-close project ${project.id}: ${err?.message}`);
            errors.push(`Failed to auto-close project ${project.id}: ${err?.message || err}`);
          }
        }
      } else if (ageMs >= fourDaysMs) {
        // Day 4 reminder to owner (once)
        if (!project.day4ReminderSentAt) {
          try {
            if (project.ownerId) {
              const oid = String(project.ownerId);
              const label = project.title || project.name || project.id;
              if (hasPending) {
                if (!day4PendingByOwner.has(oid)) {
                  day4PendingByOwner.set(oid, { items: [], projectIds: [] });
                }
                const bucket = day4PendingByOwner.get(oid)!;
                bucket.items.push({
                  label,
                  link: `/owner/workspace/${project.id}`,
                });
                bucket.projectIds.push(project.id);
              } else {
                if (!day4EmptyByOwner.has(oid)) {
                  day4EmptyByOwner.set(oid, { items: [], projectIds: [] });
                }
                const bucket = day4EmptyByOwner.get(oid)!;
                bucket.items.push({
                  label,
                  link: `/owner/workspace/${project.id}`,
                });
                bucket.projectIds.push(project.id);
              }
            }
          } catch (err: any) {
            this.logger.warn(`Failed to send Day 4 reminder for project ${project.id}: ${err?.message}`);
            errors.push(`Failed to send Day 4 reminder for project ${project.id}: ${err?.message || err}`);
          }
          project.day4ReminderSentAt = nowIso;
          this.projectsRepository.update(project.id, { day4ReminderSentAt: nowIso } as any);
          remindersSent.push(project.id);
        }
      }
    }

    const runKey = nowIso.slice(0, 13);
    for (const [ownerId, bucket] of pauseRemindersByOwner.entries()) {
      try {
        dispatchGroupedNotification(
          this.notificationsService,
          ownerId,
          `pause_reminder:${runKey}`,
          bucket.items,
          (groupedItems, count) => ({
            type: 'PROJECT_UPDATE',
            title: count > 1 ? `Pending Applications Require Decision (${count})` : 'Pending Applications Require Decision',
            message:
              count === 1
                ? `Project "${groupedItems[0].label}" has reached 5 days with pending join requests. Decide on pending requests within 48 hours or the project closes.`
                : `${count} projects have reached 5 days with pending join requests (decide within 48 hours): ${formatGroupedItemList(groupedItems, 10)}`,
            readStatus: false,
            referenceId: bucket.projectIds[0],
            link: groupedItems[0]?.link,
            metadata: { projectIds: bucket.projectIds },
          }),
        );
      } catch (err: any) {
        this.logger.warn(`Failed to send grouped pause reminder to ${ownerId}: ${err?.message}`);
      }
    }
    for (const [ownerId, bucket] of day4PendingByOwner.entries()) {
      try {
        dispatchGroupedNotification(
          this.notificationsService,
          ownerId,
          `day4_pending:${runKey}`,
          bucket.items,
          (groupedItems, count) => ({
            type: 'PROJECT_UPDATE',
            title: count > 1 ? `Pending Applications Reminder (${count})` : 'Pending Applications Reminder',
            message:
              count === 1
                ? `Project "${groupedItems[0].label}" has pending join requests awaiting your decision before day 5 auto-closure.`
                : `${count} projects have pending join requests awaiting your decision before day 5 auto-closure: ${formatGroupedItemList(groupedItems, 10)}`,
            readStatus: false,
            referenceId: bucket.projectIds[0],
            link: groupedItems[0]?.link,
            metadata: { projectIds: bucket.projectIds },
          }),
        );
      } catch (err: any) {
        this.logger.warn(`Failed to send grouped day4 pending reminder to ${ownerId}: ${err?.message}`);
      }
    }
    for (const [ownerId, bucket] of day4EmptyByOwner.entries()) {
      try {
        dispatchGroupedNotification(
          this.notificationsService,
          ownerId,
          `day4_empty:${runKey}`,
          bucket.items,
          (groupedItems, count) => ({
            type: 'PROJECT_UPDATE',
            title: count > 1 ? `Project Inactivity Reminder (${count})` : 'Project Inactivity Reminder',
            message:
              count === 1
                ? `Project "${groupedItems[0].label}" has had no applicants for 4 days. If no applicants join within 24 hours, the project will be automatically closed.`
                : `${count} projects have had no applicants for 4 days (closing within 24h unless applicants join): ${formatGroupedItemList(groupedItems, 10)}`,
            readStatus: false,
            referenceId: bucket.projectIds[0],
            link: groupedItems[0]?.link,
            metadata: { deadlineHours: 23, projectIds: bucket.projectIds },
          }),
        );
      } catch (err: any) {
        this.logger.warn(`Failed to send grouped day4 empty reminder to ${ownerId}: ${err?.message}`);
      }
    }

    return { remindersSent, pausedProjects, closedProjects, errors, skippedNotLive };
  }

  /**
   * Phase 4: Automatically declines mentor session booking requests after 3 days with no response.
   * Full refund to owner, notification to both sides, reason: "No response within 3 days".
   * Idempotent: safe to run multiple times, refunds only once.
   */
  async expireMentorRequests(): Promise<{
    expiredSessions: string[];
    skippedNotLive: number;
  }> {
    const now = this.clockService.now();
    const expiredSessions: string[] = [];
    let skippedNotLive = 0;

    if (!this.mentorMarketplaceService) {
      return { expiredSessions, skippedNotLive };
    }

    try {
      const allSessions = this.mentorMarketplaceService.findAllSessions();
      for (const session of allSessions) {
        // Only sessions waiting for mentor response
        if (session.status !== 'escrow_funded' && session.status !== 'payment_pending') {
          continue;
        }
        if (session.projectId && !this.isEntityProjectLive(session.projectId)) {
          skippedNotLive += 1;
          continue;
        }

        const respondByTime = session.respondBy
          ? new Date(session.respondBy).getTime()
          : new Date(session.createdAt).getTime() + 3 * 24 * 60 * 60 * 1000;

        if (now.getTime() >= respondByTime) {
          const res = this.mentorMarketplaceService.expireSession(session.id);
          if (res) {
            expiredSessions.push(session.id);
          }
        }
      }
    } catch (err: any) {
      this.logger.warn(`expireMentorRequests encountered non-critical error: ${err?.message || err}`);
    }

    return { expiredSessions, skippedNotLive };
  }

  /**
   * Phase 4: Missed deadline penalty runner.
   * When a task's due date has passed (from midnight server time the day after)
   * and the task is still Open or In Progress, the assignee gets -5 reputation once per task
   * (ledger entry deadline_missed, flag penaltyAppliedAt).
   * Unassigned tasks, submitted tasks (In Review) and approved tasks (Completed) carry no penalty.
   * A late submission or a later extension does not remove it.
   * Reassigned task penalises current assignee. Floor at 0.
   * Idempotent: running multiple times applies penalty only once.
   */
  async applyDeadlinePenalties(): Promise<{
    penalizedTasks: string[];
    skippedNotLive: number;
  }> {
    const now = this.clockService.now();
    const nowIso = this.clockService.nowIso();
    const penalizedTasks: string[] = [];
    let skippedNotLive = 0;

    if (!this.tasksRepository || !this.reputationService) {
      return { penalizedTasks, skippedNotLive };
    }

    try {
      const allTasks = this.tasksRepository.findAll();
      const penaltiesByAssignee = new Map<string, NotificationGroupedItem[]>();
      for (const task of allTasks) {
        // Skip tasks belonging to Closed, Completed, Cancelled, or soft-deleted projects
        if (!this.isEntityProjectLive(task.projectId)) {
          skippedNotLive += 1;
          continue;
        }

        // 1. Skip if already penalized (both task flag and reputation ledger uniqueness check)
        if (
          task.penaltyAppliedAt ||
          (typeof (this.reputationService as any).hasEntryForRef === 'function' &&
            (this.reputationService as any).hasEntryForRef('deadline_missed', task.id))
        ) {
          continue;
        }

        // 2. Skip unassigned tasks
        if (!task.assigneeId || task.assigneeId.toLowerCase() === 'unassigned') {
          continue;
        }

        // 3. Status check: only Open (To Do) or In Progress are penalized
        const sClean = String(task.status || '').toLowerCase().replace(/[\s-_]/g, '');
        if (sClean !== 'todo' && sClean !== 'open' && sClean !== 'inprogress') {
          continue;
        }

        // 4. Due date check: from midnight server time the day after
        if (!task.dueDate) {
          continue;
        }
        const due = new Date(task.dueDate);
        if (isNaN(due.getTime())) {
          continue;
        }

        // Midnight server time the day after the due date (using UTC to prevent timezone skew)
        const dayAfterMidnight = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate() + 1, 0, 0, 0, 0));
        if (now.getTime() < dayAfterMidnight.getTime()) {
          continue;
        }

        // Apply penalty
        this.reputationService.recordDeadlineMissed(task.assigneeId, task.id);
        task.penaltyAppliedAt = nowIso;
        this.tasksRepository.update(task.id, { penaltyAppliedAt: nowIso } as any);

        // Collect deadline missed notification per assignee
        const assigneeUid = String(task.assigneeId);
        if (!penaltiesByAssignee.has(assigneeUid)) penaltiesByAssignee.set(assigneeUid, []);
        penaltiesByAssignee.get(assigneeUid)!.push({
          label: task.title || task.id,
          link: `/collaborator/workspace/${task.projectId}`,
        });

        // Audit entry
        try {
          this.auditService.log({
            action: 'deadline-penalty-applied',
            actor: 'System',
            target: `User #${task.assigneeId}`,
            entityType: 'task',
            entityId: task.id,
            event: `Applied -5 reputation penalty to user #${task.assigneeId} for missed deadline on task "${task.title}"`,
            details: { taskId: task.id, assigneeId: task.assigneeId, dueDate: task.dueDate, penaltyAppliedAt: nowIso },
          });
        } catch (err: any) {
          this.logger.warn(`Failed to log audit entry for missed deadline: ${err?.message}`);
        }

        penalizedTasks.push(task.id);
      }

      const runKey = nowIso.slice(0, 13);
      for (const [assigneeUid, items] of penaltiesByAssignee.entries()) {
        try {
          dispatchGroupedNotification(
            this.notificationsService,
            assigneeUid,
            `deadline_missed:${runKey}`,
            items,
            (groupedItems, count) => ({
              type: 'DEADLINE_MISSED',
              title: count > 1 ? `Deadlines Missed (${count})` : 'Deadline Missed',
              message:
                count === 1
                  ? `You missed the deadline for task "${groupedItems[0].label}". A -5 reputation penalty has been applied.`
                  : `You missed ${count} task deadlines (-5 reputation penalty per task): ${formatGroupedItemList(groupedItems, 10)}`,
              readStatus: false,
              link: groupedItems[0]?.link,
            }),
          );
        } catch (err: any) {
          this.logger.warn(`Failed to send deadline notification for user ${assigneeUid}: ${err?.message}`);
        }
      }
    } catch (err: any) {
      this.logger.warn(`applyDeadlinePenalties encountered non-critical error: ${err?.message || err}`);
    }

    return { penalizedTasks, skippedNotLive };
  }

  /**
   * Hourly cron job runner. Runs automatically every hour.
   * Switchable with SCHEDULER_ENABLED env flag (defaults to true; tests set it to false).
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleCronTick(): Promise<void> {
    if (process.env.SCHEDULER_ENABLED === 'false' || this.schedulerPaused) {
      return;
    }
    try {
      await this.runTick('cron');
    } catch (err: any) {
      this.logger.warn(`[JobsService] Cron hourly tick skipped or encountered error: ${err?.message || err}`);
    }
  }

  /**
   * Execute an isolated, idempotent tick.
   * Acquires the in-memory lock, isolates each job, records per-job metrics,
   * completes the run, and releases the lock.
   */
  async runTick(trigger: 'cron' | 'manual' = 'manual'): Promise<JobRun> {
    const nowIso = this.clockService.nowIso();
    this.logger.log(`[JobsService] Executing ${trigger} tick at ${nowIso}`);

    if (this.jobRunsService.isLockActive()) {
      const activeRunId = this.jobRunsService.getActiveRunId();
      this.logger.warn(`[JobsService] Tick rejected: a tick is already in progress (${activeRunId})`);
      if (trigger === 'manual') {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          code: 'JOB_ALREADY_RUNNING',
          message: 'A job tick is already in progress.',
          runId: activeRunId,
        });
      }
      return this.jobRunsService.findById(activeRunId!)!;
    }

    const run = this.jobRunsService.start(trigger);
    const skippedByJob: Record<string, number> = {};
    const recordSkipped = (jobName: string, count?: number) => {
      const n = Number(count || 0);
      if (n > 0) {
        skippedByJob[jobName] = n;
      }
    };

    // Job 1: closeEmptyProjects
    try {
      const closeResult = await this.closeEmptyProjects();
      recordSkipped('closeEmptyProjects', closeResult.skippedNotLive);
      const itemsCount =
        (closeResult.closedProjects?.length || 0) +
        (closeResult.remindersSent?.length || 0) +
        (closeResult.pausedProjects?.length || 0);
      this.jobRunsService.finishJob(run.id, {
        name: 'closeEmptyProjects',
        itemsProcessed: itemsCount,
        errors: closeResult.errors || [],
      });
    } catch (err: any) {
      this.logger.error(`Job closeEmptyProjects failed: ${err?.message || err}`);
      this.jobRunsService.finishJob(run.id, {
        name: 'closeEmptyProjects',
        itemsProcessed: 0,
        errors: [err?.message || String(err)],
      });
    }

    // Job 2: expireMentorRequests
    try {
      const expireResult = await this.expireMentorRequests();
      recordSkipped('expireMentorRequests', expireResult.skippedNotLive);
      const itemsCount = expireResult.expiredSessions?.length || 0;
      this.jobRunsService.finishJob(run.id, {
        name: 'expireMentorRequests',
        itemsProcessed: itemsCount,
        errors: [],
      });
    } catch (err: any) {
      this.logger.error(`Job expireMentorRequests failed: ${err?.message || err}`);
      this.jobRunsService.finishJob(run.id, {
        name: 'expireMentorRequests',
        itemsProcessed: 0,
        errors: [err?.message || String(err)],
      });
    }

    // Job 3: applyDeadlinePenalties
    try {
      const penaltyResult = await this.applyDeadlinePenalties();
      recordSkipped('applyDeadlinePenalties', penaltyResult.skippedNotLive);
      const itemsCount = penaltyResult.penalizedTasks?.length || 0;
      this.jobRunsService.finishJob(run.id, {
        name: 'applyDeadlinePenalties',
        itemsProcessed: itemsCount,
        errors: [],
      });
    } catch (err: any) {
      this.logger.error(`Job applyDeadlinePenalties failed: ${err?.message || err}`);
      this.jobRunsService.finishJob(run.id, {
        name: 'applyDeadlinePenalties',
        itemsProcessed: 0,
        errors: [err?.message || String(err)],
      });
    }

    // Job 4: expirePendingPayments (Phase 9: 30-minute payment expiry)
    try {
      const expiryResult =
        typeof this.mentorMarketplaceService?.expireStalePaymentPendingSessions === 'function'
          ? this.mentorMarketplaceService.expireStalePaymentPendingSessions()
          : { expiredSessions: [], skippedNotLive: 0 };
      recordSkipped('expirePendingPayments', (expiryResult as any)?.skippedNotLive);
      const itemsCount = expiryResult?.expiredSessions?.length || 0;
      this.jobRunsService.finishJob(run.id, {
        name: 'expirePendingPayments',
        itemsProcessed: itemsCount,
        errors: [],
      });
    } catch (err: any) {
      this.logger.error(`Job expirePendingPayments failed: ${err?.message || err}`);
      this.jobRunsService.finishJob(run.id, {
        name: 'expirePendingPayments',
        itemsProcessed: 0,
        errors: [err?.message || String(err)],
      });
    }

    // Job 5: remindPendingRequests (Phase 11: 3-day pending join request reminder)
    try {
      const reminderResult = await this.remindPendingRequests();
      recordSkipped('remindPendingRequests', reminderResult.skippedNotLive);
      const itemsCount = reminderResult.remindedRequests?.length || 0;
      this.jobRunsService.finishJob(run.id, {
        name: 'remindPendingRequests',
        itemsProcessed: itemsCount,
        errors: reminderResult.errors || [],
      });
    } catch (err: any) {
      this.logger.error(`Job remindPendingRequests failed: ${err?.message || err}`);
      this.jobRunsService.finishJob(run.id, {
        name: 'remindPendingRequests',
        itemsProcessed: 0,
        errors: [err?.message || String(err)],
      });
    }

    // Job 6: zombieProjectBreaker (Phase 12: 48-hour hard limit on paused day-5 close)
    try {
      const zombieResult = await this.zombieProjectBreaker();
      recordSkipped('zombieProjectBreaker', zombieResult.skippedNotLive);
      const itemsCount =
        (zombieResult.closedProjects?.length || 0) +
        (zombieResult.pausedProjects?.length || 0);
      this.jobRunsService.finishJob(run.id, {
        name: 'zombieProjectBreaker',
        itemsProcessed: itemsCount,
        errors: zombieResult.errors || [],
      });
    } catch (err: any) {
      this.logger.error(`Job zombieProjectBreaker failed: ${err?.message || err}`);
      this.jobRunsService.finishJob(run.id, {
        name: 'zombieProjectBreaker',
        itemsProcessed: 0,
        errors: [err?.message || String(err)],
      });
    }

    // Job 7: staleRequestCloser (Phase 12: 14-day single join request timeout)
    try {
      const staleResult = await this.staleRequestCloser();
      recordSkipped('staleRequestCloser', staleResult.skippedNotLive);
      const itemsCount = staleResult.closedRequests?.length || 0;
      this.jobRunsService.finishJob(run.id, {
        name: 'staleRequestCloser',
        itemsProcessed: itemsCount,
        errors: staleResult.errors || [],
      });
    } catch (err: any) {
      this.logger.error(`Job staleRequestCloser failed: ${err?.message || err}`);
      this.jobRunsService.finishJob(run.id, {
        name: 'staleRequestCloser',
        itemsProcessed: 0,
        errors: [err?.message || String(err)],
      });
    }

    // Job 8: ownerInactivityNotifier (Phase 12: 14d notice + 30d flag, never auto-closes)
    try {
      const ownerResult = await this.ownerInactivityNotifier();
      recordSkipped('ownerInactivityNotifier', ownerResult.skippedNotLive);
      const itemsCount =
        (ownerResult.notified14dProjects?.length || 0) +
        (ownerResult.flagged30dProjects?.length || 0);
      this.jobRunsService.finishJob(run.id, {
        name: 'ownerInactivityNotifier',
        itemsProcessed: itemsCount,
        errors: ownerResult.errors || [],
      });
    } catch (err: any) {
      this.logger.error(`Job ownerInactivityNotifier failed: ${err?.message || err}`);
      this.jobRunsService.finishJob(run.id, {
        name: 'ownerInactivityNotifier',
        itemsProcessed: 0,
        errors: [err?.message || String(err)],
      });
    }

    // Job 9: memberInactivityNotifier (Phase 12: 7-day member inactivity notice per 7d period)
    try {
      const memberResult = await this.memberInactivityNotifier();
      recordSkipped('memberInactivityNotifier', memberResult.skippedNotLive);
      const itemsCount = memberResult.notifiedMembers?.length || 0;
      this.jobRunsService.finishJob(run.id, {
        name: 'memberInactivityNotifier',
        itemsProcessed: itemsCount,
        errors: memberResult.errors || [],
      });
    } catch (err: any) {
      this.logger.error(`Job memberInactivityNotifier failed: ${err?.message || err}`);
      this.jobRunsService.finishJob(run.id, {
        name: 'memberInactivityNotifier',
        itemsProcessed: 0,
        errors: [err?.message || String(err)],
      });
    }

    // Job 10: reviewDeadlineJob (Phase 13: 3-day review reminder & 7-day auto-approve)
    try {
      const reviewResult = await this.reviewDeadlineJob();
      recordSkipped('reviewDeadlineJob', reviewResult.skippedNotLive);
      const itemsCount =
        (reviewResult.remindedTasks?.length || 0) +
        (reviewResult.autoApprovedTasks?.length || 0);
      this.jobRunsService.finishJob(run.id, {
        name: 'reviewDeadlineJob',
        itemsProcessed: itemsCount,
        errors: reviewResult.errors || [],
      });
    } catch (err: any) {
      this.logger.error(`Job reviewDeadlineJob failed: ${err?.message || err}`);
      this.jobRunsService.finishJob(run.id, {
        name: 'reviewDeadlineJob',
        itemsProcessed: 0,
        errors: [err?.message || String(err)],
      });
    }

    // Job 11: mentorAbandonmentReleaser (Phase 14: release open abandonment reviews past 48h)
    try {
      const releaseRes =
        typeof this.mentorMarketplaceService?.processExpiredAbandonmentReviews === 'function'
          ? this.mentorMarketplaceService.processExpiredAbandonmentReviews()
          : { releasedReviews: [], refundedSessions: [], errors: [], skippedNotLive: 0 };
      recordSkipped('mentorAbandonmentReleaser', (releaseRes as any)?.skippedNotLive);
      const itemsCount =
        (releaseRes.releasedReviews?.length || 0) +
        (releaseRes.refundedSessions?.length || 0);
      this.jobRunsService.finishJob(run.id, {
        name: 'mentorAbandonmentReleaser',
        itemsProcessed: itemsCount,
        errors: releaseRes.errors || [],
      });
    } catch (err: any) {
      this.logger.error(`Job mentorAbandonmentReleaser failed: ${err?.message || err}`);
      this.jobRunsService.finishJob(run.id, {
        name: 'mentorAbandonmentReleaser',
        itemsProcessed: 0,
        errors: [err?.message || String(err)],
      });
    }

    // Job 12: mentorActivityNotifier (Phase 14: first-week & 7d idle activity notices)
    try {
      const noticeRes =
        typeof this.mentorMarketplaceService?.checkMentorActivityNotices === 'function'
          ? this.mentorMarketplaceService.checkMentorActivityNotices()
          : { firstWeekNotices: [], idle7dNotices: [], errors: [], skippedNotLive: 0 };
      recordSkipped('mentorActivityNotifier', (noticeRes as any)?.skippedNotLive);
      const itemsCount =
        (noticeRes.firstWeekNotices?.length || 0) +
        (noticeRes.idle7dNotices?.length || 0);
      this.jobRunsService.finishJob(run.id, {
        name: 'mentorActivityNotifier',
        itemsProcessed: itemsCount,
        errors: noticeRes.errors || [],
      });
    } catch (err: any) {
      this.logger.error(`Job mentorActivityNotifier failed: ${err?.message || err}`);
      this.jobRunsService.finishJob(run.id, {
        name: 'mentorActivityNotifier',
        itemsProcessed: 0,
        errors: [err?.message || String(err)],
      });
    }

    // Job 13: Expire stale direct project invitations (Phase 15: 7-day expiry)
    try {
      const inviteResult = this.projectInvitesService
        ? this.projectInvitesService.expireStaleInvites()
        : { expiredInvites: [], errors: [], skippedNotLive: 0 };
      recordSkipped('projectInviteExpirer', (inviteResult as any)?.skippedNotLive);
      this.jobRunsService.finishJob(run.id, {
        name: 'projectInviteExpirer',
        itemsProcessed: inviteResult.expiredInvites.length,
        errors: inviteResult.errors,
      });
    } catch (err: any) {
      this.logger.error(`Job projectInviteExpirer failed: ${err?.message || err}`);
      this.jobRunsService.finishJob(run.id, {
        name: 'projectInviteExpirer',
        itemsProcessed: 0,
        errors: [err?.message || String(err)],
      });
    }

    // Job 14: Archive/expire clean active warnings > 90 days (Phase 17: warning decay)
    try {
      const decayResult = this.moderationService?.decayExpiredWarnings
        ? this.moderationService.decayExpiredWarnings()
        : { expiredWarningIds: [], affectedUserIds: [] };
      this.jobRunsService.finishJob(run.id, {
        name: 'warningDecay',
        itemsProcessed: decayResult.expiredWarningIds.length,
        errors: [],
      });
    } catch (err: any) {
      this.logger.error(`Job warningDecay failed: ${err?.message || err}`);
      this.jobRunsService.finishJob(run.id, {
        name: 'warningDecay',
        itemsProcessed: 0,
        errors: [err?.message || String(err)],
      });
    }

    // Job 15: Notify Super Users once for escrow disputes unresolved for 7+ days (Phase 17)
    try {
      const disputeReminderResult = this.mentorMarketplaceService?.notifyOverdueDisputesToSuperUser
        ? this.mentorMarketplaceService.notifyOverdueDisputesToSuperUser()
        : { notifiedDisputes: [] };
      this.jobRunsService.finishJob(run.id, {
        name: 'disputeSuperUserReminder',
        itemsProcessed: disputeReminderResult.notifiedDisputes.length,
        errors: [],
      });
    } catch (err: any) {
      this.logger.error(`Job disputeSuperUserReminder failed: ${err?.message || err}`);
      this.jobRunsService.finishJob(run.id, {
        name: 'disputeSuperUserReminder',
        itemsProcessed: 0,
        errors: [err?.message || String(err)],
      });
    }

    // Job 16: Expire pending second-approval moderation actions after 72 hours (Phase 17)
    try {
      const expiredActionIds = this.moderationService?.expireStalePendingActions
        ? this.moderationService.expireStalePendingActions()
        : [];
      this.jobRunsService.finishJob(run.id, {
        name: 'pendingModerationExpiry',
        itemsProcessed: expiredActionIds.length,
        errors: [],
      });
    } catch (err: any) {
      this.logger.error(`Job pendingModerationExpiry failed: ${err?.message || err}`);
      this.jobRunsService.finishJob(run.id, {
        name: 'pendingModerationExpiry',
        itemsProcessed: 0,
        errors: [err?.message || String(err)],
      });
    }

    // Job 17: Delete expired personal data export files (>24 hours) (Phase 18)
    try {
      const exportResult = this.dataExportService?.cleanExpiredExports
        ? this.dataExportService.cleanExpiredExports()
        : { cleanedCount: 0 };
      this.jobRunsService.finishJob(run.id, {
        name: 'cleanExpiredExports',
        itemsProcessed: exportResult.cleanedCount || 0,
        errors: [],
      });
    } catch (err: any) {
      this.logger.error(`Job cleanExpiredExports failed: ${err?.message || err}`);
      this.jobRunsService.finishJob(run.id, {
        name: 'cleanExpiredExports',
        itemsProcessed: 0,
        errors: [err?.message || String(err)],
      });
    }

    // Job 18: Storage hygiene cleanup (orphan uploads >24h, expired/orphan exports, deleted CVs, >30d deleted project tombstones) (Phase 23)
    try {
      const hygieneResult = this.storageHygieneService?.runHygiene
        ? this.storageHygieneService.runHygiene()
        : {
            dryRun: false,
            itemsProcessed: 0,
            counts: {
              dryRun: false,
              orphanUploadsRemoved: 0,
              expiredExportsRemoved: 0,
              orphanExportsRemoved: 0,
              deletedAccountCvsRemoved: 0,
              projectTombstonesRemoved: 0,
              keptReferencedUploads: 0,
              keptRecentUploads: 0,
              keptProjectsNeededByEscrow: 0,
            },
            errors: [],
          };
      this.jobRunsService.finishJob(run.id, {
        name: 'storageHygiene',
        itemsProcessed: hygieneResult.itemsProcessed,
        counts: { ...hygieneResult.counts },
        errors: hygieneResult.errors || [],
      });
    } catch (err: any) {
      this.logger.error(`Job storageHygiene failed: ${err?.message || err}`);
      this.jobRunsService.finishJob(run.id, {
        name: 'storageHygiene',
        itemsProcessed: 0,
        errors: [err?.message || String(err)],
      });
    }

    // Job 20: Support ticket 7-day untouched reminder to Super User (Phase 27)
    try {
      const supportReminderRes = this.supportService?.notifyUntouchedTicketsToSuperUser
        ? this.supportService.notifyUntouchedTicketsToSuperUser()
        : { notifiedTicketIds: [] };
      this.jobRunsService.finishJob(run.id, {
        name: 'supportTicketSuperUserReminder',
        itemsProcessed: supportReminderRes.notifiedTicketIds.length,
        errors: [],
      });
    } catch (err: any) {
      this.logger.error(`Job supportTicketSuperUserReminder failed: ${err?.message || err}`);
      this.jobRunsService.finishJob(run.id, {
        name: 'supportTicketSuperUserReminder',
        itemsProcessed: 0,
        errors: [err?.message || String(err)],
      });
    }

    // Job 21: Finalize scheduled project deletions past their notice period
    try {
      const finalizeDeletionRes = await this.finalizeScheduledDeletions();
      this.jobRunsService.finishJob(run.id, {
        name: 'finalizeScheduledDeletions',
        itemsProcessed:
          (finalizeDeletionRes.processedProjects?.length || 0) +
          (finalizeDeletionRes.cancelledProjects?.length || 0),
        errors: finalizeDeletionRes.errors || [],
      });
    } catch (err: any) {
      this.logger.error(`Job finalizeScheduledDeletions failed: ${err?.message || err}`);
      this.jobRunsService.finishJob(run.id, {
        name: 'finalizeScheduledDeletions',
        itemsProcessed: 0,
        errors: [err?.message || String(err)],
      });
    }

    // Job 22: Daily good conduct reputation recovery (+2 points after 14 clean days)
    try {
      const recoveryResult = this.reputationService?.processDailyRecovery
        ? this.reputationService.processDailyRecovery()
        : { recoveredUsers: [], skipped: 0 };
      this.jobRunsService.finishJob(run.id, {
        name: 'reputationRecovery',
        itemsProcessed: recoveryResult.recoveredUsers?.length || 0,
        errors: [],
      });
    } catch (err: any) {
      this.logger.error(`Job reputationRecovery failed: ${err?.message || err}`);
      this.jobRunsService.finishJob(run.id, {
        name: 'reputationRecovery',
        itemsProcessed: 0,
        errors: [err?.message || String(err)],
      });
    }

    // Job 23: Process hourly leave request reminders (3d) and auto-approvals (7d)
    try {
      const leaveRes = this.leaveRequestsService
        ? await this.leaveRequestsService.processHourlyAutomation()
        : { approvedCount: 0, reminderCount: 0 };
      this.jobRunsService.finishJob(run.id, {
        name: 'processLeaveRequests',
        itemsProcessed: (leaveRes.approvedCount || 0) + (leaveRes.reminderCount || 0),
        counts: { ...leaveRes },
        errors: [],
      });
    } catch (err: any) {
      this.logger.error(`Job processLeaveRequests failed: ${err?.message || err}`);
      this.jobRunsService.finishJob(run.id, {
        name: 'processLeaveRequests',
        itemsProcessed: 0,
        errors: [err?.message || String(err)],
      });
    }

    // Phase 24: Emit ONE audit log summary per run when any non-live projects/items were skipped (counts only)
    const totalSkipped = Object.values(skippedByJob).reduce((sum, n) => sum + n, 0);
    if (totalSkipped > 0) {
      try {
        this.auditService?.log?.({
          action: 'JOB_SKIPPED_NOT_LIVE',
          actor: 'System',
          target: 'ScheduledJobs',
          entityType: 'job_run',
          entityId: run.id,
          event: `Skipped ${totalSkipped} non-live project item(s) across scheduled job run ${run.id}`,
          details: {
            runId: run.id,
            totalSkipped,
            byJob: skippedByJob,
          },
        });
      } catch (err: any) {
        this.logger.warn(`JOB_SKIPPED_NOT_LIVE audit write skipped: ${err?.message || err}`);
      }
    }

    return this.jobRunsService.finishRun(run.id);
  }

  /**
   * Reminds project owners about pending join requests that have been waiting for > 3 days.
   * Stores remindedAt on the request so the reminder is sent only once.
   */
  async remindPendingRequests(): Promise<{
    remindedRequests: string[];
    errors: string[];
    skippedNotLive: number;
  }> {
    const now = this.clockService ? this.clockService.now() : new Date();
    const nowIso = this.clockService ? this.clockService.nowIso() : now.toISOString();
    const remindedRequests: string[] = [];
    const errors: string[] = [];
    let skippedNotLive = 0;

    const allRequests = typeof this.joinRequestsService?.findAll === 'function'
      ? this.joinRequestsService.findAll()
      : [];

    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    const remindersByOwner = new Map<string, { items: NotificationGroupedItem[]; firstRefId: string }>();

    for (const req of allRequests) {
      if (!this.isEntityProjectLive(req.projectId)) {
        skippedNotLive += 1;
        continue;
      }
      if (String(req.status || '').toLowerCase() !== 'pending') {
        continue;
      }
      if (req.remindedAt || (req as any).pendingReminderSentAt) {
        continue;
      }
      const createdTime = new Date(req.createdAt || 0).getTime();
      if (isNaN(createdTime) || createdTime === 0) {
        continue;
      }
      if (now.getTime() - createdTime >= threeDaysMs) {
        try {
          const project = this.projectsService?.findById(req.projectId);
          if (project && project.ownerId) {
            const oid = String(project.ownerId);
            if (!remindersByOwner.has(oid)) {
              remindersByOwner.set(oid, { items: [], firstRefId: req.id });
            }
            remindersByOwner.get(oid)!.items.push({
              label: `${req.userName || 'Applicant'} (${project.title || project.name})`,
              link: `/owner/workspace/${project.id}`,
            });
          }
          req.remindedAt = nowIso;
          (req as any).pendingReminderSentAt = nowIso;
          if (typeof (this.joinRequestsService as any).updateSync === 'function') {
            try {
              (this.joinRequestsService as any).updateSync(req.id, {
                remindedAt: nowIso,
                pendingReminderSentAt: nowIso,
              });
            } catch {}
          } else if (typeof this.joinRequestsService.update === 'function') {
            try {
              await this.joinRequestsService.update(req.id, {
                remindedAt: nowIso,
                pendingReminderSentAt: nowIso,
              } as any);
            } catch {}
          }
          remindedRequests.push(req.id);
        } catch (err: any) {
          errors.push(err?.message || String(err));
        }
      }
    }

    const runKey = nowIso.slice(0, 13);
    for (const [ownerId, bucket] of remindersByOwner.entries()) {
      try {
        dispatchGroupedNotification(
          this.notificationsService,
          ownerId,
          `join_request_reminder:${runKey}`,
          bucket.items,
          (groupedItems, count) => ({
            type: 'JOIN_REQUEST_REMINDER',
            title: count > 1 ? `Pending Join Request Reminders (${count})` : 'Pending Join Request Reminder',
            message:
              count === 1
                ? `A join request (${groupedItems[0].label}) has been pending for over 3 days. Please review and decide.`
                : `${count} join requests have been pending for over 3 days: ${formatGroupedItemList(groupedItems, 10)}`,
            readStatus: false,
            referenceId: bucket.firstRefId,
            link: groupedItems[0]?.link,
          }),
        );
      } catch (err: any) {
        errors.push(err?.message || String(err));
      }
    }

    return { remindedRequests, errors, skippedNotLive };
  }

  private hasApprovedCollaborators(project: Project): boolean {
    const collabs = Array.isArray(project.collaborators) ? project.collaborators : [];
    if (collabs.length > 0) return true;
    try {
      const reqs = typeof this.joinRequestsService?.findByProject === 'function'
        ? this.joinRequestsService.findByProject(project.id)
        : [];
      return reqs.some((r: any) => String(r.status || '').toLowerCase() === 'approved');
    } catch {
      return false;
    }
  }

  /**
   * Phase 12 Job 6: Zombie Project Breaker.
   * When a 5-day-old project is paused due to pending join requests, gives the owner 48 hours from pausedAt.
   * If owner still has not decided all pending requests after 48 hours, pending requests become 'system_closed'
   * (restoring applicant slots and notifying them) and the project closes with closureReason 'No owner response'.
   * If the owner decides all pending requests within 48 hours, clears pausedAt to resume normal flow.
   */
  async zombieProjectBreaker(): Promise<{
    pausedProjects: string[];
    closedProjects: string[];
    closedRequests: string[];
    errors: string[];
    skippedNotLive: number;
  }> {
    const now = this.clockService ? this.clockService.now() : new Date();
    const nowMs = now.getTime();
    const nowIso = now.toISOString();
    const pausedProjects: string[] = [];
    const closedProjects: string[] = [];
    const closedRequests: string[] = [];
    const errors: string[] = [];
    let skippedNotLive = 0;

    const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
    const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
    const allProjects: Project[] = this.projectsRepository.findAll(true);
    const zombieApplicantClosures = new Map<string, { items: NotificationGroupedItem[]; projectId: string }>();
    const pausedByOwner = new Map<string, NotificationGroupedItem[]>();

    for (const project of allProjects) {
      if (!isLiveProject(project)) {
        skippedNotLive += 1;
        continue;
      }

      if (this.hasApprovedCollaborators(project)) {
        if (project.pausedAt || project.pendingReviewGraceExpiresAt) {
          project.pausedAt = undefined;
          project.pendingReviewGraceExpiresAt = undefined;
          this.projectsRepository.update(project.id, {
            pausedAt: undefined,
            pendingReviewGraceExpiresAt: undefined,
          } as any);
        }
        continue;
      }

      let pendingReqs: any[] = [];
      try {
        pendingReqs = typeof this.joinRequestsService?.findByProject === 'function'
          ? this.joinRequestsService
              .findByProject(project.id)
              .filter((r: any) => String(r.status || '').toLowerCase() === 'pending')
          : [];
      } catch {}

      if (project.pausedAt) {
        if (pendingReqs.length === 0) {
          // Owner decided within 48h -> clear pause and resume normal flow
          project.pausedAt = undefined;
          project.pendingReviewGraceExpiresAt = undefined;
          this.projectsRepository.update(project.id, {
            pausedAt: undefined,
            pendingReviewGraceExpiresAt: undefined,
          } as any);
          continue;
        }

        const pausedMs = new Date(project.pausedAt).getTime();
        if (!isNaN(pausedMs) && pausedMs > 0 && nowMs - pausedMs >= FORTY_EIGHT_HOURS_MS) {
          try {
            // Mark pending requests system_closed first so closeProject also sees them handled cleanly
            for (const req of pendingReqs) {
              req.status = 'system_closed';
              req.closureReason = 'No owner response';
              req.countedTowardLimit = false;
              req.decidedAt = nowIso;
              req.updatedAt = now;
              if (typeof this.joinRequestsService.updateSync === 'function') {
                try {
                  this.joinRequestsService.updateSync(req.id, {
                    status: 'system_closed',
                    closureReason: 'No owner response',
                    countedTowardLimit: false,
                    decidedAt: nowIso,
                    updatedAt: now,
                  } as any);
                } catch {}
              }
              const applicantId = String(req.userId);
              if (!zombieApplicantClosures.has(applicantId)) {
                zombieApplicantClosures.set(applicantId, { items: [], projectId: project.id });
              }
              zombieApplicantClosures.get(applicantId)!.items.push({
                label: project.title || project.name || project.id,
                link: `/projects/${project.id}`,
              });
              closedRequests.push(req.id);
            }

            this.projectsService.closeProject(project.id, 'No owner response');
            try {
              this.auditService.log({
                action: 'zombie-project-closed',
                actor: 'System',
                target: project.title || project.name || project.id,
                entityType: 'project',
                entityId: project.id,
                event: `Project "${project.title || project.name}" closed with reason "No owner response" after 48-hour pause expired.`,
                details: { pausedAt: project.pausedAt, closedRequestsCount: pendingReqs.length },
              });
            } catch {}

            closedProjects.push(project.id);
          } catch (err: any) {
            this.logger.warn(`Failed zombie close for project ${project.id}: ${err?.message}`);
            errors.push(err?.message || String(err));
          }
        }
        continue;
      }

      // Start pause if project >= 5 days old and pending requests exist (in case called standalone)
      const createdTime = new Date((project as any).createdAt || 0).getTime();
      if (!isNaN(createdTime) && createdTime > 0 && nowMs - createdTime >= FIVE_DAYS_MS && pendingReqs.length > 0) {
        const graceExpiresIso = new Date(nowMs + FORTY_EIGHT_HOURS_MS).toISOString();
        project.pausedAt = nowIso;
        project.pendingReviewGraceExpiresAt = graceExpiresIso;
        project.pendingReviewReminderSentAt = project.pendingReviewReminderSentAt || nowIso;
        this.projectsRepository.update(project.id, {
          pausedAt: nowIso,
          pendingReviewGraceExpiresAt: graceExpiresIso,
          pendingReviewReminderSentAt: project.pendingReviewReminderSentAt,
        } as any);
        if (project.ownerId) {
          const oid = String(project.ownerId);
          if (!pausedByOwner.has(oid)) pausedByOwner.set(oid, []);
          pausedByOwner.get(oid)!.push({
            label: project.title || project.name || project.id,
            link: `/owner/workspace/${project.id}`,
          });
        }
        pausedProjects.push(project.id);
      }
    }

    const zombieRunKey = nowIso.slice(0, 13);
    for (const [applicantId, bucket] of zombieApplicantClosures.entries()) {
      try {
        dispatchGroupedNotification(
          this.notificationsService,
          applicantId,
          `zombie_request_timeout:${zombieRunKey}`,
          bucket.items,
          (groupedItems, count) => ({
            type: 'REQUEST_TIMEOUT',
            title: count > 1 ? `Join Requests Closed (${count})` : 'Join Request Closed',
            message:
              count === 1
                ? `Your application to "${groupedItems[0].label}" was closed because the owner did not respond within 48 hours. Your request slot has been restored.`
                : `${count} applications were closed because the owners did not respond within 48 hours (your request slots have been restored): ${formatGroupedItemList(groupedItems, 10)}`,
            readStatus: false,
            referenceId: bucket.projectId,
            link: groupedItems[0]?.link,
          }),
        );
      } catch (err: any) {
        this.logger.warn(`Failed to notify applicant ${applicantId} for zombie close: ${err?.message}`);
      }
    }
    for (const [ownerId, items] of pausedByOwner.entries()) {
      try {
        dispatchGroupedNotification(
          this.notificationsService,
          ownerId,
          `project_paused:${zombieRunKey}`,
          items,
          (groupedItems, count) => ({
            type: 'PROJECT_PAUSED',
            title: count > 1 ? `Pending Applications Require Decision (${count})` : 'Pending Applications Require Decision',
            message:
              count === 1
                ? `Project "${groupedItems[0].label}" has pending join requests at day 5. Decide on pending requests within 48 hours or the project closes.`
                : `${count} projects have pending join requests at day 5 (decide within 48 hours): ${formatGroupedItemList(groupedItems, 10)}`,
            readStatus: false,
            link: groupedItems[0]?.link,
          }),
        );
      } catch {}
    }

    return { pausedProjects, closedProjects, closedRequests, errors, skippedNotLive };
  }

  /**
   * Phase 12 Job 7: Stale Join Request Closer (14-day timeout).
   * Closes any single pending join request older than 14 days as system_closed (slot not consumed), notifying both sides.
   */
  async staleRequestCloser(): Promise<{
    closedRequests: string[];
    errors: string[];
    skippedNotLive: number;
  }> {
    const now = this.clockService ? this.clockService.now() : new Date();
    const nowMs = now.getTime();
    const nowIso = now.toISOString();
    const closedRequests: string[] = [];
    const errors: string[] = [];
    let skippedNotLive = 0;

    const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
    const allRequests = typeof this.joinRequestsService?.findAll === 'function'
      ? this.joinRequestsService.findAll()
      : [];
    const applicantTimeouts = new Map<string, { items: NotificationGroupedItem[]; refId: string }>();
    const ownerTimeouts = new Map<string, { items: NotificationGroupedItem[]; refId: string }>();

    for (const req of allRequests) {
      if (!this.isEntityProjectLive(req.projectId)) {
        skippedNotLive += 1;
        continue;
      }
      if (String(req.status || '').toLowerCase() !== 'pending') {
        continue;
      }

      const sentTime = new Date((req as any).sentAt || req.createdAt || 0).getTime();
      if (isNaN(sentTime) || sentTime <= 0) {
        continue;
      }

      if (nowMs - sentTime >= FOURTEEN_DAYS_MS) {
        try {
          req.status = 'system_closed';
          (req as any).closureReason = 'No owner response';
          (req as any).countedTowardLimit = false;
          req.decidedAt = nowIso;
          req.updatedAt = now;

          if (typeof this.joinRequestsService.updateSync === 'function') {
            try {
              this.joinRequestsService.updateSync(req.id, {
                status: 'system_closed',
                closureReason: 'No owner response',
                countedTowardLimit: false,
                decidedAt: nowIso,
                updatedAt: now,
              } as any);
            } catch {}
          }

          let project: any = null;
          try {
            project = this.projectsService?.findById?.(req.projectId) || this.projectsRepository?.findById?.(req.projectId);
          } catch {}
          const projectTitle = project?.title || project?.name || 'the project';

          const appId = String(req.userId);
          if (!applicantTimeouts.has(appId)) {
            applicantTimeouts.set(appId, { items: [], refId: req.projectId });
          }
          applicantTimeouts.get(appId)!.items.push({
            label: projectTitle,
            link: `/projects/${req.projectId}`,
          });

          if (project?.ownerId) {
            const oid = String(project.ownerId);
            if (!ownerTimeouts.has(oid)) {
              ownerTimeouts.set(oid, { items: [], refId: req.projectId });
            }
            ownerTimeouts.get(oid)!.items.push({
              label: `${req.userName || 'Applicant'} (${projectTitle})`,
              link: `/owner/workspace/${req.projectId}`,
            });
          }

          try {
            this.auditService.log({
              action: 'stale-request-closed',
              actor: 'System',
              target: req.id,
              entityType: 'join_request',
              entityId: req.id,
              event: `Pending join request ${req.id} for "${projectTitle}" closed after 14 days with no owner response`,
              details: { projectId: req.projectId, applicantId: req.userId },
            });
          } catch {}

          closedRequests.push(req.id);
        } catch (err: any) {
          errors.push(err?.message || String(err));
        }
      }
    }

    const staleRunKey = nowIso.slice(0, 13);
    for (const [appId, bucket] of applicantTimeouts.entries()) {
      try {
        dispatchGroupedNotification(
          this.notificationsService,
          appId,
          `stale_request_applicant:${staleRunKey}`,
          bucket.items,
          (groupedItems, count) => ({
            type: 'REQUEST_TIMEOUT',
            title: count > 1 ? `Join Requests Closed (${count})` : 'Join Request Closed',
            message:
              count === 1
                ? `Your join request for "${groupedItems[0].label}" was closed because the owner did not respond within 14 days. Your request slot was restored.`
                : `${count} join requests were closed after 14 days without response (slots restored): ${formatGroupedItemList(groupedItems, 10)}`,
            readStatus: false,
            referenceId: bucket.refId,
            link: groupedItems[0]?.link,
          }),
        );
      } catch {}
    }
    for (const [ownerId, bucket] of ownerTimeouts.entries()) {
      try {
        dispatchGroupedNotification(
          this.notificationsService,
          ownerId,
          `stale_request_owner:${staleRunKey}`,
          bucket.items,
          (groupedItems, count) => ({
            type: 'REQUEST_TIMEOUT',
            title: count > 1 ? `Pending Join Requests Expired (${count})` : 'Pending Join Request Expired',
            message:
              count === 1
                ? `Pending join request (${groupedItems[0].label}) expired after 14 days with no decision and was closed.`
                : `${count} pending join requests expired after 14 days with no decision: ${formatGroupedItemList(groupedItems, 10)}`,
            readStatus: false,
            referenceId: bucket.refId,
            link: groupedItems[0]?.link,
          }),
        );
      } catch {}
    }

    return { closedRequests, errors, skippedNotLive };
  }

  /**
   * Phase 12 Job 8: Owner Inactivity Notifier (14-day notice, 30-day close-eligible flag; never auto-closes).
   */
  async ownerInactivityNotifier(): Promise<{
    notified14dProjects: string[];
    flagged30dProjects: string[];
    errors: string[];
    skippedNotLive: number;
  }> {
    const now = this.clockService ? this.clockService.now() : new Date();
    const nowMs = now.getTime();
    const nowIso = now.toISOString();
    const notified14dProjects: string[] = [];
    const flagged30dProjects: string[] = [];
    const errors: string[] = [];
    let skippedNotLive = 0;

    const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const allProjects: Project[] = this.projectsRepository.findAll(true);
    const owner14dByRecipient = new Map<string, { items: NotificationGroupedItem[]; refId: string; projectIds: string[] }>();
    const owner30dByRecipient = new Map<string, { items: NotificationGroupedItem[]; refId: string; projectIds: string[] }>();

    for (const project of allProjects) {
      if (!isLiveProject(project)) {
        skippedNotLive += 1;
        continue;
      }

      const ownerUser = typeof this.usersRepository?.findById === 'function' && project.ownerId
        ? this.usersRepository.findById(String(project.ownerId))
        : undefined;

      const candidateTimestamps = [
        ownerUser?.lastActiveAt,
        project.lastOwnerActionAt,
        project.createdAt,
        project.updatedAt,
      ]
        .filter(Boolean)
        .map((d) => new Date(d as any).getTime())
        .filter((t) => !isNaN(t) && t > 0);

      if (candidateTimestamps.length === 0) {
        continue;
      }

      const lastOwnerActivityMs = Math.max(...candidateTimestamps);
      const inactivityMs = nowMs - lastOwnerActivityMs;

      // Owner came back / active within last 14 days -> reset stale flags if any
      if (inactivityMs < FOURTEEN_DAYS_MS) {
        if (project.ownerInactive14dNotifiedAt || project.ownerInactive30d) {
          project.ownerInactive14dNotifiedAt = undefined;
          project.ownerInactive30d = false;
          project.ownerInactive30dFlaggedAt = undefined;
          this.projectsRepository.update(project.id, {
            ownerInactive14dNotifiedAt: undefined,
            ownerInactive30d: false,
            ownerInactive30dFlaggedAt: undefined,
          } as any);
        }
        continue;
      }

      const projectTitle = project.title || project.name || 'the project';
      const removedIds = new Set(
        (Array.isArray(project.removedUsers) ? project.removedUsers : []).map((r: any) =>
          String(r.userId || r.id || ''),
        ),
      );
      const activeCollabIds: string[] = (Array.isArray(project.collaborators) ? project.collaborators : [])
        .map((c: any) => (typeof c === 'string' ? c : String(c.id || c.userId || '')))
        .filter((cid) => cid && cid !== String(project.ownerId) && !removedIds.has(cid));

      const mentorId = project.mentorId ? String(project.mentorId) : null;

      // 14-day threshold: notify every collaborator and mentor once (collect per recipient)
      if (inactivityMs >= FOURTEEN_DAYS_MS && !project.ownerInactive14dNotifiedAt) {
        try {
          for (const cid of activeCollabIds) {
            if (!owner14dByRecipient.has(cid)) {
              owner14dByRecipient.set(cid, { items: [], refId: project.id, projectIds: [] });
            }
            const bucket = owner14dByRecipient.get(cid)!;
            bucket.items.push({
              label: projectTitle,
              link: `/collaborator/workspace/${project.id}`,
            });
            bucket.projectIds.push(project.id);
          }
          if (mentorId && mentorId !== String(project.ownerId) && !activeCollabIds.includes(mentorId)) {
            if (!owner14dByRecipient.has(mentorId)) {
              owner14dByRecipient.set(mentorId, { items: [], refId: project.id, projectIds: [] });
            }
            const bucket = owner14dByRecipient.get(mentorId)!;
            bucket.items.push({
              label: projectTitle,
              link: `/mentor/workspace/${project.id}`,
            });
            bucket.projectIds.push(project.id);
          }

          project.ownerInactive14dNotifiedAt = nowIso;
          this.projectsRepository.update(project.id, { ownerInactive14dNotifiedAt: nowIso } as any);
          notified14dProjects.push(project.id);
        } catch (err: any) {
          errors.push(err?.message || String(err));
        }
      }

      // 30-day threshold: flag project so collaborators see "Ask admin to close" (never auto-close)
      if (inactivityMs >= THIRTY_DAYS_MS && !project.ownerInactive30d) {
        try {
          project.ownerInactive30d = true;
          project.ownerInactive30dFlaggedAt = nowIso;
          this.projectsRepository.update(project.id, {
            ownerInactive30d: true,
            ownerInactive30dFlaggedAt: nowIso,
          } as any);

          for (const cid of activeCollabIds) {
            if (!owner30dByRecipient.has(cid)) {
              owner30dByRecipient.set(cid, { items: [], refId: project.id, projectIds: [] });
            }
            const bucket = owner30dByRecipient.get(cid)!;
            bucket.items.push({
              label: projectTitle,
              link: `/collaborator/workspace/${project.id}`,
            });
            bucket.projectIds.push(project.id);
          }

          flagged30dProjects.push(project.id);
        } catch (err: any) {
          errors.push(err?.message || String(err));
        }
      }
    }

    const inactRunKey = nowIso.slice(0, 13);
    for (const [uid, bucket] of owner14dByRecipient.entries()) {
      try {
        dispatchGroupedNotification(
          this.notificationsService,
          uid,
          `owner_inactive_14d:${inactRunKey}`,
          bucket.items,
          (groupedItems, count) => ({
            type: 'OWNER_INACTIVE',
            title: count > 1 ? `Project Owners Inactive (${count})` : 'Project Owner Inactive',
            message:
              count === 1
                ? `The owner of "${groupedItems[0].label}" has had no login or project activity for 14 days.`
                : `The owners of ${count} projects have had no activity for 14 days: ${formatGroupedItemList(groupedItems, 10)}`,
            readStatus: false,
            referenceId: bucket.refId,
            link: groupedItems[0]?.link,
            metadata: { projectIds: bucket.projectIds },
          }),
        );
      } catch {}
    }
    for (const [uid, bucket] of owner30dByRecipient.entries()) {
      try {
        dispatchGroupedNotification(
          this.notificationsService,
          uid,
          `owner_inactive_30d:${inactRunKey}`,
          bucket.items,
          (groupedItems, count) => ({
            type: 'OWNER_INACTIVE_30D',
            title: count > 1 ? `Owners Inactive for 30 Days (${count})` : 'Owner Inactive for 30 Days',
            message:
              count === 1
                ? `The owner of "${groupedItems[0].label}" has been inactive for 30 days. You can now use "Ask admin to close" from the project workspace.`
                : `Owners of ${count} projects have been inactive for 30 days (closure requests available): ${formatGroupedItemList(groupedItems, 10)}`,
            readStatus: false,
            referenceId: bucket.refId,
            link: groupedItems[0]?.link,
            metadata: { projectIds: bucket.projectIds },
          }),
        );
      } catch {}
    }

    return { notified14dProjects, flagged30dProjects, errors, skippedNotLive };
  }

  /**
   * Phase 12 Job 9: Member Inactivity Notifier.
   * Notifies members with 7+ days of no task/chat activity and notices the project owner once per 7-day period.
   */
  async memberInactivityNotifier(): Promise<{
    notifiedMembers: string[];
    errors: string[];
    skippedNotLive: number;
  }> {
    const now = this.clockService ? this.clockService.now() : new Date();
    const nowMs = now.getTime();
    const nowIso = now.toISOString();
    const notifiedMembers: string[] = [];
    const errors: string[] = [];
    let skippedNotLive = 0;

    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const DAY_MS = 24 * 60 * 60 * 1000;
    const allProjects: Project[] = this.projectsRepository.findAll(true);
    const selfNoticesByCollab = new Map<string, { items: NotificationGroupedItem[]; refId: string; maxDays: number }>();
    const ownerNoticesByOwner = new Map<string, { items: NotificationGroupedItem[]; refId: string }>();

    for (const project of allProjects) {
      if (!isLiveProject(project)) {
        skippedNotLive += 1;
        continue;
      }

      const collabs = Array.isArray(project.collaborators) ? project.collaborators : [];
      if (collabs.length === 0) continue;

      const removedIds = new Set(
        (Array.isArray(project.removedUsers) ? project.removedUsers : []).map((r: any) =>
          String(r.userId || r.id || ''),
        ),
      );
      if (!project.memberActivity) {
        project.memberActivity = {};
      }
      const projectTitle = project.title || project.name || 'the project';

      for (const collab of collabs) {
        const cid = typeof collab === 'string' ? collab : String(collab.id || collab.userId || '');
        if (!cid || cid === String(project.ownerId) || cid === String(project.mentorId || '') || removedIds.has(cid)) {
          continue;
        }
        const memberName = (typeof collab === 'object' && collab.name) || cid;
        const record = project.memberActivity[cid] || {};
        const lastActIso =
          record.lastActivityAt ||
          (typeof collab === 'object' ? collab.lastActivityAt || collab.joinedAt : undefined) ||
          (project.createdAt ? new Date(project.createdAt as any).toISOString() : undefined);

        if (!lastActIso) continue;
        const lastActMs = new Date(lastActIso).getTime();
        if (isNaN(lastActMs) || lastActMs <= 0) continue;

        const inactiveMs = nowMs - lastActMs;
        if (inactiveMs < SEVEN_DAYS_MS) {
          continue;
        }

        const lastNotifIso =
          record.inactivityNotifiedAt ||
          (typeof collab === 'object' ? collab.inactivityNotifiedAt : undefined);
        const lastNotifMs = lastNotifIso ? new Date(lastNotifIso).getTime() : 0;

        if (lastNotifMs > 0 && nowMs - lastNotifMs < SEVEN_DAYS_MS) {
          continue; // Sent once per 7-day period
        }

        const inactiveDays = Math.floor(inactiveMs / DAY_MS);

        try {
          if (!selfNoticesByCollab.has(cid)) {
            selfNoticesByCollab.set(cid, { items: [], refId: project.id, maxDays: inactiveDays });
          }
          const selfBucket = selfNoticesByCollab.get(cid)!;
          selfBucket.maxDays = Math.max(selfBucket.maxDays, inactiveDays);
          selfBucket.items.push({
            label: `${projectTitle} (${inactiveDays}d inactive)`,
            link: `/collaborator/workspace/${project.id}`,
          });

          if (project.ownerId) {
            const oid = String(project.ownerId);
            if (!ownerNoticesByOwner.has(oid)) {
              ownerNoticesByOwner.set(oid, { items: [], refId: project.id });
            }
            ownerNoticesByOwner.get(oid)!.items.push({
              label: `${memberName} in "${projectTitle}" (${inactiveDays}d)`,
              link: `/owner/workspace/${project.id}`,
            });
          }

          project.memberActivity[cid] = {
            ...record,
            lastActivityAt: lastActIso,
            inactivityNotifiedAt: nowIso,
          };
          if (typeof collab === 'object') {
            collab.inactivityNotifiedAt = nowIso;
          }
          this.projectsRepository.update(project.id, {
            memberActivity: project.memberActivity,
            collaborators: project.collaborators,
          } as any);

          notifiedMembers.push(`${project.id}:${cid}`);
        } catch (err: any) {
          errors.push(err?.message || String(err));
        }
      }
    }

    const memRunKey = nowIso.slice(0, 13);
    for (const [cid, bucket] of selfNoticesByCollab.entries()) {
      try {
        dispatchGroupedNotification(
          this.notificationsService,
          cid,
          `member_inactive_self:${memRunKey}`,
          bucket.items,
          (groupedItems, count) => ({
            type: 'MEMBER_INACTIVE',
            title: count > 1 ? `Inactivity Notices (${count})` : 'Inactivity Notice',
            message:
              count === 1
                ? `You have had no task or chat activity on ${groupedItems[0].label}. Please update your tasks or message your team.`
                : `You have had no task or chat activity across ${count} projects: ${formatGroupedItemList(groupedItems, 10)}`,
            readStatus: false,
            referenceId: bucket.refId,
            link: groupedItems[0]?.link,
          }),
        );
      } catch {}
    }
    for (const [ownerId, bucket] of ownerNoticesByOwner.entries()) {
      try {
        dispatchGroupedNotification(
          this.notificationsService,
          ownerId,
          `member_inactive_owner:${memRunKey}`,
          bucket.items,
          (groupedItems, count) => ({
            type: 'MEMBER_INACTIVE',
            title: count > 1 ? `Inactive Collaborator Notices (${count})` : 'Inactive Collaborator Notice',
            message:
              count === 1
                ? `${groupedItems[0].label} has had no activity. Use "Release tasks" in the Members tab to unassign their Open/In Progress tasks.`
                : `${count} collaborators have been inactive across your projects: ${formatGroupedItemList(groupedItems, 10)}`,
            readStatus: false,
            referenceId: bucket.refId,
            link: groupedItems[0]?.link,
          }),
        );
      } catch {}
    }

    return { notifiedMembers, errors, skippedNotLive };
  }

  /**
   * Phase 13 Job 10: Task Review Deadline Job.
   * - Sends a one-time reminder notification to the project owner when an In Review task waits >= 3 days.
   * - Auto-approves In Review tasks waiting >= 7 days via TasksService.approveTask (same canonical path for XP, rep, ledger & audit).
   * - Never auto-approves tasks whose proof URL fails the Phase 6 URL safety check.
   */
  async reviewDeadlineJob(): Promise<{
    remindedTasks: string[];
    autoApprovedTasks: string[];
    skippedBadProofTasks: string[];
    errors: string[];
    skippedNotLive: number;
  }> {
    const now = this.clockService ? this.clockService.now() : new Date();
    const nowMs = now.getTime();
    const nowIso = this.clockService ? this.clockService.nowIso() : now.toISOString();
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

    const remindedTasks: string[] = [];
    const autoApprovedTasks: string[] = [];
    const skippedBadProofTasks: string[] = [];
    const errors: string[] = [];
    let skippedNotLive = 0;

    const allTasks = typeof this.tasksRepository?.findAll === 'function'
      ? this.tasksRepository.findAll()
      : [];
    const remindersByOwner = new Map<
      string,
      { items: NotificationGroupedItem[]; refProjectId: string; taskIds: string[] }
    >();

    for (const task of allTasks) {
      if (!this.isEntityProjectLive(task.projectId)) {
        skippedNotLive += 1;
        continue;
      }

      const sClean = String(task.status || '').toLowerCase().replace(/[\s-_]/g, '');
      if (sClean !== 'inreview' && sClean !== 'underreview' && sClean !== 'submitted') {
        continue;
      }

      const project = this.findProjectForJob(task.projectId).project || this.projectsRepository?.findById?.(task.projectId);
      if (!project || !isLiveProject(project)) {
        skippedNotLive += 1;
        continue;
      }

      if (!task.inReviewSince) {
        continue;
      }
      const sinceMs = new Date(task.inReviewSince).getTime();
      if (isNaN(sinceMs) || sinceMs <= 0) {
        continue;
      }

      const elapsedMs = nowMs - sinceMs;
      if (elapsedMs < THREE_DAYS_MS) {
        continue;
      }

      // Check 7-day auto-approval first
      if (elapsedMs >= SEVEN_DAYS_MS) {
        if (task.xpAwarded || task.autoApproved) {
          continue;
        }
        const proof = task.proofLink !== undefined ? task.proofLink : task.proofUrl;
        const hasExplicitProof = proof !== undefined && proof !== null;
        const hasUnsafeProof =
          (task as any).proofCheckFailed === true ||
          (hasExplicitProof && (String(proof).trim() === '' || !isSafeHttpUrl(String(proof))));

        if (hasUnsafeProof) {
          skippedBadProofTasks.push(task.id);
          continue;
        }

        try {
          if (this.tasksService && typeof this.tasksService.approveTask === 'function') {
            this.tasksService.approveTask(task.id, {
              actorId: 'System',
              actorRole: 'superuser',
              autoApproved: true,
            });
          } else {
            task.status = TaskStatus.Completed;
            task.autoApproved = true;
            this.tasksRepository.update(task.id, {
              status: TaskStatus.Completed,
              autoApproved: true,
            } as any);
          }
          autoApprovedTasks.push(task.id);
        } catch (err: any) {
          errors.push(err?.message || String(err));
        }
        continue;
      }

      // 3-day to <7-day window: collect per owner and send one reminder per owner per run
      if (!task.reviewReminderSentAt) {
        try {
          if (project.ownerId) {
            const oid = String(project.ownerId);
            if (!remindersByOwner.has(oid)) {
              remindersByOwner.set(oid, { items: [], refProjectId: project.id, taskIds: [] });
            }
            const bucket = remindersByOwner.get(oid)!;
            bucket.items.push({
              label: `${task.title} (${project.title || project.name})`,
              link: `/owner/workspace/${project.id}`,
            });
            bucket.taskIds.push(task.id);
          }
          task.reviewReminderSentAt = nowIso;
          this.tasksRepository.update(task.id, { reviewReminderSentAt: nowIso } as any);
          remindedTasks.push(task.id);
        } catch (err: any) {
          errors.push(err?.message || String(err));
        }
      }
    }

    const revRunKey = nowIso.slice(0, 13);
    for (const [ownerId, bucket] of remindersByOwner.entries()) {
      try {
        dispatchGroupedNotification(
          this.notificationsService,
          ownerId,
          `task_review_reminder:${revRunKey}`,
          bucket.items,
          (groupedItems, count) => ({
            type: 'TASK_REVIEW_REMINDER',
            title: count > 1 ? `Tasks Need Review (${count})` : 'Task Review Needed',
            message:
              count === 1
                ? `Task ${groupedItems[0].label} has been waiting for your review for 3+ days.`
                : `${count} tasks have been waiting for your review for 3+ days: ${formatGroupedItemList(groupedItems, 10)}`,
            readStatus: false,
            referenceId: bucket.refProjectId,
            link: groupedItems[0]?.link || `/owner/workspace/${bucket.refProjectId}`,
            metadata: {
              ...(bucket.taskIds.length > 0 ? { taskId: bucket.taskIds[0] } : {}),
              taskIds: bucket.taskIds,
            },
          }),
        );
      } catch (err: any) {
        errors.push(err?.message || String(err));
      }
    }

    return {
      remindedTasks,
      autoApprovedTasks,
      skippedBadProofTasks,
      errors,
      skippedNotLive,
    };
  }

  /**
   * Finalizes scheduled project deletions whose notice period has expired.
   * Re-checks all hard blockers before executing.
   * If a blocker appeared, cancels scheduled deletion and notifies the owner.
   */
  async finalizeScheduledDeletions(): Promise<{
    processedProjects: string[];
    cancelledProjects: string[];
    errors: string[];
  }> {
    const processedProjects: string[] = [];
    const cancelledProjects: string[] = [];
    const errors: string[] = [];

    const nowMs = this.clockService ? this.clockService.now().getTime() : Date.now();
    const projects = this.projectsRepository.findAll(true);
    const scheduled = projects.filter(
      (p) => !p.deletedAt && p.deletionScheduledAt,
    );

    for (const project of scheduled) {
      const scheduledMs = new Date(project.deletionScheduledAt!).getTime();
      if (!Number.isNaN(scheduledMs) && scheduledMs <= nowMs) {
        try {
          const evalResult = this.projectsService
            .getDeletionPolicy()
            .evaluate(project.id, {
              uid: project.deletionRequestedBy || project.ownerId,
              id: project.deletionRequestedBy || project.ownerId,
              role: 'project-owner',
            });

          if (!evalResult.allowed) {
            // Cancel scheduled deletion due to blocker appearing
            const firstBlocker =
              evalResult.blockers[0]?.message || 'A blocker appeared during notice period.';
            this.projectsRepository.update(project.id, {
              deletionScheduledAt: undefined,
              deletionRequestedBy: undefined,
              status: project.previousStatus || 'Open',
              previousStatus: undefined,
            } as any);

            cancelledProjects.push(project.id);

            try {
              this.notificationsService.create({
                userId: String(project.ownerId),
                type: 'PROJECT_DELETION_CANCELLED_BLOCKER',
                title: 'Scheduled Deletion Cancelled',
                message: `Scheduled deletion for "${project.title || project.name}" was cancelled because a blocker appeared: ${firstBlocker}`,
                readStatus: false,
                referenceId: project.id,
              });
            } catch {}
          } else {
            // Execute final deletion
            this.projectsService.executeFinalDeletion(
              project.id,
              project.deletionRequestedBy || 'System',
              { reasonIds: [] },
            );
            processedProjects.push(project.id);
          }
        } catch (err: any) {
          errors.push(`Project ${project.id}: ${err?.message || err}`);
        }
      }
    }

    return { processedProjects, cancelledProjects, errors };
  }

  /**
   * Hourly job runner. Idempotent: safe to run multiple times.
   */
  async tickHourly(trigger: 'cron' | 'manual' = 'manual'): Promise<{
    timestamp: string;
    jobsExecuted: string[];
    runId?: string;
    run?: JobRun;
  }> {
    const run = await this.runTick(trigger);
    return {
      timestamp: run.startedAt,
      jobsExecuted: run.jobs.filter((j) => j.itemsProcessed > 0).map((j) => j.name),
      runId: run.id,
      run,
    };
  }
}
