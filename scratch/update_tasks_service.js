const fs = require('fs');
const file = 'back-end/src/tasks/tasks.service.ts';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('Logger,')) {
  content = content.replace('Injectable,', 'Injectable,\n  Logger,');
}

if (!content.includes('private readonly logger = new Logger')) {
  content = content.replace(
    'export class TasksService implements OnApplicationBootstrap {',
    'export class TasksService implements OnApplicationBootstrap {\n  private readonly logger = new Logger(TasksService.name);'
  );
}

const method = `
  releaseCollaboratorTasks(userId: string): { releasedTasks: Task[]; affectedProjectIds: string[] } {
    const allTasks = this.tasksRepository.findAll();
    const target = (userId || '').trim().toLowerCase();
    if (!target) return { releasedTasks: [], affectedProjectIds: [] };

    const releasedTasks: Task[] = [];
    const projectMap = new Map<string, Task[]>();

    for (const task of allTasks) {
      const isAssigned =
        (task.assigneeId && task.assigneeId.toLowerCase() === target) ||
        (task.assigneeName && task.assigneeName.toLowerCase() === target) ||
        (task.assignee && task.assignee.toLowerCase() === target);

      if (!isAssigned) continue;

      const normStatus = (task.status || '').toLowerCase().trim();
      const isToDo = normStatus === 'todo' || normStatus === 'to-do' || normStatus === 'to do' || normStatus === 'open' || normStatus === 'pending';
      const isInProgress = normStatus === 'in-progress' || normStatus === 'in progress' || normStatus === 'inprogress';

      // Open and In-Progress return to Unassigned and Open (ToDo). In-Review and Completed stay!
      if (isToDo || isInProgress) {
        task.assignee = 'Unassigned';
        task.assigneeName = 'Unassigned';
        task.assigneeId = undefined;
        task.status = TaskStatus.ToDo;
        task.proofLink = undefined;
        (task as any).proof_link = undefined;
        this.tasksRepository.update(task.id, task);
        releasedTasks.push(task);

        if (!projectMap.has(task.projectId)) {
          projectMap.set(task.projectId, []);
        }
        projectMap.get(task.projectId).push(task);
      }
    }

    // Notify project owners with the list of released tasks
    for (const [projectId, tasks] of projectMap.entries()) {
      const taskTitles = tasks.map((t) => t.title || t.id).join(', ');
      try {
        const project = this.projectsService.findById(projectId);
        if (project && project.ownerId) {
          this.notificationsService.create({
            userId: String(project.ownerId),
            type: 'TASK_RELEASED',
            title: 'Collaborator Tasks Released',
            message: \`Collaborator was suspended. The following tasks were returned to Unassigned and Open: \${taskTitles}\`,
            readStatus: false,
            referenceId: projectId,
          });
        }
      } catch (err) {
        this.logger.warn(\`Failed to notify project owner for released tasks on project \${projectId}: \${err?.message}\`);
      }

      try {
        this.auditService.log({
          action: 'tasks-released-suspension',
          actor: 'System',
          target: \`User #\${userId}\`,
          entityType: 'project',
          entityId: projectId,
          event: \`Tasks released back to Open due to collaborator suspension: \${taskTitles}\`,
          details: { releasedTaskIds: tasks.map((t) => t.id) },
        });
      } catch (err) {
        this.logger.warn(\`Failed to log audit for task release: \${err?.message}\`);
      }
    }

    return {
      releasedTasks,
      affectedProjectIds: Array.from(projectMap.keys()),
    };
  }
`;

const target = '  findAll(): Task[] {';
if (!content.includes(target)) {
  console.error('Target not found in tasks.service.ts');
  process.exit(1);
}
content = content.replace(target, method + '\n' + target);

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully updated tasks.service.ts');
