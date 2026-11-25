const { ProjectsRepository } = require('../back-end/dist/src/projects/projects.repository');
const { ProjectsService } = require('../back-end/dist/src/projects/projects.service');
const { TasksRepository } = require('../back-end/dist/src/tasks/tasks.repository');
const { TasksService } = require('../back-end/dist/src/tasks/tasks.service');

async function testProjectDataRepair() {
  console.log('Testing Project Suspended Status Data Repair...');
  const projRepo = new ProjectsRepository();
  const tasksRepo = new TasksRepository();
  const tasksService = new TasksService(tasksRepo, projRepo, null, null, null, null);
  const projectsService = new ProjectsService(
    projRepo,
    tasksService,
    null,
    null,
    null,
    null,
    { getConfig: () => ({}) },
    { findAll: () => [] }
  );

  // Manually insert two test projects with 'Suspended' status
  // 1. One with no active tasks -> should repair to 'Open'
  projRepo.create('1', {
    title: 'Suspended Project No Tasks',
    description: 'Testing repair',
    status: 'Suspended',
  }, 'Suspended');

  const p1 = projRepo.findAll().find(p => p.title === 'Suspended Project No Tasks');
  p1.status = 'Suspended';

  // 2. One with in-progress tasks -> should repair to 'In Progress'
  projRepo.create('1', {
    title: 'Suspended Project With Tasks',
    description: 'Testing repair',
    status: 'Suspended',
  }, 'Suspended');
  const p2 = projRepo.findAll().find(p => p.title === 'Suspended Project With Tasks');
  p2.status = 'Suspended';
  tasksRepo.create({
    projectId: p2.id,
    title: 'Work item',
    status: 'In Progress',
  });

  console.log(`Before repair: p1 status = ${p1.status}, p2 status = ${p2.status}`);

  // Run repair
  projectsService.repairSuspendedProjects();

  console.log(`After repair: p1 status = ${p1.status}, p2 status = ${p2.status}`);

  if (p1.status === 'Open' && p2.status === 'In Progress') {
    console.log('[PASS] Suspended projects repaired correctly based on tasks!');
    process.exit(0);
  } else {
    console.error('[FAIL] Suspended projects were not repaired as expected.');
    process.exit(1);
  }
}

testProjectDataRepair().catch(err => {
  console.error(err);
  process.exit(1);
});
