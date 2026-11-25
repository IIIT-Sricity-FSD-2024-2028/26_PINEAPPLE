import { Injectable, Logger, Inject, forwardRef, BadRequestException, Optional } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { ReputationService } from '../moderation/reputation.service';
import { GamificationRepository } from '../gamification/gamification.repository';
import { TasksRepository } from '../tasks/tasks.repository';
import { ProjectsRepository } from '../projects/projects.repository';
import { DuplicateDetectionService } from './duplicate-detection.service';
import { ClockService } from '../common/services/clock.service';
import { REPUTATION_CONFIG } from '../reputation/reputation.config';

export interface VerifiedContributionOptions {
  minReviewGapMinutes?: number;
}

export function isVerifiedContribution(
  task: any,
  project: any,
  duplicateGroups: any[] = [],
  options: VerifiedContributionOptions = {},
): boolean {
  if (!task || !project) return false;

  // 1. Task status must be Approved
  const statusNorm = String(task.status || '').toLowerCase().trim();
  const isApproved = statusNorm === 'approved' || statusNorm === 'completed' || statusNorm === 'done';
  if (!isApproved) return false;

  // 2. Project must have at least 2 distinct people
  const distinctPeople = new Set<string>();
  const ownerId = String(project.ownerId || project.owner || '').trim();
  if (ownerId) distinctPeople.add(ownerId);

  const collabs = Array.isArray(project.collaborators) ? project.collaborators : [];
  for (const c of collabs) {
    const cid = typeof c === 'string' ? c.trim() : String(c?.id || c?.userId || '').trim();
    if (cid && cid.toLowerCase() !== 'unassigned') distinctPeople.add(cid);
  }

  const members = Array.isArray(project.members) ? project.members : [];
  for (const m of members) {
    const mid = typeof m === 'string' ? m.trim() : String(m?.id || m?.userId || '').trim();
    if (mid && mid.toLowerCase() !== 'unassigned') distinctPeople.add(mid);
  }

  if (distinctPeople.size < 2) return false;

  // 3. Approved at least TASK_MIN_REVIEW_GAP_MINUTES (60) after assignment
  if (!task.assignedAt) return false;
  const assignedMs = new Date(task.assignedAt).getTime();
  const approvedRaw = task.approvedAt || task.updatedAt;
  if (!approvedRaw) return false;
  const approvedMs = new Date(approvedRaw).getTime();
  if (isNaN(assignedMs) || isNaN(approvedMs)) return false;

  const minGapMinutes = options.minReviewGapMinutes ?? REPUTATION_CONFIG.TASK_MIN_REVIEW_GAP_MINUTES;
  const minGapMs = minGapMinutes * 60 * 1000;
  if (approvedMs - assignedMs < minGapMs) return false;

  // 4. Approver (owner) and assignee are not in the same possible-duplicate group
  const assigneeId = String(task.assigneeId || '').trim();
  if (!assigneeId) return false;

  if (Array.isArray(duplicateGroups) && duplicateGroups.length > 0) {
    const inSameDuplicate = duplicateGroups.some((group) => {
      const ids = new Set((group.users || []).map((u: any) => String(u.id || u.userId || '').trim()));
      return ids.has(ownerId) && ids.has(assigneeId);
    });
    if (inSameDuplicate) return false;
  }

  // 5. Not a self-approval
  if (ownerId && assigneeId === ownerId) return false;

  return true;
}

