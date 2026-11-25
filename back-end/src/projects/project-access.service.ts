import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ProjectsRepository } from './projects.repository';
import { AuditService } from '../audit/audit.service';
import {
  getProjectRole,
  isPlatformAdminOrSuperUser,
  isProjectMember,
  isProjectOwner,
} from '../common/utils/role.util';

export interface ProjectAccessContext {
  taskId?: string;
  action?: string;
}

/**
 * Reusable project membership & ownership guard helper (Phase 20).
 * Reuses the canonical role helpers from common/utils/role.util.ts.
 */
@Injectable()
export class ProjectAccessService {
  constructor(
    private readonly projectsRepository: ProjectsRepository,
    @Optional() @Inject(AuditService) private readonly auditService?: AuditService,
    @Optional() private readonly moduleRef?: ModuleRef,
  ) {}

  private getAuditService(): AuditService | undefined {
    if (this.auditService) return this.auditService;
    try {
      return this.moduleRef?.get(AuditService, { strict: false });
    } catch {
      return undefined;
    }
  }

  private normalizeCaller(callerOrId: any, role?: string) {
    if (callerOrId && typeof callerOrId === 'object') {
      return callerOrId;
    }
    return {
      uid: callerOrId ? String(callerOrId) : undefined,
      id: callerOrId ? String(callerOrId) : undefined,
      role,
    };
  }

  private getCallerId(caller: any): string {
    return String(caller?.uid || caller?.id || '').trim();
  }

  private findProjectOrThrow(projectId: string) {
    const project = this.projectsRepository.findById(String(projectId || ''));
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found.`);
    }
    return project;
  }

  isAdminOrSuperUser(callerOrId: any, role?: string): boolean {
    const caller = this.normalizeCaller(callerOrId, role);
    return isPlatformAdminOrSuperUser(caller);
  }

  isOwner(callerOrId: any, projectId: string, role?: string): boolean {
    const caller = this.normalizeCaller(callerOrId, role);
    const project = this.projectsRepository.findById(String(projectId || ''));
    if (!project) return false;
    return isProjectOwner(project, caller);
  }

  isMember(callerOrId: any, projectId: string, role?: string): boolean {
    const caller = this.normalizeCaller(callerOrId, role);
    const project = this.projectsRepository.findById(String(projectId || ''));
    if (!project) return false;
    return isProjectMember(project, caller);
  }

  getMemberRole(callerOrId: any, projectId: string, role?: string) {
    const caller = this.normalizeCaller(callerOrId, role);
    const project = this.projectsRepository.findById(String(projectId || ''));
    if (!project) return null;
    return getProjectRole(project, caller);
  }

  private logDeniedTaskAccess(
    caller: any,
    projectId: string,
    context?: ProjectAccessContext,
    reason?: string,
  ): void {
    try {
      const userId = this.getCallerId(caller) || 'anonymous';
      this.getAuditService()?.log({
        action: 'ACCESS_DENIED_TASK',
        actor: userId,
        target: context?.taskId ? `Task #${context.taskId}` : `Project #${projectId}`,
        entityType: 'task',
        entityId: context?.taskId || String(projectId),
        performedBy: userId,
        event: `Unauthorized task access blocked (${reason || 'not_a_project_member'})`,
        details: {
          userId,
          taskId: context?.taskId,
          projectId: String(projectId),
          action: context?.action,
          reason,
        },
      });
    } catch {
      // Non-critical audit write
    }
  }

  /**
   * Requires caller to be an active member of the project (owner, collaborator, or mentor)
   * OR a platform Admin / Super User. Outsiders / removed members get 403 NOT_A_PROJECT_MEMBER.
   */
  assertMemberOrOwner(
    callerOrId: any,
    projectId: string,
    context?: ProjectAccessContext,
    role?: string,
  ) {
    const caller = this.normalizeCaller(callerOrId, role);
    const project = this.findProjectOrThrow(projectId);

    if (this.isAdminOrSuperUser(caller)) {
      return project;
    }

    if (!isProjectMember(project, caller)) {
      this.logDeniedTaskAccess(caller, projectId, context, 'NOT_A_PROJECT_MEMBER');
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'NOT_A_PROJECT_MEMBER',
        message: 'You are not a member of this project.',
      });
    }

    return project;
  }

  /**
   * Requires caller to be the project owner OR a platform Admin / Super User.
   * Non-members receive 403 NOT_A_PROJECT_MEMBER; non-owner members receive 403 FORBIDDEN.
   */
  assertOwnerOrAdmin(
    callerOrId: any,
    projectId: string,
    context?: ProjectAccessContext,
    role?: string,
  ) {
    const caller = this.normalizeCaller(callerOrId, role);
    const project = this.findProjectOrThrow(projectId);

    if (this.isAdminOrSuperUser(caller) || isProjectOwner(project, caller)) {
      return project;
    }

    if (!isProjectMember(project, caller)) {
      this.logDeniedTaskAccess(caller, projectId, context, 'NOT_A_PROJECT_MEMBER');
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'NOT_A_PROJECT_MEMBER',
        message: 'You are not a member of this project.',
      });
    }

    this.logDeniedTaskAccess(caller, projectId, context, 'OWNER_OR_ADMIN_REQUIRED');
    throw new ForbiddenException({
      statusCode: 403,
      error: 'Forbidden',
      code: 'FORBIDDEN',
      message: 'Only the project owner or administrators can perform this task action.',
    });
  }
}
