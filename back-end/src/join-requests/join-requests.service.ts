import { Injectable, BadRequestException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { BaseService } from '../common/abstracts/base.service';
import { JoinRequestEntity } from './entities/join-request.entity';
import { CreateJoinRequestDto } from './dto/create-join-request.dto';
import { UpdateJoinRequestDto } from './dto/update-join-request.dto';
import { ProjectsService } from '../projects/projects.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class JoinRequestsService extends BaseService<JoinRequestEntity> {
  constructor(
    @Inject(forwardRef(() => ProjectsService))
    private readonly projectsService: ProjectsService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {
    super();
  }

  create(createJoinRequestDto: CreateJoinRequestDto, requesterId?: string): JoinRequestEntity {
    if (!createJoinRequestDto.userId && requesterId) {
      createJoinRequestDto.userId = requesterId;
    }
    if (requesterId && createJoinRequestDto.userId && requesterId !== createJoinRequestDto.userId) {
      throw new ForbiddenException('You can only submit join requests for yourself.');
    }

    const project = this.projectsService.findById(createJoinRequestDto.projectId);
    if (this.projectsService.isLocked(project)) {
      throw new BadRequestException('Project is locked and no longer accepting applications.');
    }
    if (project.ownerId === createJoinRequestDto.userId) {
      throw new BadRequestException('Project owner cannot apply to their own project.');
    }

    if (Array.isArray(project.removedUsers)) {
      const removedRecord = project.removedUsers.find(
        (r) =>
          r.userId === createJoinRequestDto.userId ||
          (r.userName &&
            createJoinRequestDto.userName &&
            r.userName.toLowerCase() === createJoinRequestDto.userName.toLowerCase()),
      );
      if (removedRecord) {
        throw new BadRequestException(
          `You were removed from this project with reason: "${removedRecord.reason}". Re-applying is not permitted.`,
        );
      }
    }

    const existingCollabs = Array.isArray(project.collaborators) ? project.collaborators : [];
    const isAlreadyMember = existingCollabs.some((c: any) =>
      typeof c === 'string' ? c === createJoinRequestDto.userId : c.id === createJoinRequestDto.userId
    );
    if (isAlreadyMember) {
      throw new BadRequestException('User is already a collaborator on this project.');
    }

    const hasPending = this.items.some(
      (req) =>
        req.projectId === createJoinRequestDto.projectId &&
        req.userId === createJoinRequestDto.userId &&
        req.status === 'Pending',
    );
    if (hasPending) {
      throw new BadRequestException('A pending join request already exists for this project.');
    }

    const now = new Date();
    const joinRequest: JoinRequestEntity = {
      ...createJoinRequestDto,
      userName: createJoinRequestDto.userName || 'Collaborator',
      status: 'Pending',
      createdAt: now,
      updatedAt: now,
    } as any;
    const created = super.create(joinRequest);

    try {
      this.auditService.log({
        action: 'join-request-sent',
        actor: created.userName || 'Collaborator',
        target: `Project #${created.projectId}`,
        entityType: 'join_request',
        entityId: created.id,
        event: `${created.userName || 'User'} sent join request for project #${created.projectId}`,
        details: { role: created.role },
      });
    } catch { /* non-critical */ }

    try {
      const project = this.projectsService.findById(created.projectId);
      if (project && (project.ownerId || (project as any).owner)) {
        const ownerTarget = String(project.ownerId || (project as any).owner);
        this.notificationsService.create({
          userId: ownerTarget,
          type: 'JOIN_REQUEST',
          title: 'New Join Request',
          message: `${created.userName || 'A collaborator'} applied to join "${project.title || project.name || 'your project'}".`,
          readStatus: false,
          referenceId: created.projectId,
        });
      }
    } catch { /* non-critical */ }

    return created;
  }

  update(id: string, updateJoinRequestDto: UpdateJoinRequestDto): JoinRequestEntity {
    if ((updateJoinRequestDto.status as any) === 'Invited' || (updateJoinRequestDto.status as any) === 'Declined') {
      throw new BadRequestException("The 'Invited' and 'Declined' statuses are no longer supported. Joining is apply-only.");
    }

    const current = this.findOne(id);
    if (this.projectsService.isLocked(current.projectId)) {
      throw new BadRequestException('Project is locked. Join requests cannot be modified.');
    }
    const isApproval = (updateJoinRequestDto.status || '').toLowerCase() === 'approved';
    const wasApproved = (current.status || '').toLowerCase() === 'approved';
    if (isApproval && !wasApproved) {
      this.projectsService.addCollaborator(current.projectId, {
        id: current.userId,
        name: current.userName || 'Collaborator',
        role: current.role || 'Collaborator',
      });
    }

    const updated = super.update(id, {
      ...updateJoinRequestDto,
      updatedAt: new Date(),
    } as any);

    try {
      const isRejection = (updateJoinRequestDto.status || '').toLowerCase() === 'rejected';
      let projectName = 'the project';
      try {
        const p = this.projectsService.findById(current.projectId);
        if (p) projectName = p.title || p.name || 'the project';
      } catch { /* ignore */ }

      if (isApproval && !wasApproved) {
        this.auditService.log({
          action: 'join-request-approved',
          actor: 'Owner',
          target: current.userName || `User #${current.userId}`,
          entityType: 'join_request',
          entityId: id,
          event: `Join request for ${current.userName || 'User'} approved in project #${current.projectId}`,
          details: { status: 'Approved' },
        });

        this.notificationsService.create({
          userId: String(current.userId),
          type: 'APPLICATION_APPROVED',
          title: 'Application Approved',
          message: `Your application to join "${projectName}" was approved! Welcome to the team.`,
          readStatus: false,
          referenceId: current.projectId,
        });
      } else if (isRejection) {
        this.auditService.log({
          action: 'join-request-rejected',
          actor: 'Owner',
          target: current.userName || `User #${current.userId}`,
          entityType: 'join_request',
          entityId: id,
          event: `Join request for ${current.userName || 'User'} declined in project #${current.projectId}`,
          details: { status: 'Rejected' },
        });

        this.notificationsService.create({
          userId: String(current.userId),
          type: 'APPLICATION_REJECTED',
          title: 'Application Declined',
          message: `Your application to join "${projectName}" was declined.`,
          readStatus: false,
          referenceId: current.projectId,
        });
      }
    } catch { /* non-critical */ }

    return updated;
  }

  findByProject(projectId: string): JoinRequestEntity[] {
    return this.items.filter((request: JoinRequestEntity) => request.projectId === projectId);
  }

  findByUser(userId: string): JoinRequestEntity[] {
    return this.items.filter((request: JoinRequestEntity) => request.userId === userId);
  }

  findByStatus(status: string): JoinRequestEntity[] {
    return this.items.filter(
      (request: JoinRequestEntity) => String(request.status).toLowerCase() === String(status).toLowerCase(),
    );
  }

  approveRequest(id: string): JoinRequestEntity {
    return this.update(id, { status: 'Approved' });
  }

  rejectRequest(id: string): JoinRequestEntity {
    return this.update(id, { status: 'Rejected' });
  }

  completeApprovedRequests(projectId: string): void {
    const approved = this.items.filter(
      (r) => r.projectId === projectId && String(r.status || '').toLowerCase() === 'approved',
    );
    for (const req of approved) {
      req.status = 'Completed';
      req.updatedAt = new Date();
    }
  }

  markUserRemoved(projectId: string, userId: string, reason: string): void {
    const userReqs = this.items.filter(
      (r) => r.projectId === projectId && (r.userId === userId || r.userName === userId),
    );
    for (const req of userReqs) {
      req.status = 'Removed';
      (req as any).removalReason = reason;
      req.updatedAt = new Date();
    }
  }

  markUserLeft(projectId: string, userId: string): void {
    const userReqs = this.items.filter(
      (r) => r.projectId === projectId && (r.userId === userId || r.userName === userId),
    );
    for (const req of userReqs) {
      req.status = 'Left';
      req.updatedAt = new Date();
    }
  }

  override remove(id: string): void {
    const current = this.findOne(id);
    if (this.projectsService.isLocked(current.projectId)) {
      throw new BadRequestException('Project is locked. Join requests cannot be withdrawn.');
    }
    super.remove(id);
  }
}