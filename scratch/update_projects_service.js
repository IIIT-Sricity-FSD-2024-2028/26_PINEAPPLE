const fs = require('fs');
const file = 'back-end/src/projects/projects.service.ts';
let content = fs.readFileSync(file, 'utf8');

// 1. Add Optional to @nestjs/common import if not present
if (!content.includes('Optional,')) {
  content = content.replace("Injectable,", "Injectable,\n  Optional,");
}

// 2. Add ClockService import
if (!content.includes("from '../common/services/clock.service'")) {
  content = content.replace(
    "import { isProjectOwner, isPlatformAdminOrSuperUser } from '../common/utils/role.util';",
    "import { isProjectOwner, isPlatformAdminOrSuperUser } from '../common/utils/role.util';\nimport { ClockService } from '../common/services/clock.service';"
  );
}

// 3. Add clockService to constructor
if (!content.includes('clockService?: ClockService')) {
  const ctorTarget = "@Inject(forwardRef(() => UsersService))\n    private readonly usersService: UsersService,";
  const ctorReplacement = ctorTarget + "\n    @Optional()\n    private readonly clockService?: ClockService,";
  if (!content.includes(ctorTarget)) {
    // Check with \r\n
    const ctorTargetCRLF = "@Inject(forwardRef(() => UsersService))\r\n    private readonly usersService: UsersService,";
    content = content.replace(ctorTargetCRLF, ctorTargetCRLF + "\r\n    @Optional()\r\n    private readonly clockService?: ClockService,");
  } else {
    content = content.replace(ctorTarget, ctorReplacement);
  }
}

// 4. Add methods before final }
const methods = `
  closeProject(projectId: string, reason: string): Project {
    const project = this.findById(projectId);
    if (!project) {
      throw new NotFoundException(\`Project with ID \${projectId} not found.\`);
    }

    const nowIso = this.clockService ? this.clockService.nowIso() : new Date().toISOString();
    project.status = ProjectStatus.Closed;
    project.closureReason = reason;
    project.closedAt = nowIso;

    this.projectsRepository.update(project.id, {
      status: ProjectStatus.Closed,
      closureReason: reason,
      closedAt: nowIso,
    } as any);

    // Close pending join requests without counting against applicants
    try {
      this.joinRequestsService.closePendingRequestsForProject(project.id, \`Project closed: \${reason}\`);
    } catch (err: any) {
      this.logger.warn(\`Failed to close join requests on project closure: \${err?.message}\`);
    }

    // Handle mentor session if any: active session is paid out to mentor, pending is refunded
    try {
      this.mentorMarketplaceService.handleProjectClosed(project.id, reason);
    } catch (err: any) {
      this.logger.warn(\`Failed to handle mentor session on project closure: \${err?.message}\`);
    }

    // Notify all collaborators
    const collaborators = Array.isArray(project.collaborators) ? project.collaborators : [];
    for (const c of collaborators) {
      const collabId = typeof c === 'string' ? c : (c.id || c.userId);
      if (collabId && String(collabId) !== String(project.ownerId)) {
        try {
          this.notificationsService.create({
            userId: String(collabId),
            type: 'PROJECT_CLOSED',
            title: 'Project Closed',
            message: \`Project "\${project.title || project.name}" was closed. Reason: \${reason}\`,
            readStatus: false,
            referenceId: project.id,
          });
        } catch (err: any) {
          console.warn('[projects.service] Suppressed notification error:', err?.message || err);
        }
      }
    }

    // Notify mentor if present
    if (project.mentorId) {
      try {
        this.notificationsService.create({
          userId: String(project.mentorId),
          type: 'PROJECT_CLOSED',
          title: 'Project Closed',
          message: \`Project "\${project.title || project.name}" was closed. Reason: \${reason}\`,
          readStatus: false,
          referenceId: project.id,
        });
      } catch (err: any) {
        console.warn('[projects.service] Suppressed notification error:', err?.message || err);
      }
    }

    // Audit log
    try {
      this.auditService.log({
        action: 'project-closed',
        actor: 'System',
        target: project.title || project.name || 'Project',
        entityType: 'project',
        entityId: project.id,
        event: \`Project "\${project.title || project.name}" closed: \${reason}\`,
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
    for (const p of ownedProjects) {
      if (String(p.status || '').toLowerCase() !== 'closed') {
        const closedProj = this.closeProject(p.id, 'Owner suspended');
        closed.push(closedProj);
      }
    }
    return closed;
  }
`;

const lastBraceIdx = content.lastIndexOf('}');
content = content.slice(0, lastBraceIdx) + methods + '\n}\n';

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully updated projects.service.ts');
