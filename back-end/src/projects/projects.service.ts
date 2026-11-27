import {
  Injectable,
  Optional,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  forwardRef,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { LeaveProjectDto, LEAVE_CATEGORIES } from './dto/leave-project.dto';
import { ChangeDeadlineDto } from './dto/change-deadline.dto';
import { ProjectsRepository, Project } from './projects.repository';
import { CreateProjectDto, ProjectStatus } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { TasksService } from '../tasks/tasks.service';
import { TaskStatus } from '../tasks/dto/create-task.dto';
import { JoinRequestsService } from '../join-requests/join-requests.service';
import {
  NotificationsService,
  NotificationGroupedItem,
  dispatchGroupedNotification,
  formatGroupedItemList,
} from '../notifications/notifications.service';
import { MentorMarketplaceService } from '../mentor-marketplace/mentor-marketplace.service';
import { calculateProjectProgress } from '../common/utils/progress.util';
import { assertSafeHttpUrl } from '../common/utils/url.util';
import { getApprovedCollaboratorsCount, getEffectiveMaxCollaborators, isProjectFull } from '../common/utils/capacity.util';
import { AuditService } from '../audit/audit.service';
import { PlatformConfigService } from '../platform-config/platform-config.service';
import { UsersService } from '../users/users.service';
import { isProjectOwner, isPlatformAdminOrSuperUser, getProjectRole, ProjectMemberRole } from '../common/utils/role.util';
import { ClockService } from '../common/services/clock.service';
import { GamificationService, COMPLETION_BADGE_MIN_TASKS } from '../gamification/gamification.service';
import { SupportService } from '../support/support.service';
import { TemplatesService as TemplatesServiceToken } from './templates.service';
import { computeSkillMatch, SkillMatchResult } from '../common/utils/skill-match.util';
import { ContentFilterService } from '../common/services/content-filter.service';
import { DuplicateDetectionService } from '../users/duplicate-detection.service';
import { isVisibleProject, isLiveProject, isProjectLocked } from './project-visibility.util';
import { ProjectInvitesService } from './invites.service';
import { normalizeProjectCategory } from './config/starter-task-templates.config';
import type { TemplatesService } from './templates.service';
import { FeedbackService } from '../feedback/feedback.service';
import { DeletionPolicyService } from './deletion-policy.service';

export { isProjectOwner, isPlatformAdminOrSuperUser, isVisibleProject, isLiveProject, isProjectLocked, getProjectRole, ProjectMemberRole };

export interface ProjectMemberRow {
  id: string;
  userId: string;
  name: string;
  username?: string;
  role: 'Owner' | 'Collaborator' | 'Mentor';
  initials?: string;
  avatarUrl?: string | null;
  updatedAt?: string | null;
  joinedAt?: string;
  lastActiveAt?: string;
  lastActivityAt?: string;
  inactiveDays?: number;
  isInactive?: boolean;
  isDeleted?: boolean;
}

export interface RemovalBlockerTask {
  taskId: string;
  title: string;
  submittedAt?: string;
}

export interface RemovalTaskSummary {
  taskId: string;
  title: string;
  status: string;
}

export interface RemovalCheckResult {
  allowed: boolean;
  blockers: RemovalBlockerTask[];
  tasksToRelease: RemovalTaskSummary[];
  tasksKept: RemovalTaskSummary[];
}

export function isProjectActive(project?: Partial<Project> | null): boolean {
  if (!isLiveProject(project)) return false;
  const status = typeof project?.status === 'string' ? project.status.toLowerCase().trim() : '';
  return status !== 'archived';
}

@Injectable()
export class ProjectsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly projectsRepository: ProjectsRepository,
    @Inject(forwardRef(() => TasksService))
    private readonly tasksService: any,
    @Inject(forwardRef(() => JoinRequestsService))
    private readonly joinRequestsService: any,
    private readonly notificationsService: NotificationsService,
    private readonly mentorMarketplaceService: MentorMarketplaceService,
    private readonly auditService: AuditService,
    private readonly platformConfigService: PlatformConfigService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: any,
    @Optional()
    private readonly clockService?: ClockService,
    @Optional()
    @Inject(forwardRef(() => GamificationService))
    private readonly gamificationService?: GamificationService,
    @Optional()
    @Inject(forwardRef(() => SupportService))
    private readonly supportService?: SupportService,
    @Optional()
    private readonly contentFilterService?: ContentFilterService,
    @Optional()
    private readonly duplicateDetectionService?: DuplicateDetectionService,
    @Optional()
    @Inject(forwardRef(() => ProjectInvitesService))
    private readonly projectInvitesService?: any,
    @Optional()
    @Inject(forwardRef(() => TemplatesServiceToken))
    private readonly templatesService?: TemplatesService,
    @Optional()
    private readonly feedbackService?: FeedbackService,
    @Optional()
    @Inject(forwardRef(() => DeletionPolicyService))
    private readonly deletionPolicyService?: any,
  ) {}

  getDeletionPolicy(): DeletionPolicyService {
    if (this.deletionPolicyService) {
      return this.deletionPolicyService;
    }
    return new DeletionPolicyService(
      this.projectsRepository,
      this.tasksService,
      this.mentorMarketplaceService,
      this.joinRequestsService,
      this.projectInvitesService,
      this.clockService,
    );
  }

  getProjectRaw(id: string): Project | undefined {
    return this.projectsRepository.findById(id);
  }

  isLiveProject(project?: Partial<Project> | null): boolean {
    return isLiveProject(project);
  }

  getProjectRole(projectIdOrProject: any, userIdOrUser: any): ProjectMemberRole {
    const project = typeof projectIdOrProject === 'string'
      ? this.findById(projectIdOrProject)
      : projectIdOrProject;
    if (!project) return null;
    return getProjectRole(project, userIdOrUser);
  }

  auditProjectRolesIntegrity(): { projectId: string; duplicateUsers: string[] }[] {
    const allProjects = this.projectsRepository.findAll(true) || [];
    const issues: { projectId: string; duplicateUsers: string[] }[] = [];

    for (const project of allProjects) {
      if (!project) continue;
      const userRoles = new Map<string, Set<string>>();

      const ownerId = String(
        project.ownerId !== undefined && project.ownerId !== null
          ? project.ownerId
          : (typeof project.owner === 'object' && project.owner ? ((project.owner as any).id || (project.owner as any).userId) : '')
      ).trim();
      if (ownerId) {
        if (!userRoles.has(ownerId)) userRoles.set(ownerId, new Set());
        userRoles.get(ownerId)!.add('Owner');
      }

      const mentorId = String(
        project.mentorId !== undefined && project.mentorId !== null
          ? project.mentorId
          : (typeof project.mentor === 'object' && project.mentor ? ((project.mentor as any).id || (project.mentor as any).userId) : '')
      ).trim();
      if (mentorId) {
        if (!userRoles.has(mentorId)) userRoles.set(mentorId, new Set());
        userRoles.get(mentorId)!.add('Mentor');
      }

      const collabs = Array.isArray(project.collaborators) ? project.collaborators : [];
      const removedUsers = Array.isArray(project.removedUsers) ? project.removedUsers : [];
      for (const c of collabs) {
        const cId = String(typeof c === 'string' ? c : (c?.id || c?.userId || '')).trim();
        if (!cId) continue;
        const isRemoved = removedUsers.some((r: any) => {
          const rId = String(typeof r === 'object' ? (r.userId || r.id || '') : r).trim();
          return rId && rId === cId;
        });
        if (isRemoved) continue;
        if (!userRoles.has(cId)) userRoles.set(cId, new Set());
        userRoles.get(cId)!.add('Collaborator');
      }

      const dups: string[] = [];
      for (const [uid, roles] of userRoles.entries()) {
        if (roles.size > 1) {
          dups.push(uid);
          console.warn(
            `[Startup Integrity Check] Project ${project.id} has user ${uid} in multiple roles: ${Array.from(roles).join(', ')}`,
          );
        }
      }

      if (dups.length > 0) {
        issues.push({ projectId: String(project.id), duplicateUsers: dups });
      }
    }

    return issues;
  }

  private resolveCompletedMentorUserId(project: any): string | null {
    if (!project) return null;
    const rawMentor =
      project.completedMentorUserId ||
      project.mentorUserId ||
      project.mentorId ||
      (typeof project.mentor === 'object' && project.mentor
        ? project.mentor.userId || project.mentor.id
        : '');

    let candidate = rawMentor ? String(rawMentor).trim() : '';

    if (!candidate && Array.isArray(project.members)) {
      const mRow = project.members.find(
        (m: any) => String(m?.role || '').trim().toLowerCase() === 'mentor',
      );
      if (mRow) {
        candidate = String(mRow.userId || mRow.id || '').trim();
      }
    }

    if (!candidate && this.mentorMarketplaceService?.getSessionsByProject) {
      try {
        const sessions = this.mentorMarketplaceService.getSessionsByProject(project.id) || [];
        const qualifying = sessions.find((s: any) => {
          const st = String(s?.status || '').toLowerCase();
          return ['completed', 'released', 'active', 'accepted', 'settled', 'paid_out', 'split'].includes(st);
        });
        if (qualifying?.mentorId) {
          candidate = String(qualifying.mentorId).trim();
        }
      } catch {
        // Ignore session lookup error
      }
    }

    if (!candidate) return null;

    if (typeof (this.mentorMarketplaceService as any)?.findProfileById === 'function') {
      try {
        const prof = (this.mentorMarketplaceService as any).findProfileById(candidate);
        if (prof?.userId) return String(prof.userId);
      } catch {
        // Ignore profile resolution failure
      }
    }
    return candidate;
  }

  backfillCompletedProjectMentors(): number {
    const allProjects = this.projectsRepository.findAll(true) || [];
    let fixedCount = 0;

    for (const p of allProjects) {
      if (!p) continue;
      const isComp =
        p.isCompleted === true || String(p.status || '').toLowerCase() === 'completed';
      if (!isComp) continue;

      const mentorUserId = this.resolveCompletedMentorUserId(p);
      if (!mentorUserId) continue;

      const existingIds = Array.isArray((p as any).completedMemberIds)
        ? (p as any).completedMemberIds.map((x: any) => String(x))
        : [];
      const needsMentorField = !(p as any).completedMentorUserId;
      const needsMemberId = !existingIds.includes(mentorUserId);

      if (needsMentorField || needsMemberId) {
        const nextIds = needsMemberId ? [...existingIds, mentorUserId] : existingIds;
        this.projectsRepository.update(p.id, {
          completedMentorUserId: mentorUserId,
          mentorUserId: (p as any).mentorUserId || mentorUserId,
          completedMemberIds: nextIds,
        } as any);
        fixedCount += 1;
      }
    }

    this.logger.log(
      `Backfilled mentor completion metadata for ${fixedCount} completed project(s).`,
    );
    return fixedCount;
  }

  onApplicationBootstrap() {
    this.migrateProjectOwners();
    this.repairSuspendedProjects();
    this.auditProjectRolesIntegrity();
    this.backfillCompletedProjectMentors();

    if (this.feedbackService) {
      this.feedbackService.registerEntityResolver('PROJECT', (id: string) => {
        const proj = this.findById(id);
        if (!proj) return { exists: false, parties: [] };
        const parties = [String(proj.ownerId)];
        if (Array.isArray(proj.collaborators)) {
          for (const c of proj.collaborators) {
            const cid = typeof c === 'string' ? c : (c.id || c.userId);
            if (cid && !parties.includes(String(cid))) parties.push(String(cid));
          }
        }
        if (proj.mentorId && !parties.includes(String(proj.mentorId))) {
          parties.push(String(proj.mentorId));
        }
        return {
          exists: true,
          projectId: id,
          parties,
          actorId: String(proj.ownerId),
        };
      });

      this.feedbackService.registerEntityResolver('MEMBERSHIP', (compositeId: string) => {
        const parts = compositeId.split(':');
        const projId = parts[0];
        const memberId = parts[1] || parts[0];
        let proj: any;
        try {
          proj = this.findById(projId);
        } catch {}
        const parties = [memberId];
        if (proj?.ownerId && !parties.includes(String(proj.ownerId))) {
          parties.push(String(proj.ownerId));
        }
        return {
          exists: true,
          projectId: projId,
          parties,
          targetId: memberId,
          actorId: proj?.ownerId ? String(proj.ownerId) : undefined,
        };
      });
    }
  }

  /**
   * One-time data repair at startup: if any stored project has the status Suspended,
   * set it back to Open or In Progress based on its tasks and log the change.
   */
  repairSuspendedProjects(): void {
    try {
      const projects = this.projectsRepository.findAll();
      for (const project of projects) {
        if (String(project.status || '').toLowerCase() === 'suspended') {
          let hasActiveTasks = false;
          try {
            const tasks = this.tasksService.findAllByProjectId(project.id);
            hasActiveTasks = tasks.some((t: any) => {
              const st = String(t.status || '').toLowerCase();
              return st === 'in-progress' || st === 'in progress' || st === 'completed' || st === 'in review' || st === 'in-review';
            });
          } catch {
            hasActiveTasks = false;
          }
          const newStatus = hasActiveTasks ? ProjectStatus.InProgress : ProjectStatus.Open;
          project.status = newStatus;
          try {
            this.projectsRepository.update(project.id, { status: newStatus });
          } catch (err: any) {
        console.warn('[projects.service] Suppressed non-critical error:', err?.message || err);
      }
          this.logger.log(
            `[Project Data Repair] Project "${project.title || project.id}" status changed from Suspended to ${newStatus} based on tasks.`,
          );
        }
      }
    } catch (err: any) {
      this.logger.error(`[Project Data Repair] Error repairing suspended projects: ${err?.message}`);
    }
  }

  /**
   * One-time migration at startup that fills ownerId for every project
   * from the stored owner name or email (and logs any project it cannot map).
   */
  migrateProjectOwners(): void {
    try {
      const projects = this.projectsRepository.findAll();
      const allUsers = this.usersService.findAll();

      for (const project of projects) {
        let mappedUser: any = null;

        if (project.ownerId) {
          mappedUser = allUsers.find(
            (u) =>
              String(u.id) === String(project.ownerId) ||
              String((u as any).uid || '') === String(project.ownerId),
          );
        }

        if (!mappedUser) {
          const ownerCandidate =
            typeof project.owner === 'object' && project.owner !== null
              ? (project.owner as any).id || (project.owner as any).email || (project.owner as any).name
              : project.owner || (project as any).ownerName || (project as any).ownerEmail;

          if (ownerCandidate) {
            const candStr = String(ownerCandidate).trim().toLowerCase();
            mappedUser = allUsers.find((u) => {
              const idMatch =
                String(u.id).toLowerCase() === candStr ||
                String((u as any).uid || '').toLowerCase() === candStr;
              const emailMatch = u.email && u.email.toLowerCase() === candStr;
              const usernameMatch = u.username && u.username.toLowerCase() === candStr;
              const nameMatch = u.name && u.name.toLowerCase() === candStr;
              return idMatch || emailMatch || usernameMatch || nameMatch;
            });
          }
        }

        if (mappedUser) {
          project.ownerId = String(mappedUser.id);
          this.logger.log(
            `[Migration] Project "${project.title || project.id}" ownerId set to "${mappedUser.id}" (${mappedUser.name})`,
          );
        } else {
          this.logger.warn(
            `[Migration] Could not map project "${project.title || project.id}" (owner: "${project.owner}", ownerId: "${project.ownerId}") to an ownerId`,
          );
        }
      }
    } catch (err: any) {
      this.logger.error(`[Migration] Error during project owner migration: ${err?.message}`);
    }
  }

  isFull(projectOrId: Project | string, platformCap?: number): boolean {
    const project = typeof projectOrId === 'string' ? this.projectsRepository.findById(projectOrId) : projectOrId;
    if (!project) return false;
    const config = this.platformConfigService.getConfig();
    const effectiveCap = platformCap || (config as any).maxCollaboratorCapacity || config.maxCollaboratorsPerProject || 20;
    return isProjectFull(project, effectiveCap);
  }

  getCollaboratorsCount(projectOrId: Project | string): number {
    const project = typeof projectOrId === 'string' ? this.projectsRepository.findById(projectOrId) : projectOrId;
    if (!project) return 0;
    return getApprovedCollaboratorsCount(project);
  }

  getMaxCollaborators(projectOrId: Project | string, platformCap?: number): number {
    const project = typeof projectOrId === 'string' ? this.projectsRepository.findById(projectOrId) : projectOrId;
    if (!project) return 5;
    const config = this.platformConfigService.getConfig();
    const effectiveCap = platformCap || (config as any).maxCollaboratorCapacity || config.maxCollaboratorsPerProject || 20;
    return getEffectiveMaxCollaborators(project, effectiveCap);
  }

  isLocked(projectOrId: Project | string): boolean {
    const project = typeof projectOrId === 'string' ? this.projectsRepository.findById(projectOrId) : projectOrId;
    return isProjectLocked(project);
  }

  isActive(projectOrId: Project | string): boolean {
    const project = typeof projectOrId === 'string' ? this.projectsRepository.findById(projectOrId) : projectOrId;
    return isProjectActive(project);
  }

  private getInitials(name: string): string {
    if (!name) return 'TF';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  recalculateAndPersistProgress(projectId: string): number {
    try {
      const project = this.projectsRepository.findById(projectId);
      if (!project) return 0;
      if (this.isLocked(project) || project.isCompleted) {
        project.progress = 100;
        return 100;
      }
      const tasks = this.tasksService.findAllByProjectId(projectId);
      const progress = calculateProjectProgress(tasks);
      project.progress = progress;
      return progress;
    } catch {
      return 0;
    }
  }

  private enrichProject(project: Project): Project {
    // 3b: Fix projects already wrongly marked completed with no final link: set them back to In Progress on load
    if (
      (project.isCompleted || String(project.status).toLowerCase() === 'completed') &&
      !project.finalLink &&
      !project.finishedLink
    ) {
      project.isCompleted = false;
      project.status = ProjectStatus.InProgress;
      project.completedAt = undefined;
      try {
        this.projectsRepository.update(project.id, {
          isCompleted: false,
          status: ProjectStatus.InProgress,
          completedAt: undefined,
        });
      } catch (err: any) {
        console.warn('[projects.service] Suppressed non-critical error:', err?.message || err);
      }
    }

    if (String(project.status || '').toLowerCase() === 'suspended') {
      let hasActiveTasks = false;
      try {
        const tasks = this.tasksService.findAllByProjectId(project.id);
        hasActiveTasks = tasks.some((t: any) => {
          const st = String(t.status || '').toLowerCase();
          return st === 'in-progress' || st === 'in progress' || st === 'completed' || st === 'in review' || st === 'in-review';
        });
      } catch {
        hasActiveTasks = false;
      }
      const repairedStatus = hasActiveTasks ? ProjectStatus.InProgress : ProjectStatus.Open;
      project.status = repairedStatus;
      try {
        this.projectsRepository.update(project.id, { status: repairedStatus });
      } catch (err: any) {
        console.warn('[projects.service] Suppressed non-critical error:', err?.message || err);
      }
    }

    if (this.isLocked(project) || project.isCompleted) {
      project.progress = 100;
    } else {
      try {
        const tasks = this.tasksService.findAllByProjectId(project.id);
        project.progress = calculateProjectProgress(tasks);
      } catch {
        project.progress = Number(project.progress) || 0;
      }
    }

    const config = this.platformConfigService.getConfig();
    const platformCap = (config as any).maxCollaboratorCapacity || config.maxCollaboratorsPerProject || 20;
    const approvedCollabCount = getApprovedCollaboratorsCount(project);
    const effectiveMax = getEffectiveMaxCollaborators(project, platformCap);
    const isFull = approvedCollabCount >= effectiveMax;

    (project as any).approvedCollaboratorCount = approvedCollabCount;
    (project as any).collaboratorCount = approvedCollabCount;
    (project as any).maxCollaborators = effectiveMax;
    (project as any).isFull = isFull;

    const isOwnerOrMentorEntry = (entry: any) => {
      if (!entry || typeof entry !== 'object') return false;
      const r = String(entry.role || '').trim().toLowerCase();
      return r === 'owner' || r === 'mentor';
    };

    let rawCollabs = Array.isArray(project.collaborators) && project.collaborators.length > 0
      ? project.collaborators.filter((c: any) => !isOwnerOrMentorEntry(c))
      : (Array.isArray(project.members)
        ? project.members.filter((m: any) => !isOwnerOrMentorEntry(m))
        : []);
    if ((!project.collaborators || project.collaborators.length === 0) && rawCollabs.length > 0) {
      project.collaborators = rawCollabs;
    }
    const collabs = rawCollabs.filter((c: any) => {
      if (isOwnerOrMentorEntry(c)) return false;
      const cId = String(typeof c === 'string' ? c : (c.id || c.userId || '')).trim();
      const cName = typeof c === 'string' ? c.trim().toLowerCase() : (c.name ? String(c.name).trim().toLowerCase() : '');
      const isRemoved = Array.isArray(project.removedUsers) && project.removedUsers.some((r: any) => {
        const rId = String(typeof r === 'object' ? (r.userId || r.id || '') : r).trim();
        const rName = typeof r === 'object' && r.userName ? String(r.userName).trim().toLowerCase() : '';
        if (rId && cId && rId === cId) return true;
        if (rName && cName && rName === cName) return true;
        return false;
      });
      return !isRemoved;
    });
    const userNamesMap: Record<string, string> = {
      '1': 'Priya Patel',
      '2': 'Arjun Sharma',
      '3': 'Kiran Bose',
      '4': 'Rohan Mehta',
      '5': 'Sneha Iyer',
      '6': 'Aditya Sai',
      '7': 'Neha Gupta',
      '8': 'Vikram Nair',
    };
    const ownerRecord = project.ownerId ? this.usersService?.findUserSafe?.(String(project.ownerId)) : null;
    const isOwnerDeleted = Boolean(ownerRecord?.isDeleted || ownerRecord?.deletedAt);
    const rawOwner = project.owner;
    let ownerName = isOwnerDeleted
      ? 'Deleted user'
      : (typeof rawOwner === 'object' && rawOwner !== null ? ((rawOwner as any).name || 'Owner') : (rawOwner || ''));
    if (!isOwnerDeleted && (!ownerName || /^\d+$/.test(String(ownerName)))) {
      ownerName = userNamesMap[String(project.ownerId)] || userNamesMap[String(ownerName)] || 'Project Owner';
    }
    project.owner = ownerName;

    // Resolve mentor if not directly set
    if (!project.mentorId || !project.mentor) {
      try {
        const sessions = this.mentorMarketplaceService.getSessionsByProject(project.id);
        const activeSession = sessions?.find((s) => {
          const st = String(s.status || '').toLowerCase();
          return st === 'active' || st === 'completed' || st === 'in_progress' || st === 'accepted';
        });
        if (activeSession) {
          project.mentorId = project.mentorId || activeSession.mentorId;
          if (!project.mentor) {
            try {
              const mentorUser = this.usersService.findUserSafe(activeSession.mentorId);
              if (mentorUser?.isDeleted || mentorUser?.deletedAt) {
                project.mentor = 'Deleted user';
              } else {
                const mentorInfo = this.mentorMarketplaceService.getMentor(activeSession.mentorId);
                if (mentorInfo?.profile?.name) {
                  project.mentor = mentorInfo.profile.name;
                } else if (mentorUser) {
                  project.mentor = mentorUser.name;
                }
              }
            } catch {
              const u = this.usersService.findUserSafe(activeSession.mentorId);
              if (u) project.mentor = u.isDeleted || u.deletedAt ? 'Deleted user' : u.name;
            }
          }
        }
      } catch (err: any) {
        console.warn('[projects.service] Suppressed non-critical error:', err?.message || err);
      }
    }

    const mentorRecord = project.mentorId ? this.usersService?.findUserSafe?.(String(project.mentorId)) : null;
    const isMentorDeleted = Boolean(mentorRecord?.isDeleted || mentorRecord?.deletedAt);
    const mentorName = isMentorDeleted
      ? 'Deleted user'
      : (typeof project.mentor === 'object' && project.mentor !== null
        ? (project.mentor.name || project.mentor.title || 'Mentor')
        : (project.mentor || (project.mentorId ? 'Mentor' : '')));
    if (mentorName && typeof project.mentor !== 'string') {
      project.mentor = mentorName;
    }

    const nowMs = this.clockService ? this.clockService.now().getTime() : Date.now();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const DAY_MS = 24 * 60 * 60 * 1000;
    const memberActivityMap = project.memberActivity || {};

    const resolveCollabMeta = (cid: string, rawObj?: any) => {
      const actRecord = memberActivityMap[String(cid)] || {};
      const lastActIso =
        actRecord.lastActivityAt ||
        rawObj?.lastActivityAt ||
        actRecord.joinedAt ||
        rawObj?.joinedAt ||
        (project.createdAt ? new Date(project.createdAt).toISOString() : undefined);
      let inactiveDays = 0;
      let isInactive = false;
      if (lastActIso) {
        const lastMs = new Date(lastActIso).getTime();
        if (!isNaN(lastMs) && lastMs > 0) {
          const elapsed = Math.max(0, nowMs - lastMs);
          inactiveDays = Math.floor(elapsed / DAY_MS);
          isInactive = elapsed >= SEVEN_DAYS_MS;
        }
      }
      return {
        lastActivityAt: lastActIso,
        inactivityNotifiedAt: actRecord.inactivityNotifiedAt || rawObj?.inactivityNotifiedAt,
        inactiveDays,
        isInactive,
      };
    };

    const enrichedCollabs = collabs.map((c: any) => {
      if (typeof c === 'string') {
        const u = this.usersService?.findUserSafe?.(c);
        const del = Boolean(u?.isDeleted || u?.deletedAt);
        const displayName = del ? 'Deleted user' : (u?.name || c);
        const meta = resolveCollabMeta(c);
        const cAvatar = del ? null : (u?.avatarUrl || u?.avatar || null);
        return {
          id: c,
          name: displayName,
          role: 'Collaborator' as any,
          initials: del ? 'DU' : this.getInitials(displayName),
          avatarUrl: cAvatar,
          updatedAt: del ? null : (u?.updatedAt || null),
          ...(del ? { isDeleted: true } : {}),
          ...meta,
        };
      }
      const cid = String(c.id || c.userId || 'collab');
      const u = this.usersService?.findUserSafe?.(cid);
      const del = Boolean(c.isDeleted || u?.isDeleted || u?.deletedAt);
      const displayName = del ? 'Deleted user' : (c.name || u?.name || 'Collaborator');
      const meta = resolveCollabMeta(cid, c);
      const cAvatar = del ? null : (u?.avatarUrl || u?.avatar || c.avatarUrl || c.avatar || null);
      return {
        id: cid,
        userId: cid,
        name: displayName,
        role: c.role || ('Collaborator' as any),
        initials: del ? 'DU' : this.getInitials(displayName),
        avatarUrl: cAvatar,
        updatedAt: del ? null : (u?.updatedAt || null),
        joinedAt: c.joinedAt || meta.lastActivityAt,
        ...(del ? { isDeleted: true } : {}),
        ...meta,
      };
    });

    if (typeof this.joinRequestsService?.findByProject === 'function') {
      try {
        const reqs = this.joinRequestsService.findByProject(project.id);
        (project as any).pendingRequestsCount = reqs.filter(
          (r: any) => String(r.status || '').toLowerCase() === 'pending',
        ).length;
      } catch {}
    }

    project.members = this.buildProjectMembersList(project);
    (project as any).memberCount = project.members.length;
    (project as any).approvedCollaboratorCount = project.members.filter((m: any) => m.role === 'Collaborator').length;
    (project as any).collaboratorCount = (project as any).approvedCollaboratorCount;

    if (project.finalLink && !project.finalProjectUrl) {
      project.finalProjectUrl = project.finalLink;
    }
    if (project.finalProjectUrl && !project.finalLink) {
      project.finalLink = project.finalProjectUrl;
    }

    (project as any).feedbackHistory = this.feedbackService?.findByProject(project.id) || [];

    return project;
  }

  getProjectMembers(projectId: string): ProjectMemberRow[] {
    const project = this.findById(projectId);
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found.`);
    }
    return this.buildProjectMembersList(project);
  }

  buildProjectMembersList(project: any): ProjectMemberRow[] {
    if (!project) return [];

    const userNamesMap: Record<string, string> = {
      '1': 'Priya Patel',
      '2': 'Arjun Sharma',
      '3': 'Kiran Bose',
      '4': 'Rohan Mehta',
      '5': 'Sneha Iyer',
      '6': 'Aditya Sai',
      '7': 'Neha Gupta',
      '8': 'Vikram Nair',
    };

    // 1. Owner row
    const rawOwnerId = String(
      project.ownerId !== undefined && project.ownerId !== null
        ? project.ownerId
        : (typeof project.owner === 'object' && project.owner !== null ? (project.owner.id || project.owner.userId || '') : '') || '1',
    ).trim();
    const ownerRecord = rawOwnerId ? this.usersService?.findUserSafe?.(rawOwnerId) : null;
    const isOwnerDeleted = Boolean(ownerRecord?.isDeleted || ownerRecord?.deletedAt);
    let ownerDisplayName = isOwnerDeleted
      ? 'Deleted user'
      : (ownerRecord?.name || (typeof project.owner === 'object' && project.owner !== null ? ((project.owner as any).name || '') : (project.owner || '')));
    if (!isOwnerDeleted && (!ownerDisplayName || ownerDisplayName === 'Owner' || /^\d+$/.test(String(ownerDisplayName)))) {
      ownerDisplayName = ownerRecord?.name || userNamesMap[rawOwnerId] || userNamesMap[String(ownerDisplayName)] || 'Project Owner';
    }

    const ownerRow: ProjectMemberRow = {
      id: rawOwnerId,
      userId: rawOwnerId,
      name: ownerDisplayName,
      username: ownerRecord?.username || '',
      role: 'Owner',
      initials: isOwnerDeleted ? 'DU' : this.getInitials(ownerDisplayName),
      avatarUrl: isOwnerDeleted ? null : (ownerRecord?.avatarUrl || ownerRecord?.avatar || null),
      updatedAt: isOwnerDeleted ? null : (ownerRecord?.updatedAt || null),
      joinedAt: project.createdAt || (project as any).created_at,
      lastActiveAt: ownerRecord?.lastActiveAt || ownerRecord?.lastLoginAt || project.createdAt,
      lastActivityAt: ownerRecord?.lastActiveAt || ownerRecord?.lastLoginAt || project.createdAt,
      ...(isOwnerDeleted ? { isDeleted: true } : {}),
    };

    // 2. Mentor row (if assigned or active booking)
    let mentorRow: ProjectMemberRow | null = null;
    let mentorId = String(
      project.mentorId !== undefined && project.mentorId !== null
        ? project.mentorId
        : (typeof project.mentor === 'object' && project.mentor !== null ? (project.mentor.id || project.mentor.userId || '') : ''),
    ).trim();

    if (!mentorId && this.mentorMarketplaceService) {
      try {
        const sessions = this.mentorMarketplaceService.getSessionsByProject(project.id);
        const activeSession = sessions?.find((s: any) => {
          const st = String(s.status || '').toLowerCase();
          return st === 'active' || st === 'completed' || st === 'in_progress' || st === 'accepted';
        });
        if (activeSession) {
          mentorId = String(activeSession.mentorId || '');
        }
      } catch (err: any) {
        console.warn('[projects.service] Suppressed non-critical error:', err?.message || err);
      }
    }

    if (mentorId) {
      const mentorRecord = this.usersService?.findUserSafe?.(mentorId);
      const isMentorDeleted = Boolean(mentorRecord?.isDeleted || mentorRecord?.deletedAt);
      let mentorDisplayName = isMentorDeleted
        ? 'Deleted user'
        : (typeof project.mentor === 'object' && project.mentor !== null && project.mentor.name
            ? project.mentor.name
            : (typeof project.mentor === 'string' && project.mentor !== 'None assigned yet' ? project.mentor : ''));
      if (!isMentorDeleted && (!mentorDisplayName || mentorDisplayName === 'Mentor')) {
        mentorDisplayName = mentorRecord?.name || 'Mentor';
      }
      mentorDisplayName = mentorDisplayName || 'Mentor';

      mentorRow = {
        id: mentorId,
        userId: mentorId,
        name: mentorDisplayName,
        username: mentorRecord?.username || '',
        role: 'Mentor',
        initials: isMentorDeleted ? 'DU' : this.getInitials(mentorDisplayName),
        avatarUrl: isMentorDeleted ? null : (mentorRecord?.avatarUrl || mentorRecord?.avatar || null),
        updatedAt: isMentorDeleted ? null : (mentorRecord?.updatedAt || null),
        joinedAt: project.createdAt,
        lastActiveAt: mentorRecord?.lastActiveAt || mentorRecord?.lastLoginAt,
        lastActivityAt: mentorRecord?.lastActiveAt || mentorRecord?.lastLoginAt,
        ...(isMentorDeleted ? { isDeleted: true } : {}),
      };
    }

    // 3. Collaborators
    const rawCollabs = Array.isArray(project.collaborators)
      ? project.collaborators
      : (Array.isArray(project.members)
        ? project.members.filter((m: any) => String(m.role || '').toLowerCase() === 'collaborator')
        : []);

    const nowTs = this.clockService ? this.clockService.now().getTime() : Date.now();
    const resolveCollabMeta = (collabUserId: string, fallback: any = {}) => {
      try {
        const tasks = this.tasksService?.findAllByProjectId?.(project.id) || [];
        const memberTasks = tasks.filter(
          (t: any) => String(t.assignedTo || t.assigneeId || '') === String(collabUserId),
        );
        let latestActivityMs = 0;
        for (const t of memberTasks) {
          const times = [
            t.submittedAt ? new Date(t.submittedAt).getTime() : 0,
            t.approvedAt ? new Date(t.approvedAt).getTime() : 0,
            t.updatedAt ? new Date(t.updatedAt).getTime() : 0,
            t.createdAt ? new Date(t.createdAt).getTime() : 0,
          ].filter((ms) => !Number.isNaN(ms) && ms > 0);
          const maxT = times.length > 0 ? Math.max(...times) : 0;
          if (maxT > latestActivityMs) latestActivityMs = maxT;
        }
        if (latestActivityMs === 0 && fallback?.joinedAt) {
          const jMs = new Date(fallback.joinedAt).getTime();
          if (!Number.isNaN(jMs)) latestActivityMs = jMs;
        }
        if (latestActivityMs === 0) {
          const u = this.usersService?.findUserSafe?.(collabUserId);
          if (u?.lastActiveAt) {
            const uMs = new Date(u.lastActiveAt).getTime();
            if (!Number.isNaN(uMs)) latestActivityMs = uMs;
          }
        }
        if (latestActivityMs === 0) {
          const pCreated = project?.createdAt ? new Date(project.createdAt).getTime() : nowTs;
          latestActivityMs = Number.isNaN(pCreated) ? nowTs : pCreated;
        }
        const inactiveDays = Math.floor(Math.max(0, nowTs - latestActivityMs) / (24 * 60 * 60 * 1000));
        const isInactive = inactiveDays >= 7;
        const lastIso = new Date(latestActivityMs).toISOString();
        return {
          lastActivityAt: lastIso,
          lastActiveAt: lastIso,
          inactiveDays,
          isInactive,
        };
      } catch {
        return {
          lastActivityAt: new Date(nowTs).toISOString(),
          lastActiveAt: new Date(nowTs).toISOString(),
          inactiveDays: 0,
          isInactive: false,
        };
      }
    };

    const removedUsers = Array.isArray(project.removedUsers) ? project.removedUsers : [];
    const collabRows: ProjectMemberRow[] = [];

    for (const c of rawCollabs) {
      if (!c) continue;
      if (typeof c === 'object') {
        const cRole = String(c.role || '').trim().toLowerCase();
        if (cRole === 'owner' || cRole === 'mentor') continue;
      }
      const cId = String(typeof c === 'string' ? c : (c.id || c.userId || '')).trim();
      if (!cId) continue;

      const isRemoved = removedUsers.some((r: any) => {
        const rId = String(typeof r === 'object' ? (r.userId || r.id || '') : r).trim();
        return rId && rId === cId;
      });
      if (isRemoved) continue;

      const uRecord = this.usersService?.findUserSafe?.(cId);
      const isDel = Boolean((typeof c === 'object' && c.isDeleted) || uRecord?.isDeleted || uRecord?.deletedAt);
      let cName = typeof c === 'string' ? c : (c.name || uRecord?.name || 'Collaborator');
      if (isDel) cName = 'Deleted user';
      if (!isDel && (!cName || /^\d+$/.test(String(cName)))) {
        cName = userNamesMap[cId] || uRecord?.name || 'Collaborator';
      }

      const meta = resolveCollabMeta(cId, c);
      collabRows.push({
        id: cId,
        userId: cId,
        name: cName,
        username: uRecord?.username || (typeof c === 'object' ? c.username : '') || '',
        role: 'Collaborator',
        initials: isDel ? 'DU' : this.getInitials(cName),
        avatarUrl: isDel ? null : (uRecord?.avatarUrl || uRecord?.avatar || (typeof c === 'object' ? (c.avatarUrl || c.avatar) : null) || null),
        updatedAt: isDel ? null : (uRecord?.updatedAt || null),
        joinedAt: (typeof c === 'object' && c.joinedAt) || meta.lastActivityAt,
        ...(isDel ? { isDeleted: true } : {}),
        ...meta,
      });
    }

    // 4. Combine all candidate rows and deduplicate with role priority:
    // Priority: Owner (3) > Mentor (2) > Collaborator (1)
    const candidates: ProjectMemberRow[] = [
      ownerRow,
      ...(mentorRow ? [mentorRow] : []),
      ...collabRows,
    ];

    const roleRank: Record<string, number> = {
      Owner: 3,
      Mentor: 2,
      Collaborator: 1,
    };

    const userRowsMap = new Map<string, ProjectMemberRow>();
    const userRolesSeen = new Map<string, Set<string>>();

    for (const row of candidates) {
      const uid = row.userId;
      if (!userRolesSeen.has(uid)) {
        userRolesSeen.set(uid, new Set());
      }
      userRolesSeen.get(uid)!.add(row.role);

      if (!userRowsMap.has(uid)) {
        userRowsMap.set(uid, row);
      } else {
        const existing = userRowsMap.get(uid)!;
        const existingRank = roleRank[existing.role] || 0;
        const currentRank = roleRank[row.role] || 0;
        if (currentRank > existingRank) {
          userRowsMap.set(uid, row);
        }
      }
    }

    // Log warning for any user holding multiple roles
    for (const [uid, roles] of userRolesSeen.entries()) {
      if (roles.size > 1) {
        const retained = userRowsMap.get(uid)!.role;
        console.warn(
          `[projects.service] Warning: Project ${project.id} has user ${uid} in multiple roles (${Array.from(roles).join(', ')}). Retaining priority role: ${retained}`,
        );
      }
    }

    return Array.from(userRowsMap.values());
  }

  findAll(
    statusFilter?: string,
    isCompletedFilter?: string,
    limit?: number,
    offset?: number,
    callerId?: string,
    includeDeleted = false,
  ): Project[] {
    const normalizedFilter = statusFilter ? statusFilter.toLowerCase().trim() : undefined;
    if (normalizedFilter === 'deleted') {
      if (!includeDeleted) {
        return [];
      }
      const deletedList = this.projectsRepository
        .findAll(true)
        .filter((p) => !isVisibleProject(p))
        .map((p) => this.enrichProject(p));
      if (limit !== undefined && limit > 0) {
        const start = offset || 0;
        return deletedList.slice(start, start + limit);
      }
      return deletedList;
    }

    const rawList =
      includeDeleted && normalizedFilter === 'all'
        ? this.projectsRepository.findAll(true)
        : this.projectsRepository.findAll(false);
    let all = rawList.map((p) => this.enrichProject(p));
    const isCompletedRequested =
      (isCompletedFilter !== undefined && (isCompletedFilter === 'true' || isCompletedFilter === '1')) ||
      normalizedFilter === 'completed';

    const attachStatus = (list: Project[]) => {
      return list.map((p) => {
        const item = { ...p };
        delete item.deadlineHistory;
        if (!callerId) return item;
        try {
          const myRequestStatus = this.joinRequestsService.getMyRequestStatus(callerId, p.id);
          return { ...item, myRequestStatus };
        } catch {
          return item;
        }
      });
    };

    if (isCompletedRequested) {
      const filtered = all
        .filter((p) => isVisibleProject(p) && (this.isLocked(p) || p.isCompleted === true) && String(p.status).toLowerCase() !== 'closed')
        .sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime());
      if (limit !== undefined && limit > 0) {
        const start = offset || 0;
        return attachStatus(filtered.slice(start, start + limit));
      }
      return attachStatus(filtered);
    }

    if (normalizedFilter && normalizedFilter !== 'all') {
      all = all.filter((p) => isVisibleProject(p) && String(p.status).toLowerCase() === normalizedFilter);
    } else if (!normalizedFilter) {
      // Default listing (marketplace): exclude deleted, closed, and completed projects
      all = all.filter((p) => {
        if (!isVisibleProject(p)) return false;
        const s = String(p.status || '').toLowerCase().trim();
        return s !== 'completed' && s !== 'closed' && !p.isCompleted;
      });
    }

    if (limit !== undefined && limit > 0) {
      const start = offset || 0;
      return attachStatus(all.slice(start, start + limit));
    }

    return attachStatus(all);
  }

  findById(id: string, callerId?: string, options?: { includeDeleted?: boolean; role?: string }): Project {
    const project = this.projectsRepository.findById(id);
    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found.`);
    }

    if (project.deletedAt) {
      if (options?.includeDeleted) {
        return this.enrichProject(project);
      }

      // Check if caller is an involved person (former member, applicant, invitee, mentor, owner)
      let isFormerInvolved = false;
      if (callerId) {
        const cid = String(callerId);
        const isOwner = String(project.ownerId) === cid || project.owner === cid;
        const isMentor = String(project.mentorId) === cid;
        const isCollab = Array.isArray(project.collaborators) && project.collaborators.some((c: any) => {
          const uid = typeof c === 'object' && c !== null ? String(c.id || c.userId || '') : String(c);
          return uid === cid;
        });
        const isMember = Array.isArray(project.members) && project.members.some((m: any) => {
          const uid = typeof m === 'object' && m !== null ? String(m.id || m.userId || m.name || '') : String(m);
          return uid === cid;
        });
        let hasJoinRequest = false;
        if (this.joinRequestsService && typeof this.joinRequestsService.findByProject === 'function') {
          try {
            hasJoinRequest = this.joinRequestsService.findByProject(project.id).some((r: any) => String(r.userId) === cid);
          } catch {}
        }
        let hasInvite = false;
        if (this.projectInvitesService && typeof this.projectInvitesService.findByProject === 'function') {
          try {
            hasInvite = this.projectInvitesService.findByProject(project.id).some((i: any) => String(i.inviteeId) === cid);
          } catch {}
        }
        isFormerInvolved = Boolean(isOwner || isMentor || isCollab || isMember || hasJoinRequest || hasInvite);
      }

      if (isFormerInvolved) {
        let reasons: string[] = [];
        let explanation = '';
        if (this.feedbackService && typeof this.feedbackService.findByEntity === 'function') {
          try {
            const records = this.feedbackService.findByEntity('PROJECT', project.id);
            const delRec = records.slice().reverse().find((r: any) => r.actionType === 'DELETE_PROJECT');
            if (delRec) {
              reasons = delRec.reasons || [];
              explanation = delRec.explanation || '';
            }
          } catch {}
        }

        throw new HttpException(
          {
            statusCode: HttpStatus.GONE,
            error: 'Gone',
            code: 'PROJECT_DELETED',
            message: 'This project has been deleted.',
            project: {
              id: project.id,
              title: project.title || project.name || 'Untitled Project',
              deletedAt: project.deletedAt,
              reasons,
              explanation,
            },
          },
          HttpStatus.GONE,
        );
      }

      throw new NotFoundException(`Project with ID ${id} not found.`);
    }

    if (!isVisibleProject(project, options)) {
      throw new NotFoundException(`Project with ID ${id} not found.`);
    }
    const enriched = { ...this.enrichProject(project) };
    if (callerId) {
      try {
        (enriched as any).myRequestStatus = this.joinRequestsService.getMyRequestStatus(callerId, project.id);
      } catch {}
    }

    // Phase 9 Part C: Members, assigned mentor, owner, and admins can read history via project detail endpoint; outsiders/strangers cannot.
    const isOwner = callerId && (String(project.ownerId) === String(callerId) || project.owner === callerId);
    const isMentor = callerId && String(project.mentorId) === String(callerId);
    const isCollab = callerId && Array.isArray(project.collaborators) && project.collaborators.some((c: any) => {
      const uid = typeof c === 'object' && c !== null ? String(c.id || c.userId || '') : String(c);
      return uid && uid === String(callerId);
    });
    const isMember = callerId && Array.isArray(project.members) && project.members.some((m: any) => {
      const uid = typeof m === 'object' && m !== null ? String(m.id || m.userId || m.name || '') : String(m);
      return uid && uid === String(callerId);
    });
    const roleNorm = (options as any)?.role ? String((options as any).role).toLowerCase() : '';
    let isAdmin = ['admin', 'administrator', 'superuser'].includes(roleNorm);
    if (!isAdmin && callerId && this.usersService) {
      try {
        const u = this.usersService.findUserSafe(callerId);
        if (u && ['admin', 'administrator', 'superuser'].includes(String(u.role || '').toLowerCase())) {
          isAdmin = true;
        }
      } catch {}
    }

    const canViewHistory = Boolean(isOwner || isMentor || isCollab || isMember || isAdmin);
    if (canViewHistory && project.deadlineHistory) {
      enriched.deadlineHistory = [...project.deadlineHistory];
    } else {
      delete (enriched as any).deadlineHistory;
    }

    return enriched;
  }

  getMyRequestStatus(projectId: string, userId: string) {
    const project = this.findById(projectId);
    return this.joinRequestsService.getMyRequestStatus(userId, project.id);
  }

  findRawById(id: string): Project | undefined {
    return this.projectsRepository.findById(id);
  }

  findByOwnerId(ownerId: string, includeDeleted = false): Project[] {
    return this.projectsRepository
      .findByOwnerId(ownerId, includeDeleted)
      .filter((p) => isVisibleProject(p, { includeDeleted }))
      .map((p) => this.enrichProject(p));
  }

  /**
   * FIX 5 (Item 8): Retrieve collaborator work split into ongoing and completed projects with exact counts.
   * Includes projects where user is an active collaborator OR has at least 1 approved task.
   * Soft-deleted and draft projects are excluded.
   */
  findCollaboratorWork(userId: string): {
    ongoing: Project[];
    completed: Project[];
    ongoingCount: number;
    completedCount: number;
  } {
    const uid = String(userId).trim();
    const allProjects = this.projectsRepository.findAll(false);
    const ongoing: Project[] = [];
    const completed: Project[] = [];

    for (const project of allProjects) {
      // 1. Soft-deleted projects are excluded
      if (!isVisibleProject(project)) {
        continue;
      }

      // 2. Project Owner's own projects belong in My Projects, not My Work
      if (String(project.ownerId) === uid) {
        continue;
      }

      // 3. Check if user is an active collaborator
      const collabs = Array.isArray(project.collaborators) ? project.collaborators : [];
      const isCollab = collabs.some((c: any) => {
        const cid = typeof c === 'string' ? c : (c.id || c.userId);
        return String(cid) === uid;
      });

      // 4. Check if user has at least one approved task in the project
      let hasApprovedTask = false;
      if (this.tasksService) {
        try {
          const tasks = this.tasksService.findAllByProjectId(project.id) || [];
          hasApprovedTask = tasks.some((t: any) => {
            const assigneeId = t.assigneeId || (typeof t.assignee === 'object' ? t.assignee?.id : undefined);
            const isAssignee = String(assigneeId) === uid || (t.assignee && String(t.assignee) === uid);
            const isApproved =
              t.status === TaskStatus.Completed ||
              String(t.status || '').toLowerCase() === 'completed';
            return isAssignee && isApproved;
          });
        } catch {}
      }

      // User with no relation to the project does not see it
      if (!isCollab && !hasApprovedTask) {
        continue;
      }

      const statusLower = String(project.status || '').toLowerCase().trim();
      const enriched = { ...this.enrichProject(project) };

      // Completed tab: projects whose status is Completed (or isCompleted === true),
      // and Closed ones shown with a "Closed" badge and the closedReason.
      if (statusLower === 'completed' || project.isCompleted === true) {
        completed.push(enriched);
      } else if (statusLower === 'closed') {
        completed.push({
          ...enriched,
          closureReason: enriched.closureReason || (enriched as any).closedReason || 'Project closed',
        });
      } else {
        // Ongoing: status not Completed, Closed, or deleted
        ongoing.push(enriched);
      }
    }

    // Sort completed by completedAt/closedAt descending
    completed.sort((a, b) => {
      const timeA = new Date(a.completedAt || a.closedAt || 0).getTime();
      const timeB = new Date(b.completedAt || b.closedAt || 0).getTime();
      return timeB - timeA;
    });

    // Sort ongoing by updatedAt/createdAt descending
    ongoing.sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    return {
      ongoing,
      completed,
      ongoingCount: ongoing.length,
      completedCount: completed.length,
    };
  }

  private validateProjectContentAndCaps(
    ownerId: string,
    payload: Partial<CreateProjectDto>,
    isUpdate = false,
  ): void {
    if (!isUpdate || payload.title !== undefined) {
      const trimmedTitle = String(payload.title || '').trim();
      if (trimmedTitle.length < 5) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          code: 'TITLE_TOO_SHORT',
          field: 'title',
          message: 'Project title must be at least 5 characters long.',
        });
      }
    }

    if (!isUpdate || payload.description !== undefined) {
      const trimmedDesc = String(payload.description || '').trim();
      if (trimmedDesc.length < 100) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          code: 'DESCRIPTION_TOO_SHORT',
          field: 'description',
          message: 'Project description must be at least 100 characters long.',
        });
      }
    }

    this.contentFilterService?.assertClean(
      payload as any,
      ['title', 'description', 'objectives', 'requiredSkills', 'skills'],
      { actorId: String(ownerId), entityType: 'project' },
    );

    if (isUpdate) return;

    const config = this.platformConfigService.getConfig();
    // Phase 24: Include soft-deleted projects when counting 24h project creation cap so create+delete cannot bypass limits
    const allOwnedProjects = this.projectsRepository.findByOwnerId(ownerId, true);
    const nowMs = this.clockService ? this.clockService.now().getTime() : Date.now();
    const dayWindowStartMs = nowMs - 24 * 60 * 60 * 1000;

    const maxProjectsPerDay = config.maxProjectsPerDay || 3;
    const createdInLast24h = allOwnedProjects.filter((p) => {
      if (!p.createdAt) return false;
      const ts = new Date(p.createdAt).getTime();
      return !Number.isNaN(ts) && ts > dayWindowStartMs && ts <= nowMs;
    });
    if (createdInLast24h.length >= maxProjectsPerDay) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          code: 'PROJECT_DAILY_LIMIT',
          message: `You can create at most ${maxProjectsPerDay} projects within a 24-hour window.`,
          currentCount: createdInLast24h.length,
          maxAllowed: maxProjectsPerDay,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const maxOpenProjects = config.maxProjectsPerUser || 10;
    const openProjects = allOwnedProjects.filter((p) => {
      if ((p as any).deletedAt) return false;
      const st = String(p.status || '').toLowerCase().trim();
      return !p.isCompleted && st !== 'completed' && st !== 'closed' && st !== 'cancelled' && st !== 'archived';
    });
    if (openProjects.length >= maxOpenProjects) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'OPEN_PROJECT_LIMIT',
        message: `You can have at most ${maxOpenProjects} open projects at once.`,
        currentCount: openProjects.length,
        maxAllowed: maxOpenProjects,
      });
    }
  }

  create(ownerId: string, createProjectDto: CreateProjectDto): Project {
    if (createProjectDto?.status && String(createProjectDto.status).toLowerCase() === 'draft') {
      throw new BadRequestException('Draft status is no longer supported.');
    }
    this.validateProjectContentAndCaps(ownerId, createProjectDto, false);
    const config = this.platformConfigService.getConfig();

    const platformCap = (config as any).maxCollaboratorCapacity || config.maxCollaboratorsPerProject || 20;
    const rawRequestedCap =
      createProjectDto.maxCollaborators !== undefined
        ? Number(createProjectDto.maxCollaborators)
        : createProjectDto.teamSize !== undefined
          ? Number(createProjectDto.teamSize)
          : undefined;
    const effectiveCap =
      rawRequestedCap !== undefined && !Number.isNaN(rawRequestedCap) && rawRequestedCap > 0
        ? Math.min(Math.max(rawRequestedCap, 1), platformCap)
        : Math.min(5, platformCap);
    createProjectDto.maxCollaborators = effectiveCap;
    (createProjectDto as any).teamSize = effectiveCap;

    // Phase 3 Rule: Due date is required, must not be in past, must be at least tomorrow
    if (!createProjectDto.dueDate) {
      throw new BadRequestException('Project due date is required.');
    }
    const dueTime = new Date(createProjectDto.dueDate).getTime();
    if (isNaN(dueTime)) {
      throw new BadRequestException('Invalid project due date format.');
    }
    const now = this.clockService ? this.clockService.now() : new Date();
    const tomorrowMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0)).getTime();
    if (dueTime < tomorrowMidnight) {
      throw new BadRequestException('Project due date cannot be in the past or today; it must be at least tomorrow.');
    }

    // Business Rule: A newly created project MUST always default to the 'Open' status
    console.log("Creating new project for user " + ownerId);
    const nowIso = this.clockService ? this.clockService.nowIso() : new Date().toISOString();
    const projData = {
      ...createProjectDto,
      category: normalizeProjectCategory(createProjectDto.category),
      createdAt: (createProjectDto as any).createdAt || nowIso,
      lastOwnerActionAt: (createProjectDto as any).lastOwnerActionAt || nowIso,
    };
    const proj = this.projectsRepository.create(ownerId, projData as any, ProjectStatus.Open);
    try {
      this.auditService.log({
        action: 'project-created',
        actor: proj.owner || `User #${ownerId}`,
        target: proj.title || proj.name || 'Project',
        entityType: 'project',
        entityId: proj.id,
        event: `${proj.owner || `User #${ownerId}`} created project "${proj.title || proj.name}"`,
        details: { difficulty: proj.difficulty, dueDate: proj.dueDate },
      });
    } catch (err: any) {
        console.warn('[projects.service] Suppressed non-critical error:', err?.message || err);
      }
    return this.enrichProject(proj);
  }

  async createWithStarterTasks(
    ownerId: string,
    createProjectDto: CreateProjectDto,
    caller?: any,
    callerRole?: string,
  ): Promise<Project & { starterTasksCreated?: any[]; starterTasksSkipped?: any[]; starterTasksResult?: { created: any[]; skipped: any[] } }> {
    const starterKeys = Array.isArray(createProjectDto?.starterTaskKeys)
      ? createProjectDto.starterTaskKeys
      : [];
    const starterOverrides = createProjectDto?.starterTaskOverrides;

    const proj = this.create(ownerId, createProjectDto);
    if (starterKeys.length === 0 || !this.templatesService) {
      return proj;
    }

    let result: { created: any[]; skipped: any[] } = { created: [], skipped: [] };
    try {
      const effectiveCaller = caller || { uid: ownerId, id: ownerId, role: callerRole };
      result = await this.templatesService.applyTemplatesForProject(
        proj.id,
        effectiveCaller,
        callerRole,
        {
          keys: starterKeys,
          ...(starterOverrides ? { overrides: starterOverrides } : {}),
        },
      );
    } catch (err: any) {
      result = {
        created: [],
        skipped: starterKeys.map((key) => ({
          key: String(key || ''),
          code: 'STARTER_TASKS_APPLY_FAILED',
          reason: err?.message || 'Unable to apply starter tasks during project creation.',
        })),
      };
    }

    const refreshed = this.findById(proj.id, ownerId);
    return {
      ...refreshed,
      starterTasksCreated: result.created,
      starterTasksSkipped: result.skipped,
      starterTasksResult: result,
    };
  }

  completeProject(id: string, callerId?: string, finalLink?: string): Project {
    const project = this.projectsRepository.findById(id);
    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found.`);
    }

    // Rule: Deleted or closed projects cannot be completed
    if ((project as any).deletedAt || (project as any).isDeleted) {
      throw new NotFoundException('Project not found.');
    }
    if (String(project.status || '').toLowerCase() === 'closed') {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'PROJECT_CLOSED',
        message: 'A closed project cannot be completed.',
      });
    }

    // Rule: Refuse completion a second time (done means done: 409 PROJECT_ALREADY_COMPLETED)
    if (project.isCompleted === true || String(project.status || '').toLowerCase() === 'completed' || this.isLocked(project)) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'PROJECT_ALREADY_COMPLETED',
        message: 'Project is already completed and locked. Final link cannot be published a second time.',
      });
    }

    // Guard 1: Caller is the owner (compared by user ID only, or admin/superuser)
    const userForCheck = typeof callerId === 'object' && callerId !== null
      ? callerId
      : { uid: callerId, id: callerId };
    const isOwner = isProjectOwner(project, userForCheck) || isPlatformAdminOrSuperUser(userForCheck);
    if (!isOwner) {
      throw new ForbiddenException('Only the project owner can complete the project.');
    }

    // Guard 2: The link is a valid URL
    const trimmedLink = (finalLink || '').trim();
    if (!trimmedLink) {
      assertSafeHttpUrl(trimmedLink, 'finalLink', callerId, this.auditService);
    }
    assertSafeHttpUrl(trimmedLink, 'finalLink', callerId, this.auditService);

    // Guard 3: At least 1 task, and every task is approved
    const tasks = this.tasksService.findAllByProjectId(id) || [];
    if (!tasks || tasks.length === 0) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'NO_TASKS',
        message: 'A project must have at least one approved task to be completed.',
      });
    }

    const allTasksApproved = tasks.every(
      (t: any) =>
        t.status === TaskStatus.Completed ||
        (typeof t.status === 'string' && t.status.toLowerCase() === 'completed'),
    );
    if (!allTasksApproved) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'TASKS_NOT_COMPLETED',
        message: 'All project tasks must be approved before completing the project.',
      });
    }

    // Award badge / XP / reputation only if all Phase 22 anti-farming checks pass
    const approvedTasksCount = tasks.length;
    const nowMs = this.clockService ? this.clockService.now().getTime() : Date.now();
    const config = this.platformConfigService?.getConfig?.() as any;
    const duplicateGroups =
      this.duplicateDetectionService?.computeDuplicateGroups?.()?.groups || [];
    let badgeAwarded = false;
    let badgeReason: string | undefined;

    if (this.gamificationService) {
      const awardResult = this.gamificationService.awardProjectCompletion(
        project.ownerId || callerId,
        project.id,
        approvedTasksCount,
        {
          project,
          tasks,
          nowMs,
          minProjectAgeDays: config?.completionBadgeMinProjectAgeDays,
          minReviewGapMinutes: config?.taskMinReviewGapMinutes,
          duplicateGroups,
          auditService: this.auditService,
        },
      );
      badgeAwarded = awardResult.badgeAwarded;
      badgeReason = awardResult.reason;
    } else {
      badgeAwarded = approvedTasksCount >= COMPLETION_BADGE_MIN_TASKS;
      if (!badgeAwarded) {
        badgeReason = `Completed. Badges need at least ${COMPLETION_BADGE_MIN_TASKS} approved tasks`;
      }
    }

    // Resolve completedMemberIds
    const completedMemberIds: string[] = [];
    if (Array.isArray(project.collaborators)) {
      for (const c of project.collaborators) {
        const cid = typeof c === 'string' ? c : (c?.id || c?.userId);
        if (cid && !completedMemberIds.includes(String(cid))) {
          completedMemberIds.push(String(cid));
        }
      }
    }
    const appReqs = this.joinRequestsService?.findByProject?.(id) || [];
    for (const req of appReqs) {
      const st = String(req?.status || '').toLowerCase();
      if (req?.userId && (st === 'approved' || st === 'completed')) {
        if (!completedMemberIds.includes(String(req.userId))) {
          completedMemberIds.push(String(req.userId));
        }
      }
    }

    const completedMentorUserId = this.resolveCompletedMentorUserId(project);
    if (completedMentorUserId && !completedMemberIds.includes(completedMentorUserId)) {
      completedMemberIds.push(completedMentorUserId);
    }

    // 1. Set the completed fields
    const completedAt = this.clockService ? this.clockService.nowIso() : new Date().toISOString();
    const updatedProject = this.projectsRepository.update(id, {
      status: ProjectStatus.Completed,
      progress: 100,
      isCompleted: true,
      completedAt,
      finalLink: trimmedLink,
      finishedLink: trimmedLink,
      finalProjectUrl: trimmedLink,
      projectLink: trimmedLink,
      completedMemberIds,
      ...(completedMentorUserId ? { completedMentorUserId, mentorUserId: completedMentorUserId } : {}),
      badgeAwarded,
      ...(badgeReason ? { badgeReason } : {}),
    } as any);

    if (!updatedProject) {
      throw new NotFoundException(`Project with ID ${id} not found.`);
    }

    (updatedProject as any).badgeAwarded = badgeAwarded;
    if (badgeReason) {
      (updatedProject as any).badgeReason = badgeReason;
    }

    // 2. Change Approved applications to Completed
    try {
      this.joinRequestsService.completeApprovedRequests(id);
    } catch (err) {
      console.error('Failed to update approved join requests to Completed:', err);
    }

    // 3. Send PROJECT_COMPLETED to owner, members, and mentors without duplicates
    try {
      const recipientIds = new Set<string>();
      if (project.ownerId) {
        recipientIds.add(project.ownerId);
      }
      if (Array.isArray(project.collaborators)) {
        for (const c of project.collaborators) {
          if (typeof c === 'string') recipientIds.add(c);
          else if (c?.id) recipientIds.add(c.id);
          else if (c?.userId) recipientIds.add(c.userId);
        }
      }
      const appReqs = this.joinRequestsService.findByProject(id);
      for (const req of appReqs) {
        if (
          req.userId &&
          ((req.status || '').toLowerCase() === 'approved' || (req.status || '').toLowerCase() === 'completed')
        ) {
          recipientIds.add(req.userId);
        }
      }
      const sessions = this.mentorMarketplaceService.getSessionsByProject(id);
      for (const s of sessions) {
        if (s.mentorId) {
          const profile = this.mentorMarketplaceService.findProfileById(s.mentorId);
          recipientIds.add(profile?.userId || s.mentorId);
        }
      }
      if ((project as any).mentorId) {
        recipientIds.add((project as any).mentorId);
      }

      for (const userId of recipientIds) {
        this.notificationsService.create({
          userId,
          type: 'PROJECT_COMPLETED',
          title: 'Project Completed',
          message: `🎉 Project "${project.title || project.name}" has been completed! All tasks approved and deliverables published.`,
          readStatus: false,
          referenceId: project.id,
        });
      }
    } catch (err) {
      console.error('Failed to send PROJECT_COMPLETED notifications:', err);
    }

    // 4. Release mentor escrow without blocking the UI (failed release must not break completion)
    try {
      this.mentorMarketplaceService.releaseEscrowForProject(id);
    } catch (err) {
      console.error('Non-blocking mentor escrow release failed:', err);
    }

    try {
      this.auditService.log({
        action: 'project-completed',
        actor: project.owner || callerId || 'Owner',
        target: project.title || project.name || 'Project',
        entityType: 'project',
        entityId: project.id,
        event: `Project "${project.title || project.name}" was marked completed and published`,
        details: { finalLink: trimmedLink, completedAt },
      });
    } catch (err: any) {
        console.warn('[projects.service] Suppressed non-critical error:', err?.message || err);
      }

    return updatedProject;
  }

  update(id: string, updateProjectDto: UpdateProjectDto, callerId?: string): Project {
    const existingProject = this.findById(id);
    if (this.isLocked(existingProject)) {
      throw new BadRequestException('Project is locked and cannot be modified.');
    }

    this.validateProjectContentAndCaps(
      String(callerId || existingProject.ownerId || 'system'),
      updateProjectDto,
      true,
    );

    // Phase 2 Rule: Due date is required, must not be in past, must be at least tomorrow
    if (updateProjectDto.dueDate !== undefined) {
      if (!updateProjectDto.dueDate || String(updateProjectDto.dueDate).trim() === '') {
        throw new BadRequestException('Project due date is required.');
      }
      const dueTime = new Date(updateProjectDto.dueDate).getTime();
      if (isNaN(dueTime)) {
        throw new BadRequestException('Invalid project due date format.');
      }
      const now = this.clockService ? this.clockService.now() : new Date();
      const tomorrowMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0)).getTime();
      if (dueTime < tomorrowMidnight) {
        throw new BadRequestException('Project due date cannot be in the past or today; it must be at least tomorrow.');
      }
    }

    // Capacity Guard: teamSize cannot be set below the number of active members (TEAM_SIZE_BELOW_MEMBERS)
    const incomingTeamSize =
      updateProjectDto.teamSize !== undefined
        ? Number(updateProjectDto.teamSize)
        : (updateProjectDto.maxCollaborators !== undefined ? Number(updateProjectDto.maxCollaborators) : undefined);

    if (incomingTeamSize !== undefined) {
      const approvedCollabs = getApprovedCollaboratorsCount(existingProject);
      const collabsCount = Array.isArray(existingProject.collaborators) ? existingProject.collaborators.length : 0;
      const activeMembersCount = Math.max(approvedCollabs, collabsCount);

      if (incomingTeamSize < activeMembersCount) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          code: 'TEAM_SIZE_BELOW_MEMBERS',
          message: `Team size cannot be set below the number of active members (${activeMembersCount}).`,
          currentMembers: activeMembersCount,
        });
      }
      (updateProjectDto as any).maxCollaborators = incomingTeamSize;
      (updateProjectDto as any).teamSize = incomingTeamSize;
    }

    // Due date extension with task shifting
    if (updateProjectDto.dueDate && updateProjectDto.dueDate !== existingProject.dueDate) {
      const oldDueTime = existingProject.dueDate ? new Date(existingProject.dueDate).getTime() : 0;
      const newDueTime = new Date(updateProjectDto.dueDate).getTime();
      const isExtended = oldDueTime > 0 && newDueTime > oldDueTime;
      const oldD = existingProject.dueDate ? new Date(existingProject.dueDate) : null;
      const newD = new Date(updateProjectDto.dueDate);
      const oldMid = oldD && !isNaN(oldD.getTime()) ? Date.UTC(oldD.getUTCFullYear(), oldD.getUTCMonth(), oldD.getUTCDate()) : 0;
      const newMid = !isNaN(newD.getTime()) ? Date.UTC(newD.getUTCFullYear(), newD.getUTCMonth(), newD.getUTCDate()) : 0;
      const diffDays = isExtended ? Math.max(1, Math.round((newMid - oldMid) / (1000 * 60 * 60 * 24))) : 0;

      if (updateProjectDto.shiftTasks && isExtended && diffDays > 0) {
        const now = this.clockService ? this.clockService.now() : new Date();
        const nowTime = now.getTime();
        const tasks = this.tasksService ? this.tasksService.findAllByProjectId(id) : [];
        let shiftedCount = 0;

        for (const task of tasks) {
          const isApproved =
            task.status === TaskStatus.Completed ||
            (typeof task.status === 'string' &&
              (task.status.toLowerCase() === 'completed' || task.status.toLowerCase() === 'approved'));
          if (isApproved) continue;

          if (task.dueDate) {
            const currentTaskTime = new Date(task.dueDate).getTime();
            if (!isNaN(currentTaskTime)) {
              const shiftedTime = currentTaskTime + diffDays * 24 * 60 * 60 * 1000;
              const finalTime = Math.max(nowTime, shiftedTime);
              const shiftedIso = new Date(finalTime).toISOString();
              task.dueDate = shiftedIso;
              if (this.tasksService) {
                try {
                  this.tasksService.update(task.id, { dueDate: shiftedIso } as any);
                } catch {}
              }
              shiftedCount++;
            }
          }
        }

        if (shiftedCount > 0) {
          try {
            this.auditService.log({
              action: 'project-deadline-tasks-shifted',
              actor: callerId || existingProject.ownerId || 'System',
              target: existingProject.title || existingProject.name,
              entityType: 'project',
              entityId: id,
              event: `Shifted ${shiftedCount} open task deadlines forward by ${diffDays} days following project deadline extension.`,
              details: { shiftedCount, diffDays, newDueDate: updateProjectDto.dueDate },
            });
          } catch (err: any) {
            console.warn('[projects.service] Suppressed non-critical error:', err?.message || err);
          }
        }
      }
    }

    if (typeof updateProjectDto.status === 'string' && updateProjectDto.status.toLowerCase() === 'suspended') {
      throw new BadRequestException('Suspended project status is not supported.');
    }

    if ((updateProjectDto as any).collaborators !== undefined || (updateProjectDto as any).members !== undefined) {
      throw new BadRequestException(
        'Direct modification of project members is not allowed. Collaborators can only be added via join request approval.',
      );
    }

    // Business Rule: A mentor cannot leave or be removed once a project has started.
    const hasExistingMentor = Boolean(
      existingProject.mentorId ||
      existingProject.mentor ||
      (typeof existingProject.mentor === 'object' && ((existingProject.mentor as any)?.id || (existingProject.mentor as any)?.userId))
    );
    if (hasExistingMentor) {
      const incomingMentorId = (updateProjectDto as any).mentorId;
      const incomingMentor = (updateProjectDto as any).mentor;
      if (
        (incomingMentorId !== undefined && incomingMentorId !== existingProject.mentorId) ||
        (incomingMentor !== undefined && incomingMentor !== existingProject.mentor)
      ) {
        throw new ForbiddenException('A mentor cannot leave or be removed once a project has started.');
      }
    }

    const isCompleting =
      updateProjectDto.isCompleted === true ||
      (typeof updateProjectDto.status === 'string' && updateProjectDto.status.toLowerCase() === 'completed');

    if (isCompleting) {
      const finalLink =
        (updateProjectDto as any).finalLink ||
        (updateProjectDto as any).finishedLink ||
        existingProject.finalLink ||
        existingProject.finishedLink;
      const effectiveCaller = callerId || existingProject.ownerId;
      return this.completeProject(id, effectiveCaller, finalLink);
    }

    const normalizedPatch =
      updateProjectDto.category !== undefined
        ? { ...updateProjectDto, category: normalizeProjectCategory(updateProjectDto.category) }
        : updateProjectDto;
    const updatedProject = this.projectsRepository.update(id, normalizedPatch);
    if (!updatedProject) {
      throw new NotFoundException(`Project with ID ${id} not found.`);
    }
    if (callerId && String(existingProject.ownerId) === String(callerId)) {
      this.recordOwnerAction(id, callerId);
    }
    return updatedProject;
  }

  addCollaborator(projectId: string, collaborator: { id: string; name: string; role: string }): Project {
    const project = this.findById(projectId);
    if (this.isLocked(project)) {
      throw new BadRequestException('Project is locked and cannot accept new collaborators.');
    }
    if (this.isFull(project)) {
      throw new ConflictException('This project is full.');
    }
    const nowIso = this.clockService ? this.clockService.nowIso() : new Date().toISOString();
    const updatedProject = this.projectsRepository.addCollaborator(projectId, collaborator, nowIso);
    if (!updatedProject) {
      throw new NotFoundException(`Project with ID ${projectId} not found.`);
    }
    return this.enrichProject(updatedProject);
  }

  getRemovalBlockers(projectId: string, userId: string): RemovalCheckResult {
    const project = this.findById(projectId);
    if (!project) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        code: 'PROJECT_NOT_FOUND',
        message: `Project ${projectId} not found.`,
      });
    }

    const targets = new Set<string>();
    if (userId) targets.add(String(userId).trim().toLowerCase());

    let user: any = null;
    try {
      user = this.usersService?.findById ? this.usersService.findById(userId) : null;
    } catch {}
    if (user) {
      if (user.id) targets.add(String(user.id).trim().toLowerCase());
      if (user.name) targets.add(String(user.name).trim().toLowerCase());
      if (user.username) targets.add(String(user.username).trim().toLowerCase());
      if (user.email) targets.add(String(user.email).trim().toLowerCase());
    }

    const rawCollabs = Array.isArray(project.collaborators) && project.collaborators.length > 0
      ? project.collaborators
      : (Array.isArray(project.members) ? project.members : []);

    for (const c of rawCollabs) {
      const cId = String(typeof c === 'string' ? c : (c.id || c.userId || '')).trim().toLowerCase();
      if (targets.has(cId) || cId === String(userId).trim().toLowerCase()) {
        if (typeof c === 'object' && c !== null) {
          if (c.id) targets.add(String(c.id).trim().toLowerCase());
          if (c.userId) targets.add(String(c.userId).trim().toLowerCase());
          if (c.name) targets.add(String(c.name).trim().toLowerCase());
          if (c.username) targets.add(String(c.username).trim().toLowerCase());
        }
      }
    }

    const allTasks = this.tasksService ? (this.tasksService.findAllByProjectId(projectId) || []) : [];

    const blockers: RemovalBlockerTask[] = [];
    const tasksToRelease: RemovalTaskSummary[] = [];
    const tasksKept: RemovalTaskSummary[] = [];

    for (const task of allTasks) {
      const isAssigned = Array.from(targets).some((t) =>
        (task.assigneeId && String(task.assigneeId).trim().toLowerCase() === t) ||
        (task.assigneeName && String(task.assigneeName).trim().toLowerCase() === t) ||
        (task.assignee && String(task.assignee).trim().toLowerCase() === t) ||
        (task.assignedTo && String(task.assignedTo).trim().toLowerCase() === t)
      );

      if (!isAssigned) continue;

      const norm = String(task.status || '').trim().toLowerCase().replace(/[\s-_]/g, '');
      const isInReview = norm === 'inreview' || norm === 'underreview' || norm === 'submitted';
      const isCompleted = norm === 'completed' || norm === 'done' || norm === 'approved';

      if (isInReview) {
        blockers.push({
          taskId: String(task.id),
          title: String(task.title || 'Untitled Task'),
          submittedAt:
            task.inReviewSince ||
            (task.updatedAt ? new Date(task.updatedAt).toISOString() : (task.createdAt ? new Date(task.createdAt).toISOString() : undefined)),
        });
      } else if (isCompleted) {
        tasksKept.push({
          taskId: String(task.id),
          title: String(task.title || 'Untitled Task'),
          status: task.status,
        });
      } else {
        tasksToRelease.push({
          taskId: String(task.id),
          title: String(task.title || 'Untitled Task'),
          status: task.status,
        });
      }
    }

    return {
      allowed: blockers.length === 0,
      blockers,
      tasksToRelease,
      tasksKept,
    };
  }

  getRemovalCheck(projectId: string, memberId: string, caller?: any, callerRole?: string): RemovalCheckResult {
    const project = this.findById(projectId);
    if (!project) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        code: 'PROJECT_NOT_FOUND',
        message: `Project ${projectId} not found.`,
      });
    }

    const callerUserId = typeof caller === 'string'
      ? caller.trim()
      : String(caller?.uid || caller?.id || caller?.userId || caller?.sub || '').trim();
    const callerUserRole = typeof caller === 'object' && caller !== null
      ? (caller.role || caller.roleName || callerRole)
      : callerRole;
    const userForCheck = typeof caller === 'object' && caller !== null
      ? caller
      : { uid: callerUserId, id: callerUserId, role: callerUserRole };

    const isOwner = isProjectOwner(project, userForCheck);
    const isAdmin = isPlatformAdminOrSuperUser(userForCheck);
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'FORBIDDEN',
        message: 'Only the project owner can check collaborator removal.',
      });
    }

    const rawCollabs = Array.isArray(project.collaborators) && project.collaborators.length > 0
      ? project.collaborators
      : (Array.isArray(project.members)
        ? project.members.filter((m: any) => String(m.role || '').toLowerCase() !== 'owner')
        : []);

    const targetLower = String(memberId).trim().toLowerCase();
    const isCollaborator = rawCollabs.some((c: any) => {
      const cId = String(typeof c === 'string' ? c : (c.id || c.userId || '')).trim().toLowerCase();
      return cId === targetLower;
    });

    const isRemoved = Array.isArray(project.removedUsers) && project.removedUsers.some((r: any) => {
      const rId = String(typeof r === 'object' ? (r.userId || r.id || '') : r).trim().toLowerCase();
      return rId === targetLower;
    });

    if (!isCollaborator || isRemoved) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        code: 'MEMBER_NOT_FOUND',
        message: `Member ${memberId} not found in project.`,
      });
    }

    return this.getRemovalBlockers(projectId, memberId);
  }

  removeMember(
    projectId: string,
    memberId: string,
    reason: string,
    caller?: any,
    callerRole?: string,
    feedbackPayload?: any,
  ): Project {
    const project = this.findById(projectId);
    if (this.isLocked(project)) {
      throw new BadRequestException('Project is locked. Members cannot be removed from a completed project.');
    }

    // Business Rule: A mentor cannot leave or be removed once a project has started.
    const isMentor =
      (project.mentorId && (project.mentorId === memberId || String(project.mentorId) === String(memberId))) ||
      (project.mentor && (project.mentor === memberId || (typeof project.mentor === 'string' && project.mentor.toLowerCase() === memberId.toLowerCase()))) ||
      (typeof project.mentor === 'object' && project.mentor !== null &&
        ((project.mentor as any).id === memberId || (project.mentor as any).userId === memberId ||
         ((project.mentor as any).name && (project.mentor as any).name.toLowerCase() === memberId.toLowerCase())));
    if (isMentor) {
      throw new ForbiddenException('A mentor cannot leave or be removed once a project has started.');
    }

    const callerUserId = typeof caller === 'string'
      ? caller.trim()
      : String(caller?.uid || caller?.id || caller?.userId || caller?.sub || '').trim();
    const callerUserRole = typeof caller === 'object' && caller !== null
      ? (caller.role || caller.roleName || callerRole)
      : callerRole;
    const userForCheck = typeof caller === 'object' && caller !== null
      ? caller
      : { uid: callerUserId, id: callerUserId, role: callerUserRole };

    const isOwner = isProjectOwner(project, userForCheck);
    const isAdmin = isPlatformAdminOrSuperUser(userForCheck);
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('Only the project owner can remove team members.');
    }

    // Business Rule: The owner cannot remove themselves
    const isRemovingSelf =
      (project.ownerId && String(project.ownerId) === String(memberId)) ||
      (callerUserId && String(callerUserId) === String(memberId));
    if (isRemovingSelf) {
      throw new BadRequestException('Project owner cannot remove themselves from their own project.');
    }

    // Business Rule: Owner cannot remove a collaborator who has a task waiting for review
    const removalCheck = this.getRemovalBlockers(projectId, memberId);
    if (!removalCheck.allowed || removalCheck.blockers.length > 0) {
      try {
        this.auditService.log({
          action: 'MEMBER_REMOVAL_BLOCKED',
          actor: callerUserId || 'Owner',
          target: memberId,
          entityType: 'project',
          entityId: projectId,
          event: `Member removal blocked: ${removalCheck.blockers.length} task(s) in review`,
          details: {
            projectId,
            memberId,
            count: removalCheck.blockers.length,
          },
        });
      } catch (err: any) {
        console.warn('[projects.service] Suppressed audit error:', err?.message || err);
      }
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'MEMBER_HAS_TASKS_IN_REVIEW',
        message:
          'Review these submitted tasks first: approve them or send them back with feedback. Then you can remove this member.',
        blockers: removalCheck.blockers,
        allowed: false,
      });
    }

    let feedbackRecord: any;
    let effectiveReason = (reason || '').trim();
    if (this.feedbackService) {
      let fb = feedbackPayload?.reasons !== undefined
        ? { reasons: feedbackPayload.reasons, explanation: feedbackPayload.explanation }
        : ((feedbackPayload as any)?.feedback || (reason ? { reasons: ['OTHER'], explanation: reason } : undefined));
      if (!fb) {
        fb = { reasons: [] };
      }
      const validated = this.feedbackService.validate('REMOVE_COLLABORATOR', fb, userForCheck, project);
      effectiveReason = validated.explanation || validated.reasons.join(', ');
      feedbackRecord = this.feedbackService.record({
        actionType: 'REMOVE_COLLABORATOR',
        entityType: 'MEMBERSHIP',
        entityId: `${projectId}:${memberId}`,
        projectId,
        actorUserId: callerUserId || 'Owner',
        targetUserId: memberId,
        reasons: validated.reasons,
        explanation: validated.explanation,
      });
    } else {
      if (effectiveReason.length < 10) {
        throw new BadRequestException('A removal reason of at least 10 characters is required.');
      }
    }

    const trimmedReason = effectiveReason;

    // Remove from collaborators
    let rawCollabs = Array.isArray(project.collaborators) && project.collaborators.length > 0
      ? project.collaborators.filter((c: any) => {
          const r = typeof c === 'object' && c ? String(c.role || '').trim().toLowerCase() : '';
          return r !== 'owner' && r !== 'mentor';
        })
      : (Array.isArray(project.members)
        ? project.members.filter((m: any) => {
            const r = String(m.role || '').trim().toLowerCase();
            return r !== 'owner' && r !== 'mentor';
          })
        : []);
    if ((!project.collaborators || project.collaborators.length === 0) && rawCollabs.length > 0) {
      project.collaborators = rawCollabs;
    }
    const collabs = rawCollabs.filter((c: any) => {
      const cId = String(typeof c === 'string' ? c : (c.id || c.userId || '')).trim();
      const isRemoved = Array.isArray(project.removedUsers) && project.removedUsers.some((r: any) => {
        const rId = String(typeof r === 'object' ? (r.userId || r.id || '') : r).trim();
        return rId && cId && rId === cId;
      });
      return !isRemoved;
    });
    let memberName = memberId;
    project.collaborators = collabs.filter((c: any) => {
      const cId = String(typeof c === 'string' ? c : (c.id || c.userId || '')).trim();
      const isMatch = (cId === memberId);
      if (isMatch && typeof c === 'object' && c.name) {
        memberName = c.name;
      }
      return !isMatch;
    });

    // Record removed user so they cannot re-apply
    if (!project.removedUsers) {
      project.removedUsers = [];
    }
    const alreadyRecorded = project.removedUsers.some((r) => r.userId === memberId);
    if (!alreadyRecorded) {
      const removedIso = this.clockService ? this.clockService.nowIso() : new Date().toISOString();
      project.removedUsers.push({
        userId: memberId,
        userName: memberName,
        reason: trimmedReason,
        removedAt: removedIso,
      });
    }

    // Return only Open and In Progress tasks to Unassigned & To Do; In Review tasks remain intact
    try {
      this.tasksService.releaseMemberTasksOnDeparture({
        userId: memberId,
        userName: memberName,
        projectId,
        reason: 'removed',
        notifyOnSuspend: false,
      });
    } catch (err) {
      console.error('Failed to release tasks for removed user:', err);
    }

    // Mark join requests as Removed
    try {
      this.joinRequestsService.markUserRemoved(projectId, memberId, trimmedReason);
    } catch (err) {
      console.error('Failed to update join request for removed user:', err);
    }

    // Notify the removed member
    try {
      this.notificationsService.create({
        userId: memberId,
        type: 'PROJECT_UPDATE',
        title: 'Project Membership Ended',
        message: `⚠️ You were removed from "${project.title || project.name}". Reason: ${trimmedReason}`,
        readStatus: false,
        referenceId: projectId,
      });
    } catch (err: any) {
        console.warn('[projects.service] Suppressed non-critical error:', err?.message || err);
      }

    try {
      this.auditService.log({
        action: 'member-removed',
        actor: callerUserId || 'Owner',
        target: memberName,
        entityType: 'project',
        entityId: projectId,
        event: `Collaborator (${memberName}) was removed from project "${project.title || project.name}"`,
        details: { reason: trimmedReason },
      });
    } catch (err: any) {
        console.warn('[projects.service] Suppressed non-critical error:', err?.message || err);
      }

    project.members = this.buildProjectMembersList(project);
    this.projectsRepository.update(project.id, {
      collaborators: project.collaborators,
      removedUsers: project.removedUsers,
      members: project.members,
    } as any);
    if (isOwner) {
      this.recordOwnerAction(project.id, callerUserId);
    }
    return this.enrichProject(project);
  }

  leaveProject(projectId: string, userId: string, dto?: LeaveProjectDto, effectiveRole?: string): Project {
    const project = this.findById(projectId);
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found.`);
    }

    if (this.isLocked(project) || String(project.status || '').toLowerCase() === 'closed') {
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

    // Business Rule: A mentor cannot leave or be removed once a project has started.
    const isMentor =
      String(effectiveRole || '').toLowerCase() === 'mentor' ||
      (project.mentorId && (project.mentorId === userId || String(project.mentorId) === String(userId))) ||
      (project.mentor && (project.mentor === userId || (typeof project.mentor === 'string' && project.mentor.toLowerCase() === userId.toLowerCase()))) ||
      (typeof project.mentor === 'object' && project.mentor !== null &&
        ((project.mentor as any).id === userId || (project.mentor as any).userId === userId ||
         ((project.mentor as any).name && (project.mentor as any).name.toLowerCase() === userId.toLowerCase())));
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

    // Direct leave is deprecated. Members must submit a leave request for owner approval.
    throw new HttpException(
      {
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        code: 'USE_LEAVE_REQUEST',
        message: 'Collaborators cannot leave directly. Please submit a leave request for owner approval.',
      },
      HttpStatus.CONFLICT,
    );
  }

  /**
   * Executes a collaborator's departure from a project (called when leave request is approved or auto-approved).
   */
  executeMemberDeparture(
    projectId: string,
    userId: string,
    reasons?: string[],
    explanation?: string,
    approvedBy?: string,
  ): Project {
    const project = this.findById(projectId);
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found.`);
    }

    const rawCollabs = Array.isArray(project.collaborators) ? project.collaborators : [];
    let memberName = userId;
    const remainingCollabs = rawCollabs.filter((c: any) => {
      const cId = String(typeof c === 'string' ? c : (c.id || c.userId || '')).trim();
      const isMatch = (cId === userId);
      if (isMatch && typeof c === 'object' && c.name) {
        memberName = c.name;
      }
      return !isMatch;
    });

    project.collaborators = remainingCollabs;
    if (!project.removedUsers) {
      project.removedUsers = [];
    }
    const alreadyRemoved = project.removedUsers.some(
      (ru: any) => String(typeof ru === 'object' ? (ru.userId || ru.id) : ru) === String(userId),
    );
    if (!alreadyRemoved) {
      const removedIso = this.clockService ? this.clockService.nowIso() : new Date().toISOString();
      const reasonStr = (reasons && reasons.length > 0)
        ? `${reasons.join(', ')}: ${explanation || ''}`.trim()
        : (explanation || 'Leave request approved');
      project.removedUsers.push({
        userId,
        userName: memberName,
        reason: reasonStr,
        removedAt: removedIso,
      });
    }
    project.members = this.buildProjectMembersList(project);

    this.projectsRepository.update(project.id, {
      collaborators: project.collaborators,
      removedUsers: project.removedUsers,
      members: project.members,
    } as any);

    // Return only Open and In Progress tasks to Unassigned & To Do; In Review tasks & proof stay intact
    let releasedTasks: any[] = [];
    try {
      const releaseRes = this.tasksService.releaseMemberTasksOnDeparture({
        userId,
        userName: memberName,
        projectId,
        reason: 'left',
        notifyOnSuspend: false,
      });
      releasedTasks = Array.isArray(releaseRes?.releasedTasks) ? releaseRes.releasedTasks : [];
    } catch (err: any) {
      console.warn('[projects.service] Failed to release tasks for leaving user:', err?.message || err);
    }

    // Mark join requests as Left
    try {
      this.joinRequestsService.markUserLeft(projectId, userId);
    } catch (err: any) {
      console.warn('[projects.service] Failed to update join request for leaving user:', err?.message || err);
    }

    // Record universal feedback if reasons provided
    try {
      if (this.feedbackService && reasons && reasons.length > 0) {
        this.feedbackService.record({
          actionType: 'LEAVE_PROJECT',
          entityType: 'MEMBERSHIP',
          entityId: `${projectId}:${userId}`,
          projectId,
          actorUserId: userId,
          targetUserId: String(project.ownerId),
          reasons,
          explanation: explanation || '',
        });
      }
    } catch (err: any) {
      console.warn('[projects.service] Failed recording leave feedback:', err?.message || err);
    }

    // Notify project owner if system approved
    const projectTitle = project.title || project.name || `Project ${projectId}`;
    try {
      if (project.ownerId && approvedBy === 'system') {
        if (releasedTasks.length > 0) {
          const items: NotificationGroupedItem[] = releasedTasks.map((t: any) => ({
            label: t.title || t.id,
            link: `/owner/workspace/${projectId}`,
          }));
          dispatchGroupedNotification(
            this.notificationsService,
            String(project.ownerId),
            `member_left_tasks:${projectId}:${userId}`,
            items,
            (groupedItems, count) => ({
              type: 'TASK_RELEASED',
              title: `${count} ${count === 1 ? 'task' : 'tasks'} released from ${projectTitle}`,
              message: `${count} ${count === 1 ? 'task' : 'tasks'} released from ${projectTitle} after ${memberName} departed: ${formatGroupedItemList(groupedItems, 10)}`,
              readStatus: false,
              referenceId: projectId,
              link: `/owner/workspace/${projectId}`,
              metadata: { projectTitle },
            }),
          );
        } else {
          this.notificationsService.create({
            userId: project.ownerId,
            type: 'PROJECT_UPDATE',
            title: 'Collaborator Left Project',
            message: `Collaborator (${memberName}) departed from project "${projectTitle}".`,
            readStatus: false,
            referenceId: projectId,
          });
        }
      }
    } catch (err: any) {
      console.warn('[projects.service] Suppressed non-critical notification error:', err?.message || err);
    }

    try {
      this.auditService?.log?.({
        action: 'member-left',
        actor: memberName,
        target: project.title || project.name || 'Project',
        entityType: 'project',
        entityId: projectId,
        event: `Collaborator (${memberName}) departed from project "${project.title || project.name}"`,
        details: { reasons, explanation, approvedBy },
      });
    } catch (err: any) {
      console.warn('[projects.service] Suppressed non-critical audit error:', err?.message || err);
    }

    return this.enrichProject(project);
  }

  closeProject(
    projectId: string,
    reason: string,
    actor = 'System',
    options?: {
      batchMemberItems?: Map<string, NotificationGroupedItem[]>;
      suppressOwnerNotice?: boolean;
    },
    feedbackPayload?: any,
  ): Project {
    const project = this.findById(projectId);
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found.`);
    }

    if (String(project.status || '').toLowerCase() === 'closed') {
      return this.enrichProject(project);
    }
    if (project.isCompleted || String(project.status || '').toLowerCase() === 'completed') {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'PROJECT_LOCKED',
        message: 'Completed project cannot be closed.',
      });
    }

    let feedbackRecord: any;
    if (this.feedbackService && actor !== 'System') {
      let fb = feedbackPayload?.reasons !== undefined
        ? { reasons: feedbackPayload.reasons, explanation: feedbackPayload.explanation }
        : ((feedbackPayload as any)?.feedback || (reason ? { reasons: ['OTHER'], explanation: reason } : undefined));
      if (!fb && (!feedbackPayload || Object.keys(feedbackPayload).length === 0)) {
        fb = { reasons: ['OTHER'], explanation: reason || 'Project closed by admin' };
      }
      if (fb) {
        const validated = this.feedbackService.validate('CANCEL_PROJECT', fb, actor, project);
        feedbackRecord = this.feedbackService.record({
          actionType: 'CANCEL_PROJECT',
          entityType: 'PROJECT',
          entityId: projectId,
          projectId,
          actorUserId: String(actor),
          reasons: validated.reasons,
          explanation: validated.explanation,
        });
      }
    }

    const nowIso = this.clockService ? this.clockService.nowIso() : new Date().toISOString();
    const projectTitle = project.title || project.name || `Project ${project.id}`;
    project.status = ProjectStatus.Closed;
    project.closureReason = reason;
    project.closedAt = nowIso;
    project.pausedAt = undefined;
    project.pendingReviewGraceExpiresAt = undefined;

    this.projectsRepository.update(project.id, {
      status: ProjectStatus.Closed,
      closureReason: reason,
      closedAt: nowIso,
      pausedAt: undefined,
      pendingReviewGraceExpiresAt: undefined,
    } as any);

    // Resolve open support ticket if this closure stemmed from an abandoned-owner close request
    if (project.closeRequestTicketId && this.supportService) {
      try {
        this.supportService.updateStatus(project.closeRequestTicketId, {
          status: 'resolved',
          note: reason,
        });
      } catch (err: any) {
        this.logger.warn(`Failed to resolve close request ticket ${project.closeRequestTicketId}: ${err?.message}`);
      }
    }

    // Close pending join requests without counting against applicants (collect applicant items & summary count)
    let closedPendingSummary: { count: number; items: NotificationGroupedItem[] } = {
      count: 0,
      items: [],
    };
    try {
      if (typeof (this.joinRequestsService as any)?.closePendingRequestsDetailed === 'function') {
        closedPendingSummary = (this.joinRequestsService as any).closePendingRequestsDetailed(project.id, reason);
      } else {
        const closedCount = Number(
          this.joinRequestsService?.closePendingRequestsForProject?.(project.id, reason) || 0,
        );
        closedPendingSummary = {
          count: closedCount,
          items: Array.from({ length: closedCount }, (_, i) => ({
            label: `Pending join request #${i + 1}`,
            link: `/owner/workspace/${project.id}`,
          })),
        };
      }
    } catch (err: any) {
      this.logger.warn(`Failed to close join requests on project closure: ${err?.message}`);
    }

    // Handle mentor session if any: active session is paid out to mentor, pending is refunded
    try {
      this.mentorMarketplaceService.handleProjectClosed(project.id, reason);
    } catch (err: any) {
      this.logger.warn(`Failed to handle mentor session on project closure: ${err?.message}`);
    }

    // Collect collaborator and mentor closure notices per recipient user (one notice per person)
    const localMemberItems = options?.batchMemberItems || new Map<string, NotificationGroupedItem[]>();
    const addMemberItem = (uid: string, link: string) => {
      if (!localMemberItems.has(uid)) localMemberItems.set(uid, []);
      localMemberItems.get(uid)!.push({ label: projectTitle, link });
    };

    const collaborators = Array.isArray(project.collaborators) ? project.collaborators : [];
    const uniqueCollabIds = new Set<string>();
    for (const c of collaborators) {
      const collabId = typeof c === 'string' ? c : (c.id || c.userId);
      if (collabId && String(collabId) !== String(project.ownerId)) {
        uniqueCollabIds.add(String(collabId));
      }
    }
    for (const collabId of uniqueCollabIds) {
      addMemberItem(collabId, `/collaborator/workspace/${project.id}`);
    }

    if (project.mentorId && String(project.mentorId) !== String(project.ownerId)) {
      addMemberItem(String(project.mentorId), `/mentor/workspace/${project.id}`);
    }

    if (!options?.batchMemberItems) {
      for (const [uid, items] of localMemberItems.entries()) {
        try {
          dispatchGroupedNotification(
            this.notificationsService,
            uid,
            `project_closed:${project.id}`,
            items,
            (groupedItems, count) => ({
              type: 'PROJECT_CLOSED',
              title: count > 1 ? `Projects Closed (${count})` : 'Project Closed',
              message:
                count === 1
                  ? `Project "${projectTitle}" was closed. Reason: ${reason}`
                  : `${count} projects were closed (${reason}): ${formatGroupedItemList(groupedItems, 10)}`,
              readStatus: false,
              referenceId: project.id,
              link: groupedItems[0]?.link || `/projects/${project.id}`,
            }),
          );
        } catch (err: any) {
          console.warn('[projects.service] Suppressed notification error:', err?.message || err);
        }
      }
    }

    // Notify owner ONCE with summary (including any closed pending join requests)
    if (
      !options?.suppressOwnerNotice &&
      project.ownerId &&
      (reason === 'No owner response' ||
        reason === 'Owner inactive' ||
        actor !== 'System' ||
        closedPendingSummary.count > 0)
    ) {
      try {
        if (closedPendingSummary.count > 0) {
          dispatchGroupedNotification(
            this.notificationsService,
            String(project.ownerId),
            `project_closed_owner:${project.id}`,
            closedPendingSummary.items,
            (groupedItems, count) => ({
              type: 'PROJECT_CLOSED',
              title: `Project Closed (${count} pending ${count === 1 ? 'request' : 'requests'} closed)`,
              message: `Your project "${projectTitle}" was closed (Reason: ${reason}). ${count} pending join ${count === 1 ? 'request was' : 'requests were'} closed: ${formatGroupedItemList(groupedItems, 10)}`,
              readStatus: false,
              referenceId: project.id,
              link: `/owner/workspace/${project.id}`,
            }),
          );
        } else {
          this.notificationsService.create({
            userId: String(project.ownerId),
            type: 'PROJECT_CLOSED',
            title: 'Project Closed',
            message: `Your project "${projectTitle}" was closed. Reason: ${reason}`,
            readStatus: false,
            referenceId: project.id,
            link: `/owner/workspace/${project.id}`,
          });
        }
      } catch (err: any) {
        console.warn('[projects.service] Suppressed owner notification error:', err?.message || err);
      }
    }

    // Audit log
    try {
      this.auditService.log({
        action: 'project-closed',
        actor: actor || 'System',
        target: projectTitle || 'Project',
        entityType: 'project',
        entityId: project.id,
        event: `Project "${projectTitle}" closed: ${reason}`,
        details: { reason, closedAt: nowIso },
      });
    } catch (err: any) {
      console.warn('[projects.service] Suppressed audit error:', err?.message || err);
    }

    return this.enrichProject(project);
  }

  handleOwnerSuspension(ownerUserId: string): Project[] {
    const ownedProjects = this.findByOwnerId(ownerUserId);
    const closed: Project[] = [];
    const batchMemberItems = new Map<string, NotificationGroupedItem[]>();

    for (const p of ownedProjects) {
      if (String(p.status || '').toLowerCase() !== 'closed') {
        const closedProj = this.closeProject(p.id, 'Owner suspended', 'System', {
          batchMemberItems,
          suppressOwnerNotice: true,
        });
        closed.push(closedProj);
      }
    }

    for (const [uid, items] of batchMemberItems.entries()) {
      try {
        dispatchGroupedNotification(
          this.notificationsService,
          uid,
          `owner_suspended:${ownerUserId}`,
          items,
          (groupedItems, count) => ({
            type: 'PROJECT_CLOSED',
            title: count > 1 ? `${count} Projects Closed (Owner suspended)` : 'Project Closed',
            message:
              count === 1
                ? `Project "${groupedItems[0].label}" was closed. Reason: Owner suspended`
                : `${count} projects were closed (Reason: Owner suspended): ${formatGroupedItemList(groupedItems, 10)}`,
            readStatus: false,
            referenceId: closed[0]?.id,
            link: groupedItems[0]?.link || `/projects/${closed[0]?.id || ''}`,
          }),
        );
      } catch (err: any) {
        console.warn('[projects.service] Suppressed notification error:', err?.message || err);
      }
    }

    return closed;
  }

  /**
   * Phase 4: Project owner changes deadline.
   * Enforces:
   * - Owner only (403 FORBIDDEN)
   * - Until project is Completed or Closed (409 PROJECT_LOCKED)
   * - Reason 10+ characters (400 REASON_REQUIRED)
   * - New date in future (400 DEADLINE_NOT_FUTURE)
   * - Not earlier than latest task due date (400 DEADLINE_BEFORE_TASKS)
   * - Notifies collaborators and mentor; writes audit entry.
   */
  changeDeadline(
    id: string,
    dto: ChangeDeadlineDto,
    callerUser: any,
    callerRole?: string,
  ): Project {
    const project = this.projectsRepository.findById(id);
    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found.`);
    }

    const isOwner = isProjectOwner(project, callerUser);
    const isAdmin = isPlatformAdminOrSuperUser(callerUser);
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'FORBIDDEN',
        message: 'Only the project owner can change the project deadline.',
      });
    }

    const statusLower = String(project.status || '').toLowerCase();
    if (statusLower === 'completed' || statusLower === 'closed' || project.isCompleted) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'PROJECT_LOCKED',
        message: 'Cannot change deadline of a completed or closed project.',
      });
    }

    const trimmedReason = (dto.reason || '').trim();
    if (!trimmedReason || trimmedReason.length < 10) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'REASON_REQUIRED',
        message: 'A reason of at least 10 characters is required to change the project deadline.',
      });
    }

    const newDueDate = new Date(dto.dueDate);
    if (isNaN(newDueDate.getTime())) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'DEADLINE_NOT_FUTURE',
        message: 'Invalid deadline date format.',
      });
    }

    const now = this.clockService ? this.clockService.now() : new Date();
    if (newDueDate.getTime() <= now.getTime()) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'DEADLINE_NOT_FUTURE',
        message: 'New project deadline must be in the future.',
      });
    }

    const tasks = this.tasksService ? this.tasksService.findAllByProjectId(id) : [];
    let latestTaskDueTime = 0;
    let latestTaskTitle = '';
    for (const task of tasks) {
      if (task.dueDate) {
        const tDue = new Date(task.dueDate).getTime();
        if (!isNaN(tDue) && tDue > latestTaskDueTime) {
          latestTaskDueTime = tDue;
          latestTaskTitle = task.title;
        }
      }
    }

    if (latestTaskDueTime > 0 && newDueDate.getTime() < latestTaskDueTime) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'DEADLINE_BEFORE_TASKS',
        message: `New project deadline cannot be earlier than task due date (${new Date(latestTaskDueTime).toISOString()}) for "${latestTaskTitle}".`,
      });
    }

    const oldDueDate = project.dueDate;
    const oldDueTime = oldDueDate ? new Date(oldDueDate).getTime() : 0;
    const newDueTime = newDueDate.getTime();
    const isExtended = oldDueTime > 0 && newDueTime > oldDueTime;
    const oldD = oldDueDate ? new Date(oldDueDate) : null;
    const oldMid = oldD && !isNaN(oldD.getTime()) ? Date.UTC(oldD.getUTCFullYear(), oldD.getUTCMonth(), oldD.getUTCDate()) : 0;
    const newMid = !isNaN(newDueDate.getTime()) ? Date.UTC(newDueDate.getUTCFullYear(), newDueDate.getUTCMonth(), newDueDate.getUTCDate()) : 0;
    const diffDays = isExtended ? Math.max(1, Math.round((newMid - oldMid) / (1000 * 60 * 60 * 24))) : 0;

    project.dueDate = newDueDate.toISOString();

    // Phase 9 Part C: Store each change in deadlineHistory: [{ previousDueDate, newDueDate, reason, changedBy, changedAt }]
    const historyEntry = {
      previousDueDate: oldDueDate || '',
      newDueDate: project.dueDate,
      reason: trimmedReason,
      changedBy: callerUser.name || String(callerUser.uid || callerUser.id || 'Owner'),
      changedAt: now.toISOString(),
    };
    if (!Array.isArray(project.deadlineHistory)) {
      project.deadlineHistory = [];
    }
    project.deadlineHistory.push(historyEntry);

    this.projectsRepository.update(id, {
      dueDate: project.dueDate,
      deadlineHistory: project.deadlineHistory,
    } as any);

    // If shiftTasks is true and deadline was extended, shift open tasks forward
    let shiftedTasksCount = 0;
    if (dto.shiftTasks && isExtended && diffDays > 0) {
      const nowTime = now.getTime();
      for (const task of tasks) {
        const isApproved =
          task.status === TaskStatus.Completed ||
          (typeof task.status === 'string' &&
            (task.status.toLowerCase() === 'completed' || task.status.toLowerCase() === 'approved'));
        if (isApproved) {
          continue; // Shifting never moves a task that is Approved
        }
        if (task.dueDate) {
          const currentTaskTime = new Date(task.dueDate).getTime();
          if (!isNaN(currentTaskTime)) {
            const shiftedTime = currentTaskTime + diffDays * 24 * 60 * 60 * 1000;
            // Shifting never moves a task to a date earlier than today
            const finalTime = Math.max(nowTime, shiftedTime);
            const shiftedIso = new Date(finalTime).toISOString();
            task.dueDate = shiftedIso;
            if (this.tasksService) {
              try {
                this.tasksService.update(task.id, { dueDate: shiftedIso } as any);
              } catch {}
            }
            shiftedTasksCount++;
          }
        }
      }

      if (shiftedTasksCount > 0) {
        try {
          this.auditService.log({
            action: 'project-deadline-tasks-shifted',
            actor: callerUser.name || `User #${callerUser.uid || callerUser.id}`,
            target: project.title || project.name,
            entityType: 'project',
            entityId: id,
            event: `Shifted ${shiftedTasksCount} open task deadlines forward by ${diffDays} days following project deadline extension.`,
            details: { shiftedCount: shiftedTasksCount, diffDays, newDueDate: project.dueDate },
          });
        } catch (err: any) {
          console.warn('[projects.service] Suppressed non-critical error:', err?.message || err);
        }
      }
    }

    // Audit entry
    try {
      this.auditService.log({
        action: 'project-deadline-changed',
        actor: callerUser.name || `User #${callerUser.uid || callerUser.id}`,
        target: project.title || project.name,
        entityType: 'project',
        entityId: id,
        event: `Project deadline changed from ${oldDueDate || 'none'} to ${project.dueDate}. Reason: ${trimmedReason}`,
        details: { oldDueDate, newDueDate: project.dueDate, reason: trimmedReason },
      });
    } catch (err: any) {
      console.warn('[projects.service] Suppressed non-critical error:', err?.message || err);
    }

    // Notify collaborators
    const collabs = Array.isArray(project.collaborators) ? project.collaborators : [];
    const members = Array.isArray(project.members) ? project.members : [];
    const notifiedUserIds = new Set<string>();

    for (const c of [...collabs, ...members]) {
      const uid = String(c?.userId || c?.id || c);
      if (uid && uid !== String(callerUser.uid || callerUser.id) && !notifiedUserIds.has(uid)) {
        notifiedUserIds.add(uid);
        try {
          this.notificationsService.create({
            userId: uid,
            type: 'PROJECT_DEADLINE_CHANGED',
            title: 'Project Deadline Changed',
            message: `The deadline for "${project.title || project.name}" was changed from ${oldDueDate || 'initial date'} to ${project.dueDate}. Reason: ${trimmedReason}`,
            readStatus: false,
            referenceId: id,
          });
        } catch (err: any) {
          console.warn('[projects.service] Suppressed non-critical error:', err?.message || err);
        }
      }
    }

    // Notify mentor
    if (project.mentorId && !notifiedUserIds.has(String(project.mentorId))) {
      try {
        this.notificationsService.create({
          userId: String(project.mentorId),
          type: 'PROJECT_DEADLINE_CHANGED',
          title: 'Project Deadline Changed',
          message: `The deadline for "${project.title || project.name}" was changed from ${oldDueDate || 'initial date'} to ${project.dueDate}. Reason: ${trimmedReason}`,
          readStatus: false,
          referenceId: id,
        });
      } catch (err: any) {
        console.warn('[projects.service] Suppressed non-critical error:', err?.message || err);
      }
    }

    if (isOwner) {
      this.recordOwnerAction(id, String(callerUser?.uid || callerUser?.id || project.ownerId));
    }
    return this.enrichProject(project);
  }

  /**
   * Phase 12: Record an authenticated write action by the project owner.
   */
  recordOwnerAction(projectId: string, userId?: string, customIso?: string): void {
    const project = this.projectsRepository.findById(projectId);
    if (!project) return;
    if (userId && String(project.ownerId) !== String(userId)) return;

    const nowIso = customIso || (this.clockService ? this.clockService.nowIso() : new Date().toISOString());
    project.lastOwnerActionAt = nowIso;
    project.ownerInactive14dNotifiedAt = undefined;
    project.ownerInactive30d = false;
    project.ownerInactive30dFlaggedAt = undefined;

    this.projectsRepository.update(project.id, {
      lastOwnerActionAt: nowIso,
      ownerInactive14dNotifiedAt: undefined,
      ownerInactive30d: false,
      ownerInactive30dFlaggedAt: undefined,
    } as any);
  }

  /**
   * Phase 12: Record task or chat activity for a project member.
   */
  recordMemberActivity(projectId: string, userId?: string, customIso?: string): void {
    if (!projectId || !userId) return;
    const project = this.projectsRepository.findById(projectId);
    if (!project) return;

    const nowIso = customIso || (this.clockService ? this.clockService.nowIso() : new Date().toISOString());
    const uid = String(userId);

    if (String(project.ownerId) === uid) {
      this.recordOwnerAction(projectId, uid, nowIso);
      return;
    }

    if (!project.memberActivity) {
      project.memberActivity = {};
    }

    const collabs = Array.isArray(project.collaborators) ? project.collaborators : [];
    const match = collabs.find((c: any) =>
      typeof c === 'string'
        ? String(c) === uid
        : String(c.id || c.userId) === uid || (c.name && c.name.toLowerCase() === uid.toLowerCase()),
    );

    const effectiveId = match && typeof match === 'object' ? String(match.id || match.userId || uid) : uid;
    project.memberActivity[effectiveId] = {
      ...(project.memberActivity[effectiveId] || {}),
      lastActivityAt: nowIso,
    };

    if (match && typeof match === 'object') {
      match.lastActivityAt = nowIso;
    }

    this.projectsRepository.update(project.id, {
      memberActivity: project.memberActivity,
      collaborators: project.collaborators,
    } as any);
  }

  /**
   * Phase 12: Clears 48-hour zombie pause once pending requests are decided.
   */
  clearZombiePause(projectId: string): void {
    const project = this.projectsRepository.findById(projectId);
    if (!project) return;
    if (!project.pausedAt && !project.pendingReviewGraceExpiresAt) return;
    project.pausedAt = undefined;
    project.pendingReviewGraceExpiresAt = undefined;
    this.projectsRepository.update(project.id, {
      pausedAt: undefined,
      pendingReviewGraceExpiresAt: undefined,
    } as any);
  }

  /**
   * Phase 12: One-click release of Open and In Progress tasks for a collaborator (In Review & Completed stay).
   */
  releaseMemberTasks(
    projectId: string,
    targetUserId: string,
    callerUser: any,
    callerRole?: string,
  ): { released: number; taskIds: string[]; tasks: any[] } {
    const project = this.findById(projectId);
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found.`);
    }

    if (this.isLocked(project)) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'PROJECT_LOCKED',
        message: 'Project is locked. Tasks cannot be modified.',
      });
    }

    const userForCheck =
      typeof callerUser === 'object' && callerUser !== null
        ? callerUser
        : { uid: callerUser, id: callerUser, role: callerRole };
    const isOwner = isProjectOwner(project, userForCheck);
    const isAdmin = isPlatformAdminOrSuperUser(userForCheck);
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'FORBIDDEN',
        message: 'Only the project owner or administrators can release member tasks.',
      });
    }

    const targetId = String(targetUserId);
    let memberName: string | undefined;
    const collabs = Array.isArray(project.collaborators) ? project.collaborators : [];
    const matchedCollab = collabs.find((c: any) =>
      typeof c === 'string' ? c === targetId : String(c.id || c.userId) === targetId,
    );
    if (matchedCollab && typeof matchedCollab === 'object') {
      memberName = matchedCollab.name;
    } else if (this.usersService) {
      try {
        const u = this.usersService.findUserSafe(targetId);
        if (u) memberName = u.name;
      } catch {}
    }

    const releasedTasks = this.tasksService.releaseOpenAndInProgressTasksForProjectMember(
      projectId,
      targetId,
      memberName,
    );

    if (!releasedTasks || releasedTasks.length === 0) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'NOTHING_TO_RELEASE',
        message: 'No Open or In Progress tasks are assigned to this member.',
      });
    }

    if (isOwner) {
      this.recordOwnerAction(projectId, String(userForCheck.uid || userForCheck.id || project.ownerId));
    }

    const taskTitles = releasedTasks.map((t: any) => t.title || t.id).join(', ');
    try {
      this.notificationsService.create({
        userId: targetId,
        type: 'TASKS_RELEASED',
        title: 'Tasks Released Back to Unassigned',
        message: `${releasedTasks.length} task(s) (${taskTitles}) in "${project.title || project.name}" were released back to Unassigned by the project owner.`,
        readStatus: false,
        referenceId: projectId,
        link: `/collaborator/workspace/${projectId}`,
      });
    } catch (err: any) {
      console.warn('[projects.service] Suppressed release-tasks notification error:', err?.message || err);
    }

    try {
      this.auditService.log({
        action: 'member-tasks-released',
        actor: String(userForCheck.uid || userForCheck.id || 'Owner'),
        target: memberName || targetId,
        entityType: 'project',
        entityId: projectId,
        event: `Released ${releasedTasks.length} Open/In Progress task(s) from ${memberName || targetId} in project "${project.title || project.name}"`,
        details: {
          targetUserId: targetId,
          releasedCount: releasedTasks.length,
          taskIds: releasedTasks.map((t: any) => t.id),
        },
      });
    } catch (err: any) {
      console.warn('[projects.service] Suppressed audit error:', err?.message || err);
    }

    return {
      released: releasedTasks.length,
      taskIds: releasedTasks.map((t: any) => t.id),
      tasks: releasedTasks,
    };
  }

  /**
   * Phase 12: Active collaborator requests admin closure when owner is inactive for 30+ days.
   */
  requestProjectClose(projectId: string, callerUser: any, reason?: string): any {
    const project = this.findById(projectId);
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found.`);
    }

    if (this.isLocked(project)) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'PROJECT_LOCKED',
        message: 'Project is already completed or closed.',
      });
    }

    const callerId = String(
      typeof callerUser === 'string'
        ? callerUser
        : callerUser?.uid || callerUser?.id || callerUser?.userId || '',
    ).trim();

    const isRemoved =
      Array.isArray(project.removedUsers) &&
      project.removedUsers.some((r: any) => String(r.userId || r.id) === callerId);
    const collabs = Array.isArray(project.collaborators) ? project.collaborators : [];
    const isActiveCollab =
      !isRemoved &&
      String(project.ownerId) !== callerId &&
      collabs.some((c: any) =>
        typeof c === 'string' ? c === callerId : String(c.id || c.userId) === callerId,
      );

    if (!isActiveCollab) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'NOT_A_MEMBER',
        message: 'Only an active collaborator on this project can request closure.',
      });
    }

    if (!project.ownerInactive30d) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'NOT_ELIGIBLE',
        message: 'Project is not eligible for closure request until owner has been inactive for 30 days.',
      });
    }

    if (project.closeRequestTicketId && this.supportService) {
      try {
        const existingTicket = this.supportService.findOne(project.closeRequestTicketId);
        if (existingTicket) {
          return {
            success: true,
            alreadyRequested: true,
            ticketId: existingTicket.id,
            ticket: existingTicket,
            project: this.enrichProject(project),
          };
        }
      } catch {}
    }

    const nowIso = this.clockService ? this.clockService.nowIso() : new Date().toISOString();
    let callerName = callerId;
    let callerEmail = 'collaborator@teamforge.io';
    if (this.usersService) {
      try {
        const u = this.usersService.findUserSafe(callerId);
        if (u) {
          callerName = u.name || callerId;
          callerEmail = u.email || callerEmail;
        }
      } catch {}
    }

    const trimmedReason = (reason || '').trim();
    const message =
      trimmedReason ||
      `Collaborator ${callerName} requested administrative closure for project "${project.title || project.name}" (${project.id}) because the project owner has been inactive for 30+ days.`;

    let ticket: any = null;
    if (this.supportService) {
      ticket = this.supportService.create({
        type: 'project_closure',
        priority: 'high',
        category: 'Project Closure Request',
        subject: `Ask Admin to Close: ${project.title || project.name}`,
        message,
        userId: callerId,
        userName: callerName,
        from: callerEmail,
        projectId: project.id,
        internalSystem: true,
        metadata: {
          projectId: project.id,
          ownerId: project.ownerId,
          requestedBy: callerId,
          type: 'abandoned_owner_close_request',
        },
      });
    }

    project.closeRequestedAt = nowIso;
    project.closeRequestedBy = callerId;
    if (ticket?.id) {
      project.closeRequestTicketId = ticket.id;
    }

    this.projectsRepository.update(project.id, {
      closeRequestedAt: nowIso,
      closeRequestedBy: callerId,
      closeRequestTicketId: project.closeRequestTicketId,
    } as any);

    // Notify owner that closure was requested due to inactivity
    if (project.ownerId) {
      try {
        this.notificationsService.create({
          userId: String(project.ownerId),
          type: 'PROJECT_CLOSE_REQUEST',
          title: 'Project Closure Requested',
          message: `A collaborator requested admin closure for "${project.title || project.name}" due to 30+ days of owner inactivity.`,
          readStatus: false,
          referenceId: project.id,
          link: `/owner/workspace/${project.id}`,
        });
      } catch (err: any) {
        console.warn('[projects.service] Suppressed close-request owner notification error:', err?.message || err);
      }
    }

    try {
      this.auditService.log({
        action: 'project-close-requested',
        actor: callerName,
        target: project.title || project.name || project.id,
        entityType: 'project',
        entityId: project.id,
        event: `Collaborator ${callerName} requested admin closure for inactive-owner project "${project.title || project.name}"`,
        details: { projectId: project.id, requestedBy: callerId, ticketId: ticket?.id },
      });
    } catch (err: any) {
      console.warn('[projects.service] Suppressed audit error:', err?.message || err);
    }

    return {
      success: true,
      ticketId: ticket?.id,
      ticket,
      project: this.enrichProject(project),
    };
  }

  /**
   * Counts non-finished projects where userId is an active member (collaborator).
   * Owning a project or completed/closed projects never count toward the membership cap.
   */
  getUserActiveMemberships(userId: string): Array<{ id: string; title: string; status: string }> {
    const uid = String(userId || '').trim();
    if (!uid) return [];
    const all = this.projectsRepository.findAll();
    const active: Array<{ id: string; title: string; status: string }> = [];

    for (const p of all) {
      if (!p) continue;
      if (String(p.ownerId) === uid) continue;

      const statusLower = String(p.status || '').toLowerCase().trim();
      const isFinished =
        p.isCompleted === true ||
        statusLower === 'completed' ||
        statusLower === 'closed' ||
        statusLower === 'cancelled' ||
        statusLower === 'archived';
      if (isFinished) continue;

      const collabs = Array.isArray(p.collaborators) ? p.collaborators : [];
      const isMember = collabs.some((c: any) =>
        typeof c === 'string'
          ? String(c) === uid
          : String(c?.id || c?.userId || '') === uid,
      );
      if (isMember) {
        active.push({
          id: String(p.id),
          title: p.title || p.name || String(p.id),
          status: String(p.status || 'Open'),
        });
      }
    }

    return active;
  }

  assertCanJoinProject(userId: string): void {
    const config = this.platformConfigService?.getConfig?.();
    const maxAllowed = config?.maxActiveMemberships ?? 3;
    const activeProjects = this.getUserActiveMemberships(userId);
    if (activeProjects.length >= maxAllowed) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'ACTIVE_PROJECT_CAP',
        message: `You are already an active member of ${activeProjects.length} projects (maximum ${maxAllowed}). Complete or leave a project before joining another.`,
        currentCount: activeProjects.length,
        maxAllowed,
        projects: activeProjects,
      });
    }
  }

  getSkillMatchForProject(projectId: string, userId: string): SkillMatchResult {
    const project = this.findById(projectId);
    let user: any = null;
    if (this.usersService) {
      try {
        user =
          typeof this.usersService.findRawUserById === 'function'
            ? this.usersService.findRawUserById(userId)
            : typeof this.usersService.findById === 'function'
              ? this.usersService.findById(userId)
              : null;
      } catch {}
    }
    const userSkills =
      user?.skills ||
      user?.profile?.skills ||
      user?.data?.skills ||
      [];
    const projectSkills =
      Array.isArray(project.requiredSkills) && project.requiredSkills.length > 0
        ? project.requiredSkills
        : project.skills || [];
    return computeSkillMatch(userSkills, projectSkills);
  }

  checkDeletion(
    projectId: string,
    callerId: string,
    callerRole?: string,
  ): {
    allowed: boolean;
    blockers: any[];
    impact: any;
    requiresReason: boolean;
    noticeHours: number;
    mode: 'immediate' | 'scheduled';
  } {
    const userObj = { uid: callerId, id: callerId, role: callerRole };
    const evaluation = this.getDeletionPolicy().evaluate(projectId, userObj);
    return {
      allowed: evaluation.allowed,
      blockers: evaluation.blockers,
      impact: evaluation.impact,
      requiresReason: evaluation.requiresReason,
      noticeHours: evaluation.noticeHours,
      mode: evaluation.mode,
    };
  }

  cancelDeletion(
    projectId: string,
    callerId: string,
    callerRole?: string,
  ): { cancelled: boolean; status: string; project: Project } {
    const project = this.projectsRepository.findById(projectId);
    if (!project) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        code: 'PROJECT_NOT_FOUND',
        message: `Project with ID ${projectId} not found.`,
      });
    }

    const userObj = { uid: callerId, id: callerId, role: callerRole };
    const isOwner =
      isProjectOwner(project, userObj) || String(project.ownerId) === String(callerId);
    const isAdmin = isPlatformAdminOrSuperUser(userObj);
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'NOT_PROJECT_OWNER',
        message: 'Only the project owner or an administrator can cancel scheduled deletion.',
      });
    }

    if (!project.deletionScheduledAt) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'NO_DELETION_SCHEDULED',
        message: 'No deletion is currently scheduled for this project.',
      });
    }

    const prevStatus = project.previousStatus || 'Open';
    const updated = this.projectsRepository.update(projectId, {
      deletionScheduledAt: undefined,
      deletionRequestedBy: undefined,
      previousStatus: undefined,
      status: prevStatus,
    } as any)!;

    try {
      this.auditService.log({
        action: 'PROJECT_DELETION_CANCELLED',
        actor: String(callerId),
        performedBy: String(callerId),
        target: project.title || project.id,
        entityType: 'project',
        entityId: project.id,
        event: `Project "${project.title || project.id}" deletion cancelled by ${callerId}`,
        details: {
          projectId: project.id,
          cancelledBy: String(callerId),
          restoredStatus: prevStatus,
        },
      });
    } catch {}

    const memberIds = new Set<string>();
    if (Array.isArray(project.members)) {
      project.members.forEach((m: any) => {
        const id = m?.id || m?.userId;
        if (id) memberIds.add(String(id));
      });
    }
    if (Array.isArray(project.collaborators)) {
      project.collaborators.forEach((c: any) => {
        const id = typeof c === 'object' && c !== null ? (c.id || c.userId) : c;
        if (id) memberIds.add(String(id));
      });
    }
    for (const mId of memberIds) {
      if (mId && String(mId) !== String(callerId)) {
        try {
          this.notificationsService.create({
            userId: String(mId),
            type: 'PROJECT_DELETION_CANCELLED',
            title: 'Project Deletion Cancelled',
            message: `Scheduled deletion for project "${project.title || project.name}" was cancelled. The project has been restored.`,
            readStatus: false,
            referenceId: project.id,
            link: `/projects/${project.id}`,
          });
        } catch {}
      }
    }

    return {
      cancelled: true,
      status: prevStatus,
      project: this.enrichProject(updated),
    };
  }

  executeFinalDeletion(
    projectId: string,
    actorId: string,
    options?: { reasonIds?: string[]; feedbackRecord?: any; isAdmin?: boolean; explanation?: string },
  ): {
    id: string;
    deletedAt: string;
    deletedBy: string;
    closedRequestsCount: number;
    cancelledInvitesCount: number;
    releasedTasksCount: number;
    refundedSessionsCount: number;
    project: Project;
  } {
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
      return {
        id: project.id,
        deletedAt: project.deletedAt,
        deletedBy: project.deletedBy || String(actorId),
        closedRequestsCount: 0,
        cancelledInvitesCount: 0,
        releasedTasksCount: 0,
        refundedSessionsCount: 0,
        project: this.enrichProject(project),
      };
    }

    const nowIso = this.clockService ? this.clockService.nowIso() : new Date().toISOString();

    // 1. Release open and in-progress tasks of all members via Phase 13 departure handler
    let releasedTasksCount = 0;
    const memberIds = new Set<string>();
    if (Array.isArray(project.members)) {
      project.members.forEach((m: any) => {
        const id = m?.id || m?.userId;
        if (id) memberIds.add(String(id));
      });
    }
    if (Array.isArray(project.collaborators)) {
      project.collaborators.forEach((c: any) => {
        const id = typeof c === 'object' && c !== null ? (c.id || c.userId) : c;
        if (id) memberIds.add(String(id));
      });
    }
    if (this.tasksService && typeof this.tasksService.releaseMemberTasksOnDeparture === 'function') {
      try {
        for (const mId of memberIds) {
          const res = this.tasksService.releaseMemberTasksOnDeparture({
            projectId,
            userId: String(mId),
            reason: 'removed',
            notifyOnSuspend: false,
          });
          releasedTasksCount += (res?.releasedTasks?.length || 0);
        }
      } catch {}
    }
    if (this.tasksService && typeof this.tasksService.findAllByProjectId === 'function') {
      try {
        const pTasks = this.tasksService.findAllByProjectId(projectId) || [];
        for (const t of pTasks) {
          const st = String(t.status || '').toLowerCase().trim();
          if (st === 'in-progress' || st === 'in_progress' || st === 'in progress' || t.assigneeId) {
            if (typeof this.tasksService.update === 'function') {
              this.tasksService.update(t.id, { status: 'open', assigneeId: null });
            } else {
              t.status = 'open';
              t.assigneeId = null;
              if ('assignedTo' in t) t.assignedTo = null;
            }
          }
        }
      } catch {}
    }

    // 2. Invalidate pending join requests as system_closed
    let closedRequestsCount = 0;
    if (this.joinRequestsService && typeof this.joinRequestsService.closePendingRequestsForProject === 'function') {
      try {
        closedRequestsCount = Number(
          this.joinRequestsService.closePendingRequestsForProject(
            projectId,
            'Closed because the project was deleted',
          ) || 0,
        );
      } catch {}
    }

    // 3. Cancel pending direct invitations
    let cancelledInvitesCount = 0;
    if (this.projectInvitesService && typeof this.projectInvitesService.cancelPendingForProject === 'function') {
      try {
        const res = this.projectInvitesService.cancelPendingForProject(
          projectId,
          String(actorId),
          'Closed because the project was deleted',
        );
        cancelledInvitesCount = res.cancelledCount || 0;
      } catch {}
    }

    // 4. Settle pending mentor sessions through Phase 9 refund path
    let refundedSessionsCount = 0;
    if (this.mentorMarketplaceService && typeof this.mentorMarketplaceService.handleProjectClosed === 'function') {
      try {
        const allSessions = this.mentorMarketplaceService.findAllSessions?.() || [];
        const projectSessions = allSessions.filter((s: any) => String(s.projectId) === String(projectId));
        refundedSessionsCount = projectSessions.filter((s: any) => ['escrow_funded', 'payment_pending', 'pending'].includes(String(s.status))).length;
        this.mentorMarketplaceService.handleProjectClosed(projectId, 'Project deleted', true);
      } catch {}
    }

    // 5. Update project record
    const updated = this.projectsRepository.update(projectId, {
      deletedAt: nowIso,
      deletedBy: String(actorId),
      deletionScheduledAt: undefined,
      deletionRequestedBy: undefined,
      previousStatus: undefined,
      status: 'deleted',
    } as any)!;

    // 6. Write audit log (no free text)
    try {
      this.auditService.log({
        action: 'PROJECT_DELETED',
        actor: String(actorId),
        performedBy: String(actorId),
        target: project.title || project.id,
        entityType: 'project',
        entityId: project.id,
        event: `Project "${project.title || project.id}" deleted by ${actorId}`,
        details: {
          projectId: project.id,
          deletedAt: nowIso,
          deletedBy: String(actorId),
          membersCount: Array.isArray(project.members) ? project.members.length : 0,
          closedRequestsCount,
          cancelledInvitesCount,
          releasedTasksCount,
          refundedSessionsCount,
          reasonIds: options?.reasonIds || [],
        },
      });
    } catch {}

    // 7. Notify members
    const members = Array.isArray(project.members) ? project.members : [];
    for (const m of members) {
      const mId = m.id || m.userId;
      if (mId && String(mId) !== String(actorId)) {
        try {
          this.notificationsService.create({
            userId: String(mId),
            type: 'PROJECT_DELETED',
            title: 'Project Deleted',
            message: `Project "${project.title || project.name}" has been deleted.`,
            readStatus: false,
            referenceId: project.id,
            link: `/projects/${project.id}`,
          });
        } catch {}
      }
    }

    // If deleted by admin, notify the owner as well
    if (options?.isAdmin && String(project.ownerId) !== String(actorId)) {
      try {
        this.notificationsService.create({
          userId: String(project.ownerId),
          type: 'PROJECT_DELETED_BY_ADMIN',
          title: 'Project Deleted by Administrator',
          message: `Your project "${project.title || project.name}" was deleted by an administrator. Reason: ${options?.explanation || 'Administrative action'}`,
          readStatus: false,
          referenceId: project.id,
          link: `/projects/${project.id}`,
        });
      } catch {}
    }

    return {
      id: project.id,
      deletedAt: nowIso,
      deletedBy: String(actorId),
      closedRequestsCount,
      cancelledInvitesCount,
      releasedTasksCount,
      refundedSessionsCount,
      project: this.enrichProject(updated),
    };
  }

  softDeleteProject(
    projectId: string,
    callerId: string,
    callerRole?: string,
    feedbackPayload?: any,
  ): any {
    return this.softDeleteProjectInternal(projectId, callerId, callerRole, feedbackPayload);
  }

  private softDeleteProjectInternal(
    projectId: string,
    callerId: string,
    callerRole?: string,
    feedbackPayload?: any,
  ): {
    id: string;
    mode: 'immediate' | 'scheduled';
    deletedAt?: string;
    deletionScheduledAt?: string;
    deletedBy?: string;
    closedRequestsCount?: number;
    cancelledInvitesCount?: number;
    releasedTasksCount?: number;
    refundedSessionsCount?: number;
    noticeHours?: number;
    project: Project;
    feedback?: any;
  } {
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

    if (project.deletionScheduledAt) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'DELETION_ALREADY_SCHEDULED',
        message: 'Project deletion is already scheduled.',
      });
    }

    const userObj = { uid: callerId, id: callerId, role: callerRole };
    const isOwner =
      isProjectOwner(project, userObj) || String(project.ownerId) === String(callerId);
    const isAdmin = isPlatformAdminOrSuperUser(userObj);
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'NOT_PROJECT_OWNER',
        message: 'Only the project owner or an administrator can delete this project.',
      });
    }

    // Typed title confirmation check (if provided in payload)
    const expectedTitle = String(project.title || project.name || '').trim();
    if (feedbackPayload && typeof feedbackPayload === 'object' && feedbackPayload.confirmTitle !== undefined) {
      const confirmTitle = String(feedbackPayload.confirmTitle || '').trim();
      if (!confirmTitle || confirmTitle !== expectedTitle) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          code: 'TITLE_MISMATCH',
          message: 'Project title confirmation does not match.',
        });
      }
    }

    // 24h deletion limit for owner (max 3)
    if (!isAdmin) {
      const nowMs = this.clockService ? this.clockService.now().getTime() : Date.now();
      const count24h = this.projectsRepository.getOwnerDeletionsInWindow(callerId, 24 * 60 * 60 * 1000, nowMs);
      if (count24h >= 3) {
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            error: 'Too Many Requests',
            code: 'PROJECT_DELETE_LIMIT',
            message: 'You have reached the deletion limit of 3 projects per 24 hours.',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    // Evaluate deletion conditions & hard blockers
    const evaluation = this.getDeletionPolicy().evaluate(projectId, userObj);
    if (!evaluation.allowed) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: evaluation.blockers[0]?.code || 'DELETION_BLOCKED',
        message: evaluation.blockers[0]?.message || 'Cannot delete project.',
        blockers: evaluation.blockers,
      });
    }

    // Validate reason if required
    let feedbackRecord: any;
    let reasonIds: string[] = [];
    let explanation = '';
    if (evaluation.requiresReason || isAdmin) {
      let fb = feedbackPayload?.reasons !== undefined
        ? { reasons: feedbackPayload.reasons, explanation: feedbackPayload.explanation }
        : ((feedbackPayload as any)?.feedback || (feedbackPayload?.reason ? { reasons: ['OTHER'], explanation: feedbackPayload.reason } : undefined));
      if (!fb && (!feedbackPayload || Object.keys(feedbackPayload).length === 0)) {
        if (isAdmin) {
          throw new BadRequestException({
            statusCode: 400,
            error: 'Bad Request',
            code: 'REASON_REQUIRED',
            message: 'Admin deletion requires a written explanation between 10 and 500 characters.',
          });
        }
        fb = { reasons: ['OTHER'], explanation: 'Deleted by project owner' };
      }
      if (!fb || !Array.isArray(fb.reasons) || fb.reasons.length === 0) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          code: 'REASON_REQUIRED',
          message: 'At least one reason is required for project deletion.',
        });
      }

      if (this.feedbackService) {
        const validated = this.feedbackService.validate('DELETE_PROJECT', fb, userObj, project);
        if (isAdmin) {
          const trimmed = typeof validated.explanation === 'string' ? validated.explanation.trim() : '';
          if (trimmed.length < 10 || trimmed.length > 500) {
            throw new BadRequestException({
              statusCode: 400,
              error: 'Bad Request',
              code: 'EXPLANATION_REQUIRED',
              message: 'Admin deletions require a written reason between 10 and 500 characters.',
            });
          }
        }
        reasonIds = validated.reasons;
        explanation = validated.explanation || '';
        feedbackRecord = this.feedbackService.record({
          actionType: 'DELETE_PROJECT',
          entityType: 'PROJECT',
          entityId: projectId,
          projectId,
          actorUserId: String(callerId),
          reasons: validated.reasons,
          explanation: validated.explanation,
        });
      }
    }

    // Branch on mode: scheduled vs immediate
    if (evaluation.mode === 'scheduled') {
      const nowMs = this.clockService ? this.clockService.now().getTime() : Date.now();
      const scheduledMs = nowMs + evaluation.noticeHours * 60 * 60 * 1000;
      const scheduledIso = new Date(scheduledMs).toISOString();

      const updated = this.projectsRepository.update(projectId, {
        deletionScheduledAt: scheduledIso,
        deletionRequestedBy: String(callerId),
        previousStatus: project.status || 'Open',
      } as any)!;

      try {
        this.auditService.log({
          action: 'PROJECT_DELETION_SCHEDULED',
          actor: String(callerId),
          performedBy: String(callerId),
          target: project.title || project.id,
          entityType: 'project',
          entityId: project.id,
          event: `Project "${project.title || project.id}" deletion scheduled for ${scheduledIso}`,
          details: {
            projectId: project.id,
            scheduledAt: scheduledIso,
            noticeHours: evaluation.noticeHours,
            membersCount: evaluation.impact.activeCollaborators,
            requestsCount: evaluation.impact.pendingRequests,
            invitesCount: evaluation.impact.pendingInvites,
            reasonIds,
          },
        });
      } catch {}

      // Notify involved people
      const memberIds = new Set<string>();
      if (Array.isArray(project.members)) {
        project.members.forEach((m: any) => {
          const id = m?.id || m?.userId;
          if (id) memberIds.add(String(id));
        });
      }
      if (Array.isArray(project.collaborators)) {
        project.collaborators.forEach((c: any) => {
          const id = typeof c === 'object' && c !== null ? (c.id || c.userId) : c;
          if (id) memberIds.add(String(id));
        });
      }
      for (const mId of memberIds) {
        if (mId && String(mId) !== String(callerId)) {
          try {
            this.notificationsService.create({
              userId: String(mId),
              type: 'PROJECT_DELETION_SCHEDULED',
              title: 'Project Scheduled for Deletion',
              message: `Project "${project.title || project.name}" is scheduled for deletion on ${scheduledIso}.`,
              readStatus: false,
              referenceId: project.id,
              link: `/projects/${project.id}`,
            });
          } catch {}
        }
      }

      return {
        id: project.id,
        mode: 'scheduled',
        deletionScheduledAt: scheduledIso,
        noticeHours: evaluation.noticeHours,
        project: this.enrichProject(updated),
        feedback: feedbackRecord,
      };
    }

    // Immediate deletion
    const finalResult = this.executeFinalDeletion(projectId, callerId, {
      reasonIds,
      feedbackRecord,
      isAdmin,
      explanation,
    });

    return {
      id: project.id,
      mode: 'immediate',
      deletedAt: finalResult.deletedAt,
      deletedBy: finalResult.deletedBy,
      closedRequestsCount: finalResult.closedRequestsCount,
      cancelledInvitesCount: finalResult.cancelledInvitesCount,
      releasedTasksCount: finalResult.releasedTasksCount,
      refundedSessionsCount: finalResult.refundedSessionsCount,
      project: finalResult.project,
      feedback: feedbackRecord,
    };
  }

  restoreProject(
    projectId: string,
    adminId: string,
  ): { restored: boolean; restoredAt: string; restoredBy: string; project: Project } {
    const project = this.projectsRepository.findById(projectId);
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found.`);
    }

    if (!project.deletedAt) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'PROJECT_NOT_DELETED',
        message: 'Project is not deleted.',
      });
    }

    const nowMs = (this.clockService ? this.clockService.now() : new Date()).getTime();
    const deletedMs = new Date(project.deletedAt).getTime();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    if (!Number.isNaN(deletedMs) && nowMs - deletedMs > thirtyDaysMs) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'RESTORE_WINDOW_PASSED',
        message: 'Projects can only be restored within 30 days of deletion.',
      });
    }

    const nowIso = new Date(nowMs).toISOString();
    const updated = this.projectsRepository.update(projectId, {
      deletedAt: undefined,
      deletedBy: undefined,
      restoredAt: nowIso,
      restoredBy: String(adminId),
    } as any)!;

    try {
      this.auditService.log({
        action: 'project-restored',
        actor: String(adminId),
        performedBy: String(adminId),
        target: project.title || project.id,
        entityType: 'project',
        entityId: project.id,
        event: `Admin ${adminId} restored soft-deleted project "${project.title || project.id}"`,
        details: { projectId: project.id, restoredAt: nowIso, restoredBy: String(adminId) },
      });
    } catch {}

    return {
      restored: true,
      restoredAt: nowIso,
      restoredBy: String(adminId),
      project: this.enrichProject(updated),
    };
  }
}
