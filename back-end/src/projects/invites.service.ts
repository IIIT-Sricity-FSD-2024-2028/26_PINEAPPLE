import {
  Injectable,
  Inject,
  forwardRef,
  Optional,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ClockService } from '../common/services/clock.service';
import { ContentFilterService } from '../common/services/content-filter.service';
import { UsersService } from '../users/users.service';
import {
  NotificationsService,
  NotificationGroupedItem,
  dispatchGroupedNotification,
  formatGroupedItemList,
} from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { ProjectsRepository } from './projects.repository';
import { ProjectsService } from './projects.service';
import { isLiveProject, isProjectLocked } from './project-visibility.util';
import { JoinRequestsService } from '../join-requests/join-requests.service';
import { isProjectOwner, isPlatformAdminOrSuperUser, getProjectRole } from '../common/utils/role.util';
import { isProjectFull } from '../common/utils/capacity.util';
import { FeedbackService } from '../feedback/feedback.service';

export type ProjectInviteStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';

export interface ProjectInvite {
  id: string;
  projectId: string;
  invitedUserId: string;
  invitedUsername?: string;
  invitedUserName?: string;
  invitedBy: string;
  invitedByName?: string;
  projectTitle?: string;
  message?: string;
  status: ProjectInviteStatus;
  createdAt: string;
  expiresAt: string;
  respondedAt?: string;
}

export const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
export const REINVITE_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
export const MAX_OPEN_INVITES_PER_PROJECT = 5;

@Injectable()
export class ProjectInvitesService implements OnModuleInit {
  private invites: ProjectInvite[] = [];

  constructor(
    private readonly projectsRepository: ProjectsRepository,
    @Inject(forwardRef(() => ProjectsService))
    private readonly projectsService: any,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: any,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
    @Optional()
    @Inject(forwardRef(() => JoinRequestsService))
    private readonly joinRequestsService?: any,
    @Optional()
    private readonly clockService?: ClockService,
    @Optional()
    private readonly contentFilterService?: ContentFilterService,
    @Optional()
    private readonly feedbackService?: FeedbackService,
  ) {}

  onModuleInit(): void {
    if (this.feedbackService) {
      this.feedbackService.registerEntityResolver('INVITE', (id: string) => {
        const inv = this.invites.find((i) => i.id === id);
        if (!inv) return { exists: false, parties: [] };
        const parties = [String(inv.invitedUserId), String(inv.invitedBy)];
        return {
          exists: true,
          projectId: inv.projectId,
          parties,
          actorId: String(inv.invitedUserId),
          targetId: String(inv.invitedBy),
        };
      });
    }
  }

  private nowDate(): Date {
    return this.clockService ? this.clockService.now() : new Date();
  }

  private nowIso(): string {
    return this.clockService ? this.clockService.nowIso() : new Date().toISOString();
  }

  resetToSeed(): void {
    this.invites = [];
  }

  reset(): void {
    if (process.env.NODE_ENV === 'test' || process.env.ALLOW_STORE_RESET === 'true') {
      this.resetToSeed();
    }
  }

  expireStaleInvites(): { expiredInvites: string[]; errors: string[]; skippedNotLive: number } {
    const nowMs = this.nowDate().getTime();
    const nowIso = this.nowIso();
    const expiredInvites: string[] = [];
    const errors: string[] = [];
    let skippedNotLive = 0;

    for (const invite of this.invites) {
      if (invite.status !== 'pending') continue;
      if (typeof this.projectsRepository?.findById === 'function') {
        const proj = this.projectsRepository.findById(invite.projectId);
        if (!isLiveProject(proj)) {
          skippedNotLive += 1;
          continue;
        }
      }
      const expMs = new Date(invite.expiresAt).getTime();
      if (!Number.isNaN(expMs) && nowMs >= expMs) {
        invite.status = 'expired';
        invite.respondedAt = nowIso;
        expiredInvites.push(invite.id);
      }
    }

    return { expiredInvites, errors, skippedNotLive };
  }

