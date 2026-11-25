import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, TestAppContext } from './helpers/test-helpers';
import { TaskStatus } from '../src/tasks/dto/create-task.dto';

describe('Phase 13 E2E API Tests: Task Review, Retention, Deadlines, Unassign & Field Whitelist', () => {
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
    for (const u of ctx.usersRepository.findAll(true)) {
      u.digestEnabled = false;
    }
    ctx.clockService.setTime('2026-11-11T12:00:00.000Z');
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Reject requires 10-500 char reason (400 REASON_REQUIRED), stores reason/history, notifies collaborator, and clears visible reason on resubmit', async () => {
    const proj = ctx.projectsService.create('1', {
      title: 'Review E2E Project',
      description: 'Testing task review feedback via REST API, including mandatory rejection reasons, history tracking, and resubmit cleanup.',
      teamSize: 4,
      dueDate: '2027-06-01T00:00:00.000Z',
    });
    ctx.projectsService.addCollaborator(proj.id, { id: '2', name: 'Arjun Sharma', role: 'Collaborator' });

    const task = ctx.tasksService.create({
      projectId: proj.id,
      title: 'Implement Search Pagination',
      assigneeId: '2',
      assigneeName: 'Arjun Sharma',
      status: TaskStatus.InReview,
      proofLink: 'https://github.com/org/repo/pull/21',
      dueDate: '2027-05-01T00:00:00.000Z',
    });

    // Missing reason -> 400 REASON_REQUIRED
    const missingRes = await request(server)
      .post(`/tasks/${task.id}/review`)
      .set('Authorization', ctx.loginAs('1'))
      .send({ decision: 'reject' });
    expect(missingRes.status).toBe(400);
    expect(missingRes.body.code).toBe('REASON_REQUIRED');

    // Valid reason -> 200 and persisted on GET /tasks/:id + GET /notifications
    const reasonText = 'Please add edge-case handling for negative page numbers.';
    const rejRes = await request(server)
      .post(`/tasks/${task.id}/review`)
      .set('Authorization', ctx.loginAs('1'))
      .send({ decision: 'reject', reason: reasonText });
    expect(rejRes.status).toBe(200);
    expect(rejRes.body.rejectionReason).toBe(reasonText);

    const getRes = await request(server)
      .get(`/tasks/${task.id}`)
      .set('Authorization', ctx.loginAs('2'));
    expect(getRes.status).toBe(200);
    expect(getRes.body.rejectionReason).toBe(reasonText);
    expect(getRes.body.rejectionHistory).toHaveLength(1);

    const notifRes = await request(server)
      .get('/notifications')
      .set('Authorization', ctx.loginAs('2'));
    expect(notifRes.status).toBe(200);
    const rejNotif = notifRes.body.find((n: any) => n.type === 'TASK_REJECTED' && n.referenceId === proj.id);
    expect(rejNotif).toBeDefined();
    expect(rejNotif.message).toContain(reasonText);

    // Resubmit -> clears visible rejectionReason, preserves rejectionHistory
    const resubmitRes = await request(server)
      .patch(`/tasks/${task.id}/status`)
      .set('Authorization', ctx.loginAs('2'))
      .send({ status: 'In Review', proofLink: 'https://github.com/org/repo/pull/22' });
    expect(resubmitRes.status).toBe(200);
    expect(resubmitRes.body.rejectionReason).toBeUndefined();
    expect(resubmitRes.body.rejectionHistory).toHaveLength(1);
  });

  it('2. Departed collaborator keeps In Review tasks with proof, and owner approving credits XP to departed user', async () => {
    const proj = ctx.projectsService.create('1', {
      title: 'Departed Approval E2E Project',
      description: 'Testing leave keeps In Review task and XP still awards to the former collaborator when owner approves their work.',
      teamSize: 4,
      dueDate: '2027-06-01T00:00:00.000Z',
    });
    ctx.projectsService.addCollaborator(proj.id, { id: '6', name: 'Aditya Sai', role: 'Collaborator' });

    const openTask = ctx.tasksService.create({
      projectId: proj.id,
      title: 'Open Work',
      assigneeId: '6',
      assigneeName: 'Aditya Sai',
      status: TaskStatus.ToDo,
      dueDate: '2027-05-01T00:00:00.000Z',
    });
    const reviewTask = ctx.tasksService.create({
      projectId: proj.id,
      title: 'Finished PR Pending Review',
      assigneeId: '6',
      assigneeName: 'Aditya Sai',
      priority: 'High',
      status: TaskStatus.InReview,
      proofLink: 'https://github.com/org/repo/pull/88',
      dueDate: '2027-05-01T00:00:00.000Z',
    });

    const leaveRes = await request(server)
      .post(`/projects/${proj.id}/leave`)
      .set('Authorization', ctx.loginAs('6'))
      .send({ category: 'Too busy', reason: 'Stepping back after submitting my finished PR.' });
    expect(leaveRes.status).toBe(201);

    expect(ctx.tasksService.findById(openTask.id).assignee).toBe('Unassigned');
    expect(ctx.tasksService.findById(reviewTask.id).status).toBe(TaskStatus.InReview);
    expect(ctx.tasksService.findById(reviewTask.id).proofLink).toBe('https://github.com/org/repo/pull/88');

    const xpBefore = ctx.gamificationService.getUserStats('6').totalXp;
    const approveRes = await request(server)
      .post(`/tasks/${reviewTask.id}/review`)
      .set('Authorization', ctx.loginAs('1'))
      .send({ decision: 'approve' });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.status).toBe(TaskStatus.Completed);
    expect(ctx.gamificationService.getUserStats('6').totalXp).toBe(xpBefore + 40);
  });

  it('3. Role whitelist (collaborator dueDate -> 403 FORBIDDEN_FIELD, owner dueDate -> 200) and late unassign inside 24h', async () => {
    const proj = ctx.projectsService.create('1', {
      title: 'Whitelist & Late Drop E2E',
      description: 'Testing dueDate whitelist and unassign 24h rule via HTTP to protect collaborator deadlines from unauthorized edits.',
      teamSize: 4,
      dueDate: '2027-06-01T00:00:00.000Z',
    });
    ctx.projectsService.addCollaborator(proj.id, { id: '2', name: 'Arjun Sharma', role: 'Collaborator' });

    const lateDueIso = new Date(ctx.clockService.now().getTime() + 10 * 60 * 60 * 1000).toISOString();
    const newDueIso = new Date(ctx.clockService.now().getTime() + 96 * 60 * 60 * 1000).toISOString();

    const task = ctx.tasksService.create({
      projectId: proj.id,
      title: 'Sensitive Due Date Task',
      assigneeId: '2',
      assigneeName: 'Arjun Sharma',
      status: TaskStatus.InProgress,
      dueDate: lateDueIso,
    });

    // Collaborator PATCH dueDate -> 403 FORBIDDEN_FIELD
    const collabDueRes = await request(server)
      .patch(`/tasks/${task.id}`)
      .set('Authorization', ctx.loginAs('2'))
      .send({ dueDate: newDueIso });
    expect(collabDueRes.status).toBe(403);
    expect(collabDueRes.body.code).toBe('FORBIDDEN_FIELD');

    // Late unassign without reason -> 400 REASON_REQUIRED
    const badDropRes = await request(server)
      .post(`/tasks/${task.id}/unassign`)
      .set('Authorization', ctx.loginAs('2'))
      .send({});
    expect(badDropRes.status).toBe(400);
    expect(badDropRes.body.code).toBe('REASON_REQUIRED');

    // Late unassign with valid reason -> 200 & notifies owner
    const goodDropRes = await request(server)
      .post(`/tasks/${task.id}/unassign`)
      .set('Authorization', ctx.loginAs('2'))
      .send({ reason: 'Hospital emergency preventing delivery before tonight.' });
    expect(goodDropRes.status).toBe(200);
    expect(goodDropRes.body.assignee).toBe('Unassigned');
    expect(goodDropRes.body.status).toBe(TaskStatus.ToDo);

    // Owner PATCH dueDate -> 200
    const ownerDueRes = await request(server)
      .patch(`/tasks/${task.id}`)
      .set('Authorization', ctx.loginAs('1'))
      .send({ dueDate: newDueIso });
    expect(ownerDueRes.status).toBe(200);
    expect(ownerDueRes.body.dueDate).toBe(newDueIso);

    // Re-assign, submit proof, advance 7 days, trigger POST /admin/jobs/tick -> autoApproved
    const task2 = ctx.tasksService.create({
      projectId: proj.id,
      title: 'Review Timeout E2E Task',
      assigneeId: '2',
      assigneeName: 'Arjun Sharma',
      status: TaskStatus.InReview,
      proofLink: 'https://github.com/org/repo/pull/55',
      dueDate: '2027-05-01T00:00:00.000Z',
    });

    ctx.advanceTime({ days: 7, hours: 1 });
    const tickRes = await request(server)
      .post('/admin/jobs/tick')
      .set('Authorization', ctx.loginAs('superuser'));
    expect(tickRes.status).toBe(202);

    const autoDone = ctx.tasksService.findById(task2.id);
    expect(autoDone.status).toBe(TaskStatus.Completed);
    expect(autoDone.autoApproved).toBe(true);
  });
});