export function getWeekBucket(dateStrOrMs: string | number): string {
  const date = new Date(dateStrOrMs);
  const target = new Date(date.valueOf());
  const dayNr = (date.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
  }
  const weekNum = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  return `${target.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

export type TrustLabel =
  | 'New member'
  | 'Trusted contributor'
  | 'Reliable'
  | 'Rising'
  | 'Getting started';

export type StandingBand =
  | 'Good standing'
  | 'Fair standing'
  | 'Low standing';

export interface UserTrackRecord {
  tasksApproved: number;
  projectsCompleted: number;
  onTimeRate: number | null;
  memberSince: string | null;
  activeThisWeek: boolean;
}

export interface UserTrustSummary {
  userId: string;
  xp: number;
  label: TrustLabel;
  band: StandingBand;
  trackRecord: UserTrackRecord;
  reputation?: number;
  ledgerLink?: string;
  needsAttention?: boolean;
}

@Injectable()
export class TrustService {
  private readonly logger = new Logger(TrustService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    @Inject(forwardRef(() => ReputationService))
    private readonly reputationService: ReputationService,
    @Inject(forwardRef(() => GamificationRepository))
    private readonly gamificationRepository: GamificationRepository,
    @Optional()
    @Inject(forwardRef(() => TasksRepository))
    private readonly tasksRepository?: TasksRepository,
    @Optional()
    @Inject(forwardRef(() => ProjectsRepository))
    private readonly projectsRepository?: ProjectsRepository,
    @Optional()
    @Inject(forwardRef(() => DuplicateDetectionService))
    private readonly duplicateDetectionService?: DuplicateDetectionService,
    @Optional()
    private readonly clockService?: ClockService,
  ) {}

  private getNowMs(): number {
    return this.clockService?.now() ? this.clockService.now().getTime() : Date.now();
  }

  isVerifiedContribution(
    task: any,
    project: any,
    duplicateGroups: any[] = [],
    options: VerifiedContributionOptions = {},
  ): boolean {
    return isVerifiedContribution(task, project, duplicateGroups, options);
  }

  computeStandingBand(reputation: number): StandingBand {
    if (reputation >= REPUTATION_CONFIG.GOOD_STANDING_MIN) {
      return 'Good standing';
    } else if (reputation >= REPUTATION_CONFIG.FAIR_STANDING_MIN) {
      return 'Fair standing';
    } else {
      return 'Low standing';
    }
  }

  computeTrustLabel(
    reputation: number,
    trackRecord: Partial<UserTrackRecord>,
    user: any,
    wasSuspendedLast90Days: boolean = false,
    now: Date = new Date(),
  ): TrustLabel {
    const nowMs = now.getTime();
    const createdMs = user?.createdAt ? new Date(user.createdAt).getTime() : 0;
    const isAccountUnder14Days = nowMs - createdMs < REPUTATION_CONFIG.NEW_MEMBER_MAX_DAYS * 24 * 60 * 60 * 1000;
    const tasksApproved = trackRecord.tasksApproved || 0;
    const isNewMember = tasksApproved <= REPUTATION_CONFIG.NEW_MEMBER_MAX_TASKS && isAccountUnder14Days;

    if (isNewMember) {
      return 'New member';
    } else if (
      reputation >= REPUTATION_CONFIG.TRUSTED_MIN_REP &&
      tasksApproved >= REPUTATION_CONFIG.TRUSTED_MIN_TASKS &&
      (trackRecord.projectsCompleted || 0) >= REPUTATION_CONFIG.TRUSTED_MIN_PROJECTS &&
      trackRecord.onTimeRate !== null &&
      trackRecord.onTimeRate !== undefined &&
      trackRecord.onTimeRate >= REPUTATION_CONFIG.TRUSTED_MIN_ON_TIME &&
      !wasSuspendedLast90Days
    ) {
      return 'Trusted contributor';
    } else if (
      reputation >= REPUTATION_CONFIG.RELIABLE_MIN_REP &&
      tasksApproved >= REPUTATION_CONFIG.RELIABLE_MIN_TASKS &&
      ((trackRecord.onTimeRate !== null &&
        trackRecord.onTimeRate !== undefined &&
        trackRecord.onTimeRate >= REPUTATION_CONFIG.RELIABLE_MIN_ON_TIME) ||
        (trackRecord.onTimeRate === null && tasksApproved < 3 && !isNewMember))
    ) {
      return 'Reliable';
    } else if (tasksApproved >= 1) {
      return 'Rising';
    } else {
      return 'Getting started';
    }
  }

  getTrackRecord(userId: string): UserTrackRecord {
    const summary = this.getSummary(userId);
    return summary.trackRecord;
  }

  getUserTrustSummary(userId: string, viewer?: any): UserTrustSummary {
    return this.getSummary(userId, viewer);
  }

  getAnonymizedSummary(userId: string, isSelfOrAdmin: boolean = false, isAdmin: boolean = false): UserTrustSummary {
    const summary: UserTrustSummary = {
      userId: String(userId),
      xp: 0,
      label: 'Getting started',
      band: 'Good standing',
      trackRecord: {
        tasksApproved: 0,
        projectsCompleted: 0,
        onTimeRate: null,
        memberSince: null,
        activeThisWeek: false,
      },
    };

    if (isSelfOrAdmin) {
      summary.reputation = REPUTATION_CONFIG.START_POINTS;
      summary.ledgerLink = isAdmin ? `/admin/users/${userId}/reputation` : '/users/me/reputation';
      if (isAdmin) {
        summary.needsAttention = false;
      }
    }

    return summary;
  }

  /**
   * Computes a full trust summary for a single user according to Policy 1-6.
   */
  getSummary(userId: string, viewer?: any): UserTrustSummary {
    const uid = String(userId || '').trim();
    if (!uid) return this.getAnonymizedSummary(uid);

    const user = this.usersRepository.findById(uid);
    if (!user || user.isDeleted || user.deletedAt) {
      return this.getAnonymizedSummary(uid);
    }

    const viewerId = viewer ? String(viewer.uid || viewer.id || '').trim() : '';
    const viewerRole = viewer ? String(viewer.role || '').toLowerCase().trim() : '';
    const isAdmin =
      viewerRole === 'admin' ||
      viewerRole === 'administrator' ||
      viewerRole === 'superuser' ||
      viewer?.isAdmin === true ||
      viewer?.isSuperuser === true;
    const isSelfOrAdmin = (viewerId && viewerId === uid) || isAdmin;

    const nowMs = this.getNowMs();
    const reputation = this.reputationService.getTotal(uid);

    // 1. XP (from Gamification Repository ledger)
    const ledger = this.gamificationRepository.findByUserId(uid) || [];
    const xp = ledger.reduce((sum, e) => sum + (Number(e.xp) || 0), 0);

    // 2. Verified Contributions & Track Record
    const allTasks = this.tasksRepository?.findAll() || [];
    const allProjects = this.projectsRepository?.findAll() || [];
    const projectMap = new Map<string, any>();
    for (const p of allProjects) {
      projectMap.set(String(p.id), p);
    }

    const duplicateGroups =
      this.duplicateDetectionService?.computeDuplicateGroups?.()?.groups || [];

    // Filter tasks assigned to this user
    const userTasks = allTasks.filter((t) => String(t.assigneeId || '').trim() === uid);

    // Filter verified tasks
    const verifiedTasks: any[] = [];
    for (const t of userTasks) {
      const proj = projectMap.get(String(t.projectId));
      if (proj && isVerifiedContribution(t, proj, duplicateGroups)) {
        verifiedTasks.push(t);
      }
    }

    // Sort by approval date ascending
    verifiedTasks.sort((a, b) => {
      const aTime = new Date(a.approvedAt || a.updatedAt || 0).getTime();
      const bTime = new Date(b.approvedAt || b.updatedAt || 0).getTime();
      return aTime - bTime;
    });

    // Apply weekly cap: max 10 verified tasks from the same owner-collaborator pair per week
    const pairWeekCounts = new Map<string, number>();
    const cappedVerifiedTasks: any[] = [];

    for (const t of verifiedTasks) {
      const proj = projectMap.get(String(t.projectId));
      const ownerId = String(proj?.ownerId || proj?.owner || '').trim();
      const approvedTime = new Date(t.approvedAt || t.updatedAt || nowMs).getTime();
      const weekBucket = getWeekBucket(approvedTime);
      const pairWeekKey = `${ownerId}:${uid}:${weekBucket}`;

      const count = pairWeekCounts.get(pairWeekKey) || 0;
      if (count < REPUTATION_CONFIG.WEEKLY_PAIR_TASK_CAP) {
        pairWeekCounts.set(pairWeekKey, count + 1);
        cappedVerifiedTasks.push(t);
      }
    }

    const tasksApproved = cappedVerifiedTasks.length;

    // Completed projects where user had at least one verified task
    const completedProjectIds = new Set<string>();
    for (const t of cappedVerifiedTasks) {
      const proj = projectMap.get(String(t.projectId));
      if (proj && (proj.isCompleted || String(proj.status || '').toLowerCase() === 'completed')) {
        completedProjectIds.add(String(proj.id));
      }
    }
    const projectsCompleted = completedProjectIds.size;

    // On-time rate: verified tasks with dueDate
    const tasksWithDueDate = cappedVerifiedTasks.filter((t) => Boolean(t.dueDate || t.due));
    let onTimeRate: number | null = null;
    if (tasksWithDueDate.length >= 3) {
      const onTimeCount = tasksWithDueDate.filter((t) => {
        const subRaw = t.submittedAt || t.inReviewSince || t.updatedAt;
        const dueRaw = t.dueDate || t.due;
        const subMs = new Date(subRaw).getTime();
        const dueMs = new Date(dueRaw).getTime();
        return !isNaN(subMs) && !isNaN(dueMs) && subMs <= dueMs;
      }).length;
      onTimeRate = Math.round((onTimeCount / tasksWithDueDate.length) * 100);
    }

    // Member since
    const memberSince = user.createdAt ? new Date(user.createdAt).toISOString() : null;

    // Active this week (within 7 days)
    const sevenDaysAgoMs = nowMs - 7 * 24 * 60 * 60 * 1000;
    const hasRecentTaskActivity = userTasks.some((t) => {
      const times = [t.approvedAt, t.assignedAt, t.submittedAt, t.inReviewSince, t.updatedAt, t.createdAt];
      return times.some((tm) => tm && new Date(tm).getTime() >= sevenDaysAgoMs);
    });
    const hasRecentUserActivity = Boolean(
      (user as any).lastActive && new Date((user as any).lastActive).getTime() >= sevenDaysAgoMs,
    );
    const activeThisWeek = hasRecentTaskActivity || hasRecentUserActivity;

    // Suspension in last 90 days
    const ninetyDaysAgoMs = nowMs - REPUTATION_CONFIG.TRUSTED_MAX_SUSPENSION_DAYS * 24 * 60 * 60 * 1000;
    const wasSuspendedLast90Days = Boolean(
      (user as any).suspendedAt && new Date((user as any).suspendedAt).getTime() >= ninetyDaysAgoMs,
    );

    // 3. Trust Label
    const createdMs = user.createdAt ? new Date(user.createdAt).getTime() : 0;
    const isAccountUnder14Days = nowMs - createdMs < REPUTATION_CONFIG.NEW_MEMBER_MAX_DAYS * 24 * 60 * 60 * 1000;
    const isNewMember = tasksApproved <= REPUTATION_CONFIG.NEW_MEMBER_MAX_TASKS && isAccountUnder14Days;

    let label: TrustLabel;
    if (isNewMember) {
      label = 'New member';
    } else if (
      reputation >= REPUTATION_CONFIG.TRUSTED_MIN_REP &&
      tasksApproved >= REPUTATION_CONFIG.TRUSTED_MIN_TASKS &&
      projectsCompleted >= REPUTATION_CONFIG.TRUSTED_MIN_PROJECTS &&
      onTimeRate !== null &&
      onTimeRate >= REPUTATION_CONFIG.TRUSTED_MIN_ON_TIME &&
      !wasSuspendedLast90Days
    ) {
      label = 'Trusted contributor';
    } else if (
      reputation >= REPUTATION_CONFIG.RELIABLE_MIN_REP &&
      tasksApproved >= REPUTATION_CONFIG.RELIABLE_MIN_TASKS &&
      ((onTimeRate !== null && onTimeRate >= REPUTATION_CONFIG.RELIABLE_MIN_ON_TIME) ||
        (onTimeRate === null && tasksApproved < 3 && !isNewMember))
    ) {
      label = 'Reliable';
    } else if (tasksApproved >= 1) {
      label = 'Rising';
    } else {
      label = 'Getting started';
    }

    // 4. Standing Band
    let band: StandingBand;
    if (reputation >= REPUTATION_CONFIG.GOOD_STANDING_MIN) {
      band = 'Good standing';
    } else if (reputation >= REPUTATION_CONFIG.FAIR_STANDING_MIN) {
      band = 'Fair standing';
    } else {
      band = 'Low standing';
    }

    const trackRecord: UserTrackRecord = {
      tasksApproved,
      projectsCompleted,
      onTimeRate,
      memberSince,
      activeThisWeek,
    };

    const summary: UserTrustSummary = {
      userId: uid,
      xp,
      label,
      band,
      trackRecord,
    };

    if (isSelfOrAdmin) {
      summary.reputation = reputation;
      summary.ledgerLink = isAdmin ? `/admin/users/${uid}/reputation` : '/users/me/reputation';
      if (isAdmin) {
        summary.needsAttention = reputation < REPUTATION_CONFIG.NEEDS_ATTENTION_THRESHOLD;
      }
    }

    return summary;
  }

  /**
   * Bulk trust summaries computation. Max 50 IDs.
   */
  getSummaries(userIds: string[], viewer?: any): UserTrustSummary[] {
    if (!Array.isArray(userIds)) return [];

    if (userIds.length > 50) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'TOO_MANY_IDS',
        message: 'Maximum 50 user IDs allowed per request.',
      });
    }

    return userIds.map((id) => this.getSummary(id, viewer));
  }
}