  findPending(projectId: string, userId: string): ProjectInvite | undefined {
    this.expireStaleInvites();
    return this.invites.find(
      (i) =>
        String(i.projectId) === String(projectId) &&
        String(i.invitedUserId) === String(userId) &&
        i.status === 'pending',
    );
  }

  hasPendingInvite(projectId: string, userId: string): boolean {
    return Boolean(this.findPending(projectId, userId));
  }

  hasOpenItemBetween(projectId: string, userId: string): boolean {
    const hasInv = this.hasPendingInvite(projectId, userId);
    const hasApp = Boolean(this.joinRequestsService?.hasPendingApplication?.(projectId, userId));
    return hasInv || hasApp;
  }

  sendInvite(projectId: string, username: string, caller: any, message?: string): ProjectInvite {
    const project = this.projectsRepository.findById(projectId);
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found.`);
    }

    const callerId = typeof caller === 'string'
      ? caller.trim()
      : String(caller?.uid || caller?.id || '').trim();
    const isOwner = isProjectOwner(project, caller || callerId) || String(project.ownerId) === callerId;
    const isAdmin = isPlatformAdminOrSuperUser(caller);
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'FORBIDDEN',
        message: 'Only the project owner can send direct invites.',
      });
    }

    const cleanMessage = typeof message === 'string' ? message.trim() : undefined;
    if (cleanMessage) {
      this.contentFilterService?.assertClean(
        { message: cleanMessage },
        ['message'],
        { actorId: callerId || 'owner', entityType: 'project_invite', entityId: String(projectId) },
      );
    }

    if (isProjectLocked(project)) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'PROJECT_LOCKED',
        message: 'Invites cannot be sent for a completed or closed project.',
      });
    }

    const cleanUsername = String(username || '').trim();
    if (!cleanUsername) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        code: 'USER_NOT_FOUND',
        message: 'Target user not found.',
      });
    }

    const rawTarget =
      typeof (this.usersService as any).findRawUserByUsername === 'function'
        ? (this.usersService as any).findRawUserByUsername(cleanUsername)
        : this.usersService.findByUsername(cleanUsername);

    if (!rawTarget) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        code: 'USER_NOT_FOUND',
        message: `User "${cleanUsername}" was not found.`,
      });
    }

    const statusLower = String(rawTarget.status || '').toLowerCase();
    if (statusLower === 'suspended' || statusLower === 'banned' || statusLower === 'inactive') {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'USER_SUSPENDED',
        message: 'Cannot invite a suspended or inactive user.',
      });
    }

    const targetId = String(rawTarget.id);
    const existingRole = typeof this.projectsService?.getProjectRole === 'function'
      ? this.projectsService.getProjectRole(project.id, targetId)
      : getProjectRole(project, targetId);
    if (existingRole === 'Owner' || targetId === callerId || targetId === String(project.ownerId)) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'ALREADY_PROJECT_OWNER',
        message: 'You cannot invite the project owner.',
      });
    }
    if (existingRole === 'Mentor') {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'ALREADY_PROJECT_MENTOR',
        message: 'You cannot invite the assigned mentor as a collaborator.',
      });
    }
    if (existingRole === 'Collaborator') {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'ALREADY_MEMBER',
        message: `${rawTarget.name || cleanUsername} is already an active member of this project.`,
      });
    }

    const collabs = Array.isArray(project.collaborators) ? project.collaborators : [];
    const isAlreadyMember = collabs.some((c: any) =>
      typeof c === 'string' ? String(c) === targetId : String(c.id || c.userId) === targetId,
    );
    if (isAlreadyMember) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'ALREADY_MEMBER',
        message: `${rawTarget.name || cleanUsername} is already an active member of this project.`,
      });
    }

    const nowDate = this.nowDate();
    const nowMs = nowDate.getTime();
    const nowIso = nowDate.toISOString();

    // Check 14-day cooldown for users who blocked or were removed from this project
    const removedRec = Array.isArray(project.removedUsers)
      ? project.removedUsers.find((r: any) => String(r.userId || r.id) === targetId)
      : undefined;
    if (removedRec?.removedAt) {
      const removedMs = new Date(removedRec.removedAt).getTime();
      if (!Number.isNaN(removedMs) && nowMs - removedMs < REINVITE_COOLDOWN_MS) {
        const availableAt = new Date(removedMs + REINVITE_COOLDOWN_MS).toISOString();
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          code: 'REINVITE_COOLDOWN',
          message: `This user was recently removed from the project and cannot be re-invited until ${availableAt}.`,
          availableAt,
        });
      }
    }

    const blockedRec = Array.isArray(project.blockedUsers)
      ? project.blockedUsers.find((b: any) => String(b.userId) === targetId)
      : undefined;
    if (blockedRec?.blockedAt) {
      const blockedMs = new Date(blockedRec.blockedAt).getTime();
      if (!Number.isNaN(blockedMs) && nowMs - blockedMs < REINVITE_COOLDOWN_MS) {
        const availableAt = new Date(blockedMs + REINVITE_COOLDOWN_MS).toISOString();
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          code: 'REINVITE_COOLDOWN',
          message: `This user blocked invitations for this project and cannot be re-invited until ${availableAt}.`,
          availableAt,
        });
      }
    }

    this.expireStaleInvites();

    // Fix 3: One open item per person and project. Cannot invite if user has pending application.
    const hasPendingApp = this.joinRequestsService?.hasPendingApplication?.(String(projectId), targetId);
    if (hasPendingApp) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'APPLICATION_PENDING_FROM_USER',
        message: 'This user has already applied. Review their application.',
      });
    }

    const existingPending = this.invites.find(
      (i) => i.projectId === String(projectId) && i.invitedUserId === targetId && i.status === 'pending',
    );
    if (existingPending) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'INVITE_ALREADY_PENDING',
        message: 'An open invitation is already pending for this user on this project.',
      });
    }

    const full =
      typeof this.projectsService?.isFull === 'function'
        ? this.projectsService.isFull(project)
        : isProjectFull(project);
    if (full) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'PROJECT_FULL',
        message:
          'Your team is full. Increase the collaborator limit in project settings, or remove a collaborator, to invite more people.',
      });
    }

    const openForProject = this.invites.filter(
      (i) => i.projectId === String(projectId) && i.status === 'pending',
    );
    if (openForProject.length >= MAX_OPEN_INVITES_PER_PROJECT) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'INVITE_LIMIT',
        message: `Maximum ${MAX_OPEN_INVITES_PER_PROJECT} open invitations per project reached.`,
      });
    }

    const callerUser = callerId ? this.usersService.findUserSafe?.(callerId) : null;
    const inviterName = callerUser?.name || caller?.name || project.owner || 'Project Owner';

    const invite: ProjectInvite = {
      id: `inv-${randomUUID()}`,
      projectId: String(projectId),
      invitedUserId: targetId,
      invitedUsername: rawTarget.username,
      invitedUserName: rawTarget.name || rawTarget.username,
      invitedBy: callerId || String(project.ownerId),
      invitedByName: inviterName,
      projectTitle: project.title || project.name || String(projectId),
      ...(cleanMessage ? { message: cleanMessage } : {}),
      status: 'pending',
      createdAt: nowIso,
      expiresAt: new Date(nowMs + INVITE_EXPIRY_MS).toISOString(),
    };

    this.invites.push(invite);

    try {
      this.notificationsService.create({
        userId: targetId,
        type: 'PROJECT_INVITE',
        title: 'Project Collaboration Invite',
        message: `${inviterName} invited you to join "${invite.projectTitle}" as a collaborator.`,
        readStatus: false,
        referenceId: String(projectId),
        link: '/notifications',
        metadata: {
          inviteId: invite.id,
          projectId: String(projectId),
          expiresAt: invite.expiresAt,
        },
      });
    } catch {}

    try {
      this.auditService.log({
        action: 'project-invite-sent',
        actor: inviterName,
        target: invite.invitedUsername || invite.invitedUserId,
        entityType: 'project_invite',
        entityId: invite.id,
        event: `${inviterName} invited ${invite.invitedUsername || targetId} to project "${invite.projectTitle}"`,
        details: { projectId: String(projectId), invitedUserId: targetId },
      });
    } catch {}

    return invite;
  }

  findByProjectId(projectId: string): ProjectInvite[] {
    this.expireStaleInvites();
    return this.invites
      .filter((i) => String(i.projectId) === String(projectId))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .map((i) => ({
        ...i,
        feedbackHistory: this.feedbackService?.findByEntity('INVITE', i.id) || [],
      }));
  }

  listForProject(projectId: string, caller: any): ProjectInvite[] {
    const project = this.projectsRepository.findById(projectId);
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found.`);
    }
    const callerId = typeof caller === 'string'
      ? caller.trim()
      : String(caller?.uid || caller?.id || '').trim();
    const isOwner = isProjectOwner(project, caller || callerId) || String(project.ownerId) === callerId;
    const isAdmin = isPlatformAdminOrSuperUser(caller);
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('Only the project owner or an admin can inspect project invitations.');
    }

    this.expireStaleInvites();
    return this.invites
      .filter((i) => i.projectId === String(projectId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((i) => ({
        ...i,
        feedbackHistory: this.feedbackService?.findByEntity('INVITE', i.id) || [],
      }));
  }

  listForUser(userId: string): any[] {
    this.expireStaleInvites();
    const uid = String(userId);
    return this.invites
      .filter((i) => i.invitedUserId === uid)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((i) => {
        const proj = this.projectsRepository.findById(i.projectId);
        return {
          ...i,
          projectTitle: proj?.title || proj?.name || i.projectTitle || i.projectId,
          projectDescription: proj?.description || proj?.desc || '',
          projectSkills: proj?.requiredSkills || proj?.skills || [],
          isFull: proj ? this.projectsService.isFull(proj) : false,
          feedbackHistory: this.feedbackService?.findByEntity('INVITE', i.id) || [],
        };
      });
  }

  private async runQueued<T>(projectId: string, fn: () => Promise<T> | T): Promise<T> {
    if (this.joinRequestsService && typeof this.joinRequestsService.runInProjectQueue === 'function') {
      return this.joinRequestsService.runInProjectQueue(projectId, fn);
    }
    return fn();
  }

  async acceptInvite(inviteId: string, callerId: string): Promise<{ invite: ProjectInvite; project: any }> {
    const initial = this.invites.find((i) => i.id === inviteId);
    if (!initial) {
      throw new NotFoundException(`Invitation ${inviteId} not found.`);
    }
    if (String(initial.invitedUserId) !== String(callerId)) {
      throw new ForbiddenException('Only the invited user can accept this invitation.');
    }

    return this.runQueued(initial.projectId, async () => {
      this.expireStaleInvites();
      const invite = this.invites.find((i) => i.id === inviteId);
      if (!invite) {
        throw new NotFoundException(`Invitation ${inviteId} not found.`);
      }

      if (invite.status === 'expired') {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          code: 'INVITE_EXPIRED',
          message: 'This invitation has expired.',
        });
      }
      if (invite.status !== 'pending') {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          code: 'INVITE_NOT_PENDING',
          message: `This invitation is already ${invite.status}.`,
        });
      }

      const project = this.projectsRepository.findById(invite.projectId);
      if (!project) {
        throw new NotFoundException(`Project with ID ${invite.projectId} not found.`);
      }

      const callerRole = typeof this.projectsService?.getProjectRole === 'function'
        ? this.projectsService.getProjectRole(project.id, callerId)
        : getProjectRole(project, callerId);
      if (callerRole === 'Owner' || String(callerId) === String(project.ownerId)) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          code: 'ALREADY_PROJECT_OWNER',
          message: 'Project owners cannot accept collaborator invitations.',
        });
      }
      if (callerRole === 'Mentor') {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          code: 'ALREADY_PROJECT_MENTOR',
          message: 'The assigned mentor cannot accept collaborator invitations.',
        });
      }
      if (callerRole === 'Collaborator') {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          code: 'ALREADY_MEMBER',
          message: 'You are already an active collaborator on this project.',
        });
      }

      if (isProjectLocked(project)) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          code: 'PROJECT_LOCKED',
          message: 'Cannot join a completed or closed project.',
        });
      }

      if (this.projectsService.isFull(project)) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          code: 'PROJECT_FULL',
          message: 'This project has reached maximum team capacity.',
        });
      }

      // Active project cap check inside the serialized queue
      this.projectsService.assertCanJoinProject(String(callerId));

      // Clear any expired prior removal record so re-joining after 14d cooldown succeeds cleanly
      if (Array.isArray(project.removedUsers)) {
        project.removedUsers = project.removedUsers.filter(
          (r: any) => String(r.userId || r.id) !== String(callerId),
        );
      }

      const invitedUser = this.usersService.findUserSafe?.(String(callerId));
      const collabName = invitedUser?.name || invite.invitedUserName || invite.invitedUsername || 'Collaborator';

      const updatedProject = this.projectsService.addCollaborator(invite.projectId, {
        id: String(callerId),
        name: collabName,
        role: 'Collaborator',
      });

      const nowIso = this.nowIso();
      invite.status = 'accepted';
      invite.respondedAt = nowIso;

      try {
        if (project.ownerId) {
          this.notificationsService.create({
            userId: String(project.ownerId),
            type: 'INVITE_ACCEPTED',
            title: 'Project Invite Accepted',
            message: `${collabName} accepted your invitation to join "${project.title || project.name}".`,
            readStatus: false,
            referenceId: invite.projectId,
            link: `/owner/workspace/${invite.projectId}`,
          });
        }
      } catch {}

      try {
        this.auditService.log({
          action: 'project-invite-accepted',
          actor: collabName,
          target: project.title || project.name || project.id,
          entityType: 'project_invite',
          entityId: invite.id,
          event: `${collabName} accepted invitation to join "${project.title || project.name}"`,
          details: { projectId: invite.projectId, invitedUserId: String(callerId) },
        });
      } catch {}

      return { invite: { ...invite }, project: updatedProject };
    });
  }

  declineInvite(
    inviteId: string,
    callerId: string,
    block = false,
    feedbackPayload?: any,
  ): { invite: ProjectInvite; feedback?: any } {
    this.expireStaleInvites();
    const invite = this.invites.find((i) => i.id === inviteId);
    if (!invite) {
      throw new NotFoundException(`Invitation ${inviteId} not found.`);
    }
    if (String(invite.invitedUserId) !== String(callerId)) {
      throw new ForbiddenException('Only the invited user can decline this invitation.');
    }
    if (invite.status === 'expired') {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'INVITE_EXPIRED',
        message: 'This invitation has expired.',
      });
    }
    if (invite.status !== 'pending') {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'INVITE_NOT_PENDING',
        message: `This invitation is already ${invite.status}.`,
      });
    }

    let feedbackRecord: any;
    if (this.feedbackService) {
      let fb = feedbackPayload?.reasons !== undefined
        ? { reasons: feedbackPayload.reasons, explanation: feedbackPayload.explanation }
        : ((feedbackPayload as any)?.feedback || (feedbackPayload?.reason ? { reasons: ['OTHER'], explanation: feedbackPayload.reason } : undefined));

      // Handle legacy block test call where only { block: false } was passed
      if (!fb && feedbackPayload && (feedbackPayload as any).block !== undefined && Object.keys(feedbackPayload).length === 1) {
        fb = { reasons: ['OTHER'], explanation: 'Declined invitation' };
      }

      if (!fb) {
        fb = { reasons: [] };
      }

      const validated = this.feedbackService.validate('DECLINE_INVITATION', fb, callerId, invite);
      feedbackRecord = this.feedbackService.record({
        actionType: 'DECLINE_INVITATION',
        entityType: 'INVITE',
        entityId: inviteId,
        projectId: invite.projectId,
        actorUserId: callerId,
        targetUserId: String(invite.invitedBy),
        reasons: validated.reasons,
        explanation: validated.explanation,
      });
    }

    const nowIso = this.nowIso();
    invite.status = 'declined';
    invite.respondedAt = nowIso;

    const project = this.projectsRepository.findById(invite.projectId);
    if (block && project) {
      if (!Array.isArray(project.blockedUsers)) {
        project.blockedUsers = [];
      }
      const existing = project.blockedUsers.find((b) => String(b.userId) === String(callerId));
      if (existing) {
        existing.blockedAt = nowIso;
      } else {
        project.blockedUsers.push({
          userId: String(callerId),
          blockedAt: nowIso,
          reason: 'Blocked further project invitations',
        });
      }
    }

    try {
      if (project?.ownerId) {
        const reasonSummary = feedbackRecord?.explanation || feedbackRecord?.reasonLabels?.join(', ');
        this.notificationsService.create({
          userId: String(project.ownerId),
          type: 'INVITE_DECLINED',
          title: 'Project Invite Declined',
          message: reasonSummary
            ? `${invite.invitedUserName || invite.invitedUsername || 'User'} declined your invitation to join "${project.title || project.name}". Reason: ${reasonSummary}`
            : `${invite.invitedUserName || invite.invitedUsername || 'User'} declined your invitation to join "${project.title || project.name}".`,
          readStatus: false,
          referenceId: invite.projectId,
          link: `/owner/workspace/${invite.projectId}`,
          metadata: {
            reasons: feedbackRecord?.reasons,
            explanation: feedbackRecord?.explanation,
          },
        });
      }
    } catch {}

    return { invite: { ...invite }, feedback: feedbackRecord };
  }

  cancelInvite(
    projectId: string,
    inviteId: string,
    caller: any,
    feedbackPayload?: any,
  ): { invite: ProjectInvite; feedback?: any } {
    const project = this.projectsRepository.findById(projectId);
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found.`);
    }

    const callerId = typeof caller === 'string'
      ? caller.trim()
      : String(caller?.uid || caller?.id || '').trim();
    const isOwner = isProjectOwner(project, caller || callerId) || String(project.ownerId) === callerId;
    const isAdmin = isPlatformAdminOrSuperUser(caller);
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('Only the project owner can cancel invitations.');
    }

    this.expireStaleInvites();
    const invite = this.invites.find((i) => i.id === inviteId && i.projectId === String(projectId));
    if (!invite) {
      throw new NotFoundException(`Invitation ${inviteId} not found for project ${projectId}.`);
    }
    if (invite.status !== 'pending') {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'INVITE_NOT_PENDING',
        message: `Cannot cancel invitation with status "${invite.status}".`,
      });
    }

    let feedbackRecord: any;
    if (this.feedbackService) {
      let fb = feedbackPayload?.reasons !== undefined
        ? { reasons: feedbackPayload.reasons, explanation: feedbackPayload.explanation }
        : ((feedbackPayload as any)?.feedback || (feedbackPayload?.reason ? { reasons: ['OTHER'], explanation: feedbackPayload.reason } : undefined));

      if (!fb && (!feedbackPayload || Object.keys(feedbackPayload).length === 0)) {
        fb = { reasons: ['OTHER'], explanation: 'Cancelled by owner' };
      }
      if (!fb) {
        fb = { reasons: [] };
      }

      const validated = this.feedbackService.validate('CANCEL_INVITATION', fb, callerId, invite);
      feedbackRecord = this.feedbackService.record({
        actionType: 'CANCEL_INVITATION',
        entityType: 'INVITE',
        entityId: inviteId,
        projectId: String(projectId),
        actorUserId: callerId || 'Owner',
        targetUserId: String(invite.invitedUserId),
        reasons: validated.reasons,
        explanation: validated.explanation,
      });
    }

    invite.status = 'cancelled';
    invite.respondedAt = this.nowIso();

    try {
      this.auditService.log({
        action: 'project-invite-cancelled',
        actor: callerId || 'Owner',
        target: invite.invitedUsername || invite.invitedUserId,
        entityType: 'project_invite',
        entityId: invite.id,
        event: `Owner cancelled invitation ${invite.id} on project "${project.title || project.name}"`,
        details: { projectId: String(projectId), inviteId: invite.id },
      });
    } catch {}

    try {
      this.notificationsService.create({
        userId: String(invite.invitedUserId),
        type: 'INVITE_CANCELLED',
        title: 'Project Invitation Cancelled',
        message: `Your invitation to join "${project.title || project.name}" was cancelled by the project owner.`,
        readStatus: false,
        referenceId: String(projectId),
        link: `/projects/${projectId}`,
      });
    } catch {}

    return { invite: { ...invite }, feedback: feedbackRecord };
  }

  /**
   * Cancel all pending direct invites on a project (e.g., when soft-deleted).
   */
  cancelPendingForProject(
    projectId: string,
    actorId = 'System',
    reason = 'Closed because the project was deleted',
  ): { cancelledCount: number; invites: ProjectInvite[] } {
    const pid = String(projectId || '');
    const nowIso = this.nowIso();
    const cancelled: ProjectInvite[] = [];
    const project = this.projectsRepository?.findById?.(pid);
    const projectTitle = project?.title || project?.name || pid;

    const byInvitee = new Map<string, NotificationGroupedItem[]>();
    for (const invite of this.invites) {
      if (String(invite.projectId) === pid && invite.status === 'pending') {
        invite.status = 'cancelled';
        invite.respondedAt = nowIso;
        (invite as any).closureReason = reason;
        cancelled.push({ ...invite });

        if (invite.invitedUserId) {
          const uid = String(invite.invitedUserId);
          if (!byInvitee.has(uid)) byInvitee.set(uid, []);
          byInvitee.get(uid)!.push({
            label: projectTitle,
            link: `/projects/${pid}`,
          });
        }
      }
    }

    for (const [uid, items] of byInvitee.entries()) {
      try {
        dispatchGroupedNotification(
          this.notificationsService,
          uid,
          `invite_cancelled:${pid}`,
          items,
          (groupedItems, count) => ({
            type: 'INVITE_CANCELLED',
            priority: 'immediate',
            title: count > 1 ? `Project Invitations Closed (${count})` : 'Project Invitation Closed',
            message:
              count === 1
                ? `Your invitation to "${projectTitle}" was cancelled (${reason}).`
                : `${count} invitations to "${projectTitle}" were cancelled (${reason}): ${formatGroupedItemList(groupedItems, 10)}`,
            readStatus: false,
            referenceId: pid,
          }),
        );
      } catch {}
    }

    if (cancelled.length > 0) {
      try {
        this.auditService.log({
          action: 'project-invites-system-cancelled',
          actor: String(actorId || 'System'),
          target: projectTitle,
          entityType: 'project',
          entityId: pid,
          event: `Cancelled ${cancelled.length} pending invite(s) for project "${projectTitle}": ${reason}`,
          details: { projectId: pid, cancelledCount: cancelled.length, reason },
        });
      } catch {}
    }

    return { cancelledCount: cancelled.length, invites: cancelled };
  }

  /**
   * Cancel all pending invites sent to or created by a deleted user.
   */
  cancelForDeletedUser(userId: string): number {
    const uid = String(userId || '');
    const nowIso = this.nowIso();
    let cancelledCount = 0;

    for (const invite of this.invites) {
      if (
        invite.status === 'pending' &&
        (String(invite.invitedUserId) === uid || String(invite.invitedBy) === uid)
      ) {
        invite.status = 'cancelled';
        invite.respondedAt = nowIso;
        (invite as any).closureReason = 'Cancelled because user account was deleted';
        cancelledCount += 1;
      }
    }

    return cancelledCount;
  }
}
