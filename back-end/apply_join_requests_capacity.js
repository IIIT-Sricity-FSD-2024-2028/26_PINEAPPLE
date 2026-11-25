const fs = require('fs');
const path = require('path');

const servicePath = path.resolve(__dirname, 'src/join-requests/join-requests.service.ts');
let content = fs.readFileSync(servicePath, 'utf8');

// Ensure ConflictException is imported
if (!content.includes('ConflictException')) {
  content = content.replace(
    'ForbiddenException,',
    'ForbiddenException, ConflictException,'
  );
}

// 1. In create(): Add isFull check right after isLocked
const lockCheckPattern = /if\s*\(this\.projectsService\.isLocked\(project\)\)\s*\{[^}]*\}/;
const m = content.match(lockCheckPattern);
if (m && !content.includes('this.projectsService.isFull(project)')) {
  const replacement = `${m[0]}\n    if (this.projectsService.isFull(project)) {\n      throw new ConflictException('This project is full.');\n    }`;
  content = content.replace(m[0], replacement);
  console.log('Added isFull check to create()');
}

// 2. In update(): Add isFull check before addCollaborator, and auto-reject remaining pending requests when full
const updateApprovalPattern = /if\s*\(isApproval\s*&&\s*!wasApproved\)\s*\{[\s\S]*?this\.projectsService\.addCollaborator\([^)]*\);\s*\}/;
const mUpdate = content.match(updateApprovalPattern);
if (mUpdate) {
  const replacementUpdate = `if (isApproval && !wasApproved) {
      const project = this.projectsService.findById(current.projectId);
      if (this.projectsService.isFull(project)) {
        throw new ConflictException('This project is full.');
      }
      this.projectsService.addCollaborator(current.projectId, {
        id: current.userId,
        name: current.userName || 'Collaborator',
        role: current.role || 'Collaborator',
      });

      // When the last slot is filled, auto-reject remaining pending requests with reason 'Project is full'
      const updatedProject = this.projectsService.findById(current.projectId);
      if (this.projectsService.isFull(updatedProject)) {
        const otherPending = this.items.filter(
          (r) => r.projectId === current.projectId && r.id !== id && String(r.status).toLowerCase() === 'pending'
        );
        for (const req of otherPending) {
          super.update(req.id, {
            status: 'Rejected',
            reason: 'Project is full',
            updatedAt: new Date(),
          } as any);

          try {
            this.notificationsService.create({
              userId: String(req.userId),
              type: 'APPLICATION_REJECTED',
              title: 'Project Closed',
              message: \`Your application to join "\${project.title || project.name || 'the project'}" was closed because the project is full.\`,
              readStatus: false,
              referenceId: current.projectId,
            });
          } catch { /* ignore */ }
        }
      }
    }`;
  content = content.replace(mUpdate[0], replacementUpdate);
  console.log('Added isFull check and auto-reject to update()');
}

fs.writeFileSync(servicePath, content, 'utf8');
console.log('join-requests.service.ts updated successfully.');
