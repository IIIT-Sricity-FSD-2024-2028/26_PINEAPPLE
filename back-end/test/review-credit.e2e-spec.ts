import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, TestAppContext } from './helpers/test-helpers';
import { TaskStatus } from '../src/tasks/dto/create-task.dto';

describe('Review Time Credit (With Mandatory Project Deadline Cascade) E2E Tests', () => {
  let ctx: TestAppContext;
  let app: INestApplication;
  let server: any;

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;
    server = app.getHttpServer();
  });

  beforeEach(() => {
    ctx.resetStores();
    ctx.clockService.setTime('2026-11-01T12:00:00.000Z');
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Standard review extension: owner rejects after 3 days, task deadline advances by exactly 3 days', async () => {
    const proj = ctx.projectsService.create('1', {
      title: 'Review Credit Project Alpha',
      description: 'Testing review time credit extension within project deadline. This comprehensive description ensures that the platform requirement of at least one hundred characters is fully satisfied for testing.',
      teamSize: 4,
      dueDate: '2026-12-01T00:00:00.000Z',
    });
    ctx.projectsService.addCollaborator(proj.id, { id: '2', name: 'Arjun Sharma', role: 'Collaborator' });

    // Initial task due Nov 15
    const task = ctx.tasksService.create({
      projectId: proj.id,
      title: 'Build Authentication Module',
      assigneeId: '2',
      assigneeName: 'Arjun Sharma',
      status: TaskStatus.InReview,
      proofLink: 'https://github.com/teamforge/repo/pull/101',
      dueDate: '2026-11-15T12:00:00.000Z',
    });

    // Advance clock 3 days to Nov 04
    ctx.clockService.setTime('2026-11-04T12:00:00.000Z');

    const rejRes = await request(server)
      .post(`/tasks/${task.id}/review`)
      .set('Authorization', ctx.loginAs('1'))
      .send({
        decision: 'reject',
        reason: 'Please add automated integration tests for JWT token invalidation.',
      });

    expect(rejRes.status).toBe(200);
    // Task deadline was extended by 3 days: Nov 15 12:00 -> Nov 18 12:00
    expect(rejRes.body.dueDate).toBe('2026-11-18T12:00:00.000Z');
    expect(rejRes.body.status).toBe('To Do');
    expect(rejRes.body.dueDateHistory).toBeDefined();
    expect(rejRes.body.dueDateHistory.length).toBe(1);
    expect(rejRes.body.dueDateHistory[0].reason).toBe('REVIEW_CREDIT');
    expect(rejRes.body.dueDateHistory[0].creditMs).toBe(3 * 24 * 60 * 60 * 1000);
    expect(rejRes.body.dueDateHistory[0].extendedProject).toBe(false);

    // Project deadline remained untouched because Nov 18 <= Dec 01
    const fetchedProj = ctx.projectsService.findById(proj.id);
    expect(fetchedProj.dueDate).toBe('2026-12-01T00:00:00.000Z');

    // Collaborator notification received with review credit details
    const notifs = ctx.notificationsService.findByUserId('2');
    const taskNotif = notifs.find((n) => n.metadata?.taskId === task.id);
    expect(taskNotif).toBeDefined();
    expect(taskNotif?.message).toContain('Because review took 3 days, task deadline was extended by the same duration');
  });

  it('2. Exceeding project deadline requires project deadline extension (400 PROJECT_DEADLINE_EXTENSION_REQUIRED)', async () => {
    // Project due Nov 18
    const proj = ctx.projectsService.create('1', {
      title: 'Tight Deadline Project',
      description: 'Testing mandatory project extension requirement when review credit pushes the task due date past project due date.',
      teamSize: 4,
      dueDate: '2026-11-18T00:00:00.000Z',
    });
    ctx.projectsService.addCollaborator(proj.id, { id: '2', name: 'Arjun Sharma', role: 'Collaborator' });

    // Task due Nov 16
    const task = ctx.tasksService.create({
      projectId: proj.id,
      title: 'Implement Database Optimization',
      assigneeId: '2',
      assigneeName: 'Arjun Sharma',
      status: TaskStatus.InReview,
      proofLink: 'https://github.com/teamforge/repo/pull/102',
      dueDate: '2026-11-16T00:00:00.000Z',
    });

    // Advance clock 4 days to Nov 05
    ctx.clockService.setTime('2026-11-05T12:00:00.000Z');
    // Review took 4 days 0.5 hours. Task deadline would move from Nov 16 to Nov 20 12:00, which exceeds project deadline Nov 18!

    const rejRes = await request(server)
      .post(`/tasks/${task.id}/review`)
      .set('Authorization', ctx.loginAs('1'))
      .send({
        decision: 'reject',
        reason: 'Missing index on foreign keys in migration script.',
      });

    expect(rejRes.status).toBe(400);
    expect(rejRes.body.code).toBe('PROJECT_DEADLINE_EXTENSION_REQUIRED');
    expect(rejRes.body.details).toBeDefined();
    expect(rejRes.body.details.minProjectDueDate).toBeDefined();
  });

  it('3. Atomically extends project deadline when valid parameters are provided alongside rejection', async () => {
    const proj = ctx.projectsService.create('1', {
      title: 'Cascading Extension Project',
      description: 'Testing atomic extension of project deadline alongside task review credit in a single cohesive platform operation.',
      teamSize: 4,
      dueDate: '2026-11-18T00:00:00.000Z',
    });
    ctx.projectsService.addCollaborator(proj.id, { id: '2', name: 'Arjun Sharma', role: 'Collaborator' });

    const task = ctx.tasksService.create({
      projectId: proj.id,
      title: 'Full Text Search Feature',
      assigneeId: '2',
      assigneeName: 'Arjun Sharma',
      status: TaskStatus.InReview,
      proofLink: 'https://github.com/teamforge/repo/pull/103',
      dueDate: '2026-11-16T00:00:00.000Z',
    });

    // Advance clock 4 days to Nov 05 12:00
    ctx.clockService.setTime('2026-11-05T12:00:00.000Z');
    // 4 days review -> task moves to Nov 20 00:00. Project must move to at least Nov 20.
    const newProjectDueDate = '2026-11-25T00:00:00.000Z';
    const projectReason = 'Extending project deadline due to review delay on full text search.';

    const rejRes = await request(server)
      .post(`/tasks/${task.id}/review`)
      .set('Authorization', ctx.loginAs('1'))
      .send({
        decision: 'reject',
        reason: 'Please rewrite Elasticsearch query to use match phrase prefix.',
        extendedProjectDueDate: newProjectDueDate,
        projectReason,
      });

    expect(rejRes.status).toBe(200);
    expect(rejRes.body.dueDate).toBe('2026-11-20T00:00:00.000Z');
    expect(rejRes.body.dueDateHistory[0].extendedProject).toBe(true);

    // Verify project was updated atomically
    const updatedProj = ctx.projectsService.findById(proj.id, '1');
    expect(updatedProj.dueDate).toBe(newProjectDueDate);
    expect(updatedProj.deadlineHistory?.length).toBeGreaterThanOrEqual(1);

    // Verify audit logs contain TASK_REVIEW_CREDIT_APPLIED
    const audits = ctx.auditService.findAll();
    const creditAudit = audits.find((a) => a.action === 'TASK_REVIEW_CREDIT_APPLIED');
    expect(creditAudit).toBeDefined();
    expect(creditAudit?.details?.projectDeadlineExtended).toBe(true);
  });

  it('4. Repeated rejection of the same submission returns 409 and does not double-credit', async () => {
    const proj = ctx.projectsService.create('1', {
      title: 'Idempotency Project',
      description: 'Testing idempotency and duplicate rejection prevention across multiple repeated task rejection requests.',
      teamSize: 4,
      dueDate: '2026-12-01T00:00:00.000Z',
    });
    ctx.projectsService.addCollaborator(proj.id, { id: '2', name: 'Arjun Sharma', role: 'Collaborator' });

    const task = ctx.tasksService.create({
      projectId: proj.id,
      title: 'Design API Specs',
      assigneeId: '2',
      assigneeName: 'Arjun Sharma',
      status: TaskStatus.InReview,
      proofLink: 'https://github.com/teamforge/repo/pull/104',
      dueDate: '2026-11-20T00:00:00.000Z',
    });

    ctx.clockService.setTime('2026-11-03T12:00:00.000Z');

    // First rejection succeeds
    const firstRes = await request(server)
      .post(`/tasks/${task.id}/review`)
      .set('Authorization', ctx.loginAs('1'))
      .send({
        decision: 'reject',
        reason: 'Please add OpenAPI security definitions for Bearer auth.',
      });
    expect(firstRes.status).toBe(200);
    expect(firstRes.body.dueDate).toBe('2026-11-22T00:00:00.000Z');

    // Immediate second rejection without resubmitting returns 409
    const secondRes = await request(server)
      .post(`/tasks/${task.id}/review`)
      .set('Authorization', ctx.loginAs('1'))
      .send({
        decision: 'reject',
        reason: 'Second rejection attempt on the same submission.',
      });
    expect(secondRes.status).toBe(409);

    // Task due date was not changed twice
    const fetched = ctx.tasksService.findById(task.id);
    expect(fetched.dueDate).toBe('2026-11-22T00:00:00.000Z');
    expect(fetched.dueDateHistory?.length).toBe(1);
  });

  it('5. In-Review tasks past due date are NEVER penalized by applyDeadlinePenalties', async () => {
    const proj = ctx.projectsService.create('1', {
      title: 'In Review Penalty Immunity Project',
      description: 'Testing that tasks in review are immune to deadline penalties even when current date exceeds their initial due date.',
      teamSize: 4,
      dueDate: '2026-12-01T00:00:00.000Z',
    });
    ctx.projectsService.addCollaborator(proj.id, { id: '2', name: 'Arjun Sharma', role: 'Collaborator' });

    // Task is In Review and was due Nov 05
    const task = ctx.tasksService.create({
      projectId: proj.id,
      title: 'Complex Architecture Document',
      assigneeId: '2',
      assigneeName: 'Arjun Sharma',
      status: TaskStatus.InReview,
      proofLink: 'https://github.com/teamforge/repo/pull/105',
      dueDate: '2026-11-05T00:00:00.000Z',
    });

    // Advance clock past the due date to Nov 10
    ctx.clockService.setTime('2026-11-10T00:00:00.000Z');

    // Run the deadline penalty job
    const result = await ctx.jobsService.applyDeadlinePenalties();
    expect(result.penalizedTasks).not.toContain(task.id);

    // Confirm task has no penalty applied
    const fetched = ctx.tasksService.findById(task.id);
    expect(fetched.penaltyAppliedAt).toBeUndefined();
  });
});
