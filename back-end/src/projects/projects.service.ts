import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ProjectsRepository, Project } from './projects.repository';
import { CreateProjectDto, ProjectStatus } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { TasksService } from '../tasks/tasks.service';
import { TaskStatus } from '../tasks/dto/create-task.dto';
import { JoinRequestsService } from '../join-requests/join-requests.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MentorMarketplaceService } from '../mentor-marketplace/mentor-marketplace.service';
import { calculateProjectProgress } from '../common/utils/progress.util';
import { AuditService } from '../audit/audit.service';
import { PlatformConfigService } from '../platform-config/platform-config.service';
import { UsersService } from '../users/users.service';

export function isProjectLocked(project?: Partial<Project> | null): boolean {
  if (!project) return false;
  if (project.isCompleted === true) return true;
  if (typeof project.status === 'string' && project.status.toLowerCase() === 'completed') return true;
  return false;
}

export function isProjectActive(project?: Partial<Project> | null): boolean {
  if (!project) return false;
  if (isProjectLocked(project)) return false;
  const status = typeof project.status === 'string' ? project.status.toLowerCase().trim() : '';
  return status !== 'completed' && status !== 'cancelled' && status !== 'archived';
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly projectsRepository: ProjectsRepository,
    @Inject(forwardRef(() => TasksService))
    private readonly tasksService: TasksService,
    @Inject(forwardRef(() => JoinRequestsService))
    private readonly joinRequestsService: JoinRequestsService,
    private readonly notificationsService: NotificationsService,
    private readonly mentorMarketplaceService: MentorMarketplaceService,
    private readonly auditService: AuditService,
    private readonly platformConfigService: PlatformConfigService,
    private readonly usersService: UsersService,
  ) {}

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
      } catch {
        /* ignore */
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

    const collabs = Array.isArray(project.collaborators) ? project.collaborators : [];
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
    const rawOwner = project.owner;
    let ownerName = typeof rawOwner === 'object' && rawOwner !== null ? ((rawOwner as any).name || 'Owner') : (rawOwner || '');
    if (!ownerName || /^\d+$/.test(String(ownerName))) {
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
              const mentorInfo = this.mentorMarketplaceService.getMentor(activeSession.mentorId);
              if (mentorInfo?.profile?.name) {
                project.mentor = mentorInfo.profile.name;
              } else {
                const u = this.usersService.findUserSafe(activeSession.mentorId);
                if (u) project.mentor = u.name;
              }
            } catch {
              const u = this.usersService.findUserSafe(activeSession.mentorId);
              if (u) project.mentor = u.name;
            }
          }
        }
      } catch {
        /* non-critical */
      }
    }

    const mentorName = typeof project.mentor === 'object' && project.mentor !== null
      ? (project.mentor.name || project.mentor.title || 'Mentor')
      : (project.mentor || (project.mentorId ? 'Mentor' : ''));
    if (mentorName && typeof project.mentor !== 'string') {
      project.mentor = mentorName;
    }

    project.members = [
      {
        id: String(project.ownerId || '1'),
        name: ownerName,
        role: 'Owner' as any,
        initials: this.getInitials(ownerName),
      },
      ...collabs.map((c: any) => {
        if (typeof c === 'string') {
          return {
            id: c,
            name: c,
            role: 'Collaborator' as any,
            initials: this.getInitials(c),
          };
        }
        return {
          id: String(c.id || c.userId || 'collab'),
          name: c.name || 'Collaborator',
          role: 'Collaborator' as any,
          initials: this.getInitials(c.name || 'Collaborator'),
        };
      }),
    ];

    if (project.mentorId || (mentorName && mentorName !== 'None assigned yet')) {
      let resolvedMentorName = mentorName;
      if (!resolvedMentorName || resolvedMentorName === 'Mentor') {
        try {
          const u = this.usersService.findUserSafe(project.mentorId!);
          if (u) resolvedMentorName = u.name;
        } catch {
          /* ignore */
        }
      }
      resolvedMentorName = resolvedMentorName || 'Mentor';
      project.mentor = resolvedMentorName;

      const mId = String(project.mentorId || (typeof project.mentor === 'object' ? (project.mentor.id || project.mentor.userId) : '') || 'mentor');
      project.members.push({
        id: mId,
        name: resolvedMentorName,
        role: 'Mentor' as any,
        initials: this.getInitials(resolvedMentorName),
      });
    }

    (project as any).memberCount = project.members.length;

    if (project.finalLink && !project.finalProjectUrl) {
      project.finalProjectUrl = project.finalLink;
    }
    if (project.finalProjectUrl && !project.finalLink) {
      project.finalLink = project.finalProjectUrl;
    }

    return project;
  }

  findAll(statusFilter?: string, isCompletedFilter?: string): Project[] {
    let all = this.projectsRepository.findAll().map((p) => this.enrichProject(p));
    const isCompletedRequested =
      (isCompletedFilter !== undefined && (isCompletedFilter === 'true' || isCompletedFilter === '1')) ||
      (statusFilter !== undefined && statusFilter.toLowerCase() === 'completed');

    if (isCompletedRequested) {
      return all
        .filter((p) => this.isLocked(p) || p.isCompleted === true)
        .sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime());
    }

    if (statusFilter && statusFilter.toLowerCase() !== 'all') {
      const lowerStatus = statusFilter.toLowerCase();
      all = all.filter((p) => String(p.status).toLowerCase() === lowerStatus);
    }

    return all;
  }

  findById(id: string): Project {
    const project = this.projectsRepository.findById(id);
    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found.`);
    }
    return this.enrichProject(project);
  }

  findByOwnerId(ownerId: string): Project[] {
    return this.projectsRepository.findByOwnerId(ownerId).map((p) => this.enrichProject(p));
  }

  create(ownerId: string, createProjectDto: CreateProjectDto): Project {
    const config = this.platformConfigService.getConfig();
    const activeProjects = this.findByOwnerId(ownerId).filter(
      (p) => !p.isCompleted && String(p.status || '').toLowerCase() !== 'completed' && String(p.status || '').toLowerCase() !== 'cancelled',
    );
    if (activeProjects.length >= config.maxProjectsPerUser) {
      throw new BadRequestException(
        `Project quota reached. Maximum allowed active projects per user: ${config.maxProjectsPerUser}.`,
      );
    }

    // Business Rule: A newly created project MUST always default to the 'Open' status
    console.log("Creating new project for user " + ownerId);
    const proj = this.projectsRepository.create(ownerId, createProjectDto, ProjectStatus.Open);
    try {
      this.auditService.log({
        action: 'project-created',
        actor: proj.owner || `User #${ownerId}`,
        target: proj.title || proj.name || 'Project',
        entityType: 'project',
        entityId: proj.id,
        event: `${proj.owner || `User #${ownerId}`} created project "${proj.title || proj.name}"`,
        details: { difficulty: proj.difficulty, duration: proj.duration },
      });
    } catch { /* non-critical */ }
    return this.enrichProject(proj);
  }

  completeProject(id: string, callerId?: string, finalLink?: string): Project {
    const project = this.findById(id);

    // Rule 4: Refuse publishing final link a second time (project is already locked/completed)
    if (this.isLocked(project)) {
      throw new BadRequestException('Project is already completed and locked. Final link cannot be published a second time.');
    }

    // Guard 1: Caller is the owner
    const isOwner =
      callerId &&
      (project.ownerId === callerId ||
        project.owner === callerId ||
        (project.owner && project.owner.toLowerCase() === callerId.toLowerCase()));
    if (!isOwner) {
      throw new ForbiddenException('Only the project owner can complete the project.');
    }

    // Guard 2: The link is a valid URL
    const trimmedLink = (finalLink || '').trim();
    if (!trimmedLink) {
      throw new BadRequestException('A final project URL is required.');
    }
    try {
      const parsed = new URL(trimmedLink);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error();
      }
    } catch {
      throw new BadRequestException('The final link must be a valid URL starting with http:// or https://');
    }

    // Guard 3: Every task is approved
    const tasks = this.tasksService.findAllByProjectId(id);
    const allTasksApproved = tasks.every(
      (t) =>
        t.status === TaskStatus.Completed ||
        (typeof t.status === 'string' && t.status.toLowerCase() === 'completed'),
    );
    if (!allTasksApproved) {
      throw new BadRequestException('All project tasks must be approved before completing the project.');
    }

    // 1. Set the completed fields
    const completedAt = new Date().toISOString();
    const updatedProject = this.projectsRepository.update(id, {
      status: ProjectStatus.Completed,
      progress: 100,
      isCompleted: true,
      completedAt,
      finalLink: trimmedLink,
      finishedLink: trimmedLink,
      finalProjectUrl: trimmedLink,
      projectLink: trimmedLink,
    });

    if (!updatedProject) {
      throw new NotFoundException(`Project with ID ${id} not found.`);
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
    } catch { /* non-critical */ }

    return updatedProject;
  }

  update(id: string, updateProjectDto: UpdateProjectDto, callerId?: string): Project {
    const existingProject = this.findById(id);
    if (this.isLocked(existingProject)) {
      throw new BadRequestException('Project is locked and cannot be modified.');
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

    const updatedProject = this.projectsRepository.update(id, updateProjectDto);
    if (!updatedProject) {
      throw new NotFoundException(`Project with ID ${id} not found.`);
    }
    return updatedProject;
  }

  addCollaborator(projectId: string, collaborator: { id: string; name: string; role: string }): Project {
    const project = this.findById(projectId);
    if (this.isLocked(project)) {
      throw new BadRequestException('Project is locked and cannot accept new collaborators.');
    }
    const config = this.platformConfigService.getConfig();
    const collabs = Array.isArray(project.collaborators) ? project.collaborators : [];
    if (collabs.length >= config.maxCollaboratorsPerProject) {
      throw new BadRequestException(
        `Project collaborator capacity reached (max ${config.maxCollaboratorsPerProject}).`,
      );
    }
    const updatedProject = this.projectsRepository.addCollaborator(projectId, collaborator);
    if (!updatedProject) {
      throw new NotFoundException(`Project with ID ${projectId} not found.`);
    }
    return updatedProject;
  }

  removeMember(projectId: string, memberId: string, reason: string, callerId?: string, callerRole?: string): Project {
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

    const isAdmin = callerRole && callerRole.toLowerCase() === 'administrator';
    const isOwner =
      callerId &&
      (project.ownerId === callerId ||
        String(project.ownerId) === String(callerId) ||
        project.owner === callerId ||
        (project.owner && project.owner.toLowerCase() === callerId.toLowerCase()));
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('Only the project owner can remove team members.');
    }

    const trimmedReason = (reason || '').trim();
    if (trimmedReason.length < 10) {
      throw new BadRequestException('A removal reason of at least 10 characters is required.');
    }

    // Remove from collaborators
    const collabs = Array.isArray(project.collaborators) ? project.collaborators : [];
    let memberName = memberId;
    project.collaborators = collabs.filter((c: any) => {
      const isMatch =
        (typeof c === 'string' && (c === memberId || c.toLowerCase() === memberId.toLowerCase())) ||
        (typeof c === 'object' &&
          (c.id === memberId ||
            c.userId === memberId ||
            (c.name && c.name.toLowerCase() === memberId.toLowerCase())));
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
      project.removedUsers.push({
        userId: memberId,
        userName: memberName,
        reason: trimmedReason,
        removedAt: new Date().toISOString(),
      });
    }

    // Reset unapproved tasks to Unassigned and Open
    try {
      this.tasksService.resetUnapprovedTasksForUser(projectId, memberId);
      if (memberName !== memberId) {
        this.tasksService.resetUnapprovedTasksForUser(projectId, memberName);
      }
    } catch (err) {
      console.error('Failed to reset tasks for removed user:', err);
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
    } catch {
      /* non-critical */
    }

    try {
      this.auditService.log({
        action: 'member-removed',
        actor: callerId || 'Owner',
        target: memberName,
        entityType: 'project',
        entityId: projectId,
        event: `Collaborator (${memberName}) was removed from project "${project.title || project.name}"`,
        details: { reason: trimmedReason },
      });
    } catch { /* non-critical */ }

    return project;
  }

  leaveProject(projectId: string, userId: string): Project {
    const project = this.findById(projectId);
    if (this.isLocked(project)) {
      throw new BadRequestException('Project is locked. Members cannot leave a completed project.');
    }

    const isOwner =
      project.ownerId === userId ||
      project.owner === userId ||
      (project.owner && project.owner.toLowerCase() === userId.toLowerCase());
    if (isOwner) {
      throw new BadRequestException('Project owner cannot leave their own project.');
    }

    // Business Rule: A mentor cannot leave or be removed once a project has started.
    const isMentor =
      (project.mentorId && (project.mentorId === userId || String(project.mentorId) === String(userId))) ||
      (project.mentor && (project.mentor === userId || (typeof project.mentor === 'string' && project.mentor.toLowerCase() === userId.toLowerCase()))) ||
      (typeof project.mentor === 'object' && project.mentor !== null &&
        ((project.mentor as any).id === userId || (project.mentor as any).userId === userId ||
         ((project.mentor as any).name && (project.mentor as any).name.toLowerCase() === userId.toLowerCase())));
    if (isMentor) {
      throw new ForbiddenException('A mentor cannot leave or be removed once a project has started.');
    }

    // 1. If collaborator, remove from collaborators
    const collabs = Array.isArray(project.collaborators) ? project.collaborators : [];
    let memberName = userId;
    project.collaborators = collabs.filter((c: any) => {
      const isMatch =
        (typeof c === 'string' && (c === userId || c.toLowerCase() === userId.toLowerCase())) ||
        (typeof c === 'object' &&
          (c.id === userId ||
            c.userId === userId ||
            (c.name && c.name.toLowerCase() === userId.toLowerCase())));
      if (isMatch && typeof c === 'object' && c.name) {
        memberName = c.name;
      }
      return !isMatch;
    });

    // Reset unapproved tasks to Unassigned and Open
    try {
      this.tasksService.resetUnapprovedTasksForUser(projectId, userId);
      if (memberName !== userId) {
        this.tasksService.resetUnapprovedTasksForUser(projectId, memberName);
      }
    } catch (err) {
      console.error('Failed to reset tasks for leaving user:', err);
    }

    // Mark join requests as Left
    try {
      this.joinRequestsService.markUserLeft(projectId, userId);
    } catch (err) {
      console.error('Failed to update join request for leaving user:', err);
    }

    // Notify project owner
    try {
      if (project.ownerId) {
        this.notificationsService.create({
          userId: project.ownerId,
          type: 'PROJECT_UPDATE',
          title: 'Collaborator Left Project',
          message: `Collaborator (${memberName}) left project "${project.title || project.name}".`,
          readStatus: false,
          referenceId: projectId,
        });
      }
    } catch {
      /* non-critical */
    }

    try {
      this.auditService.log({
        action: 'member-left',
        actor: memberName,
        target: project.title || project.name || 'Project',
        entityType: 'project',
        entityId: projectId,
        event: `Collaborator (${memberName}) left project "${project.title || project.name}"`,
      });
    } catch { /* non-critical */ }

    return project;
  }

  delete(id: string): void {
    const project = this.findById(id);
    if (this.isLocked(project)) {
      throw new BadRequestException('Project is locked and cannot be deleted.');
    }

    // Business Rule: If a project is deleted, mentor escrow must be refunded/settled cleanly and notify the mentor.
    try {
      this.mentorMarketplaceService.refundEscrowForProject(id);
    } catch (err) {
      console.error('Failed to refund mentor escrow on project delete:', err);
    }

    const isDeleted = this.projectsRepository.delete(id);
    if (!isDeleted) {
      throw new NotFoundException(`Project with ID ${id} not found.`);
    }

    try {
      this.auditService.log({
        action: 'project-deleted',
        actor: 'Admin',
        target: project.title || project.name || `Project #${id}`,
        entityType: 'project',
        entityId: id,
        event: `Project "${project.title || project.name}" was permanently deleted`,
      });
    } catch { /* non-critical */ }
  }
}
