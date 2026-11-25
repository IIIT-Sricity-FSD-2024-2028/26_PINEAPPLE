import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createTestApp, TestAppContext } from './helpers/test-helpers';
import { UserRole, UserStatus } from '../src/users/dto/create-user.dto';
import { TaskStatus } from '../src/tasks/dto/create-task.dto';

describe('Phase 18 E2E API Tests: Soft Delete, Account Export, Account Deletion & Digest', () => {
  let ctx: TestAppContext;
  let app: INestApplication;
  let server: any;
  let ownerToken: string;
  let adminToken: string;
  let otherToken: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;
    server = app.getHttpServer();
    ownerToken = ctx.loginAs('owner'); // User 1
    adminToken = ctx.loginAs('admin'); // u-admin
    otherToken = ctx.loginAs('collaborator'); // User 2
  });

  beforeEach(() => {
    ctx.resetStores();
    ctx.clockService.setTime('2026-11-11T08:00:00.000Z');
  });

  afterAll(async () => {
    await app.close();
  });

  const longDesc =
    'A comprehensive engineering collaboration project with detailed requirements, architecture goals, task milestones, and review guidelines for all contributors.';

  it('1. DELETE /projects/:id soft-deletes, hides everywhere except admin deleted filter, blocks escrow with 409, and restores <=30d only', async () => {
    const project = ctx.projectsService.create('1', {
      title: 'E2E Soft Delete Project',
      description: longDesc,
      teamSize: 4,
      dueDate: '2027-03-01T00:00:00.000Z',
    });

    const delRes = await request(server)
      .delete(`/projects/${project.id}`)
      .set('Authorization', ownerToken);
    expect(delRes.status).toBe(200);
    expect(delRes.body.deletedAt).toBeDefined();

    // Public list excludes deleted
    const pubList = await request(server).get('/projects').set('Authorization', otherToken);
    expect(pubList.status).toBe(200);
    expect(pubList.body.some((p: any) => p.id === project.id)).toBe(false);

    // Direct non-admin GET -> 404
    const getPub = await request(server).get(`/projects/${project.id}`).set('Authorization', otherToken);
    expect(getPub.status).toBe(404);

    // Admin Deleted filter shows it
    const adminList = await request(server)
      .get('/projects?status=deleted')
      .set('Authorization', adminToken);
    expect(adminList.status).toBe(200);
    expect(adminList.body.some((p: any) => p.id === project.id)).toBe(true);

    // Day 29 restore succeeds
    ctx.advanceTime({ days: 29 });
    const restoreRes = await request(server)
      .post(`/admin/projects/${project.id}/restore`)
      .set('Authorization', adminToken);
    expect(restoreRes.status).toBe(200);
    expect(restoreRes.body.project.deletedAt).toBeUndefined();

    // Re-delete -> Day 31 fails 409 RESTORE_WINDOW_PASSED
    await request(server).delete(`/projects/${project.id}`).set('Authorization', ownerToken);
    ctx.advanceTime({ days: 31 });
    const expiredRestore = await request(server)
      .post(`/admin/projects/${project.id}/restore`)
      .set('Authorization', adminToken);
    expect(expiredRestore.status).toBe(409);
    expect(expiredRestore.body.code).toBe('RESTORE_WINDOW_PASSED');
  });

  it('2. Account export HTTP endpoints: 202 request, 200 download JSON (no others private data), 403 cross-user, 429 rate limit, 404 expired', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-p18-e2e-exp-'));
    process.env.EXPORT_DIR = tmpDir;

    const proj = ctx.projectsService.create('2', {
      title: 'E2E Export Project',
      description: longDesc,
      teamSize: 3,
      dueDate: '2027-03-01T00:00:00.000Z',
    });
    ctx.communicationRepository.sendMessage('2', { projectId: proj.id, text: 'Own message for export' }, 'Owner');
    ctx.communicationRepository.sendMessage('1', { projectId: proj.id, text: 'Owner private note' }, 'Collaborator');

    const reqRes = await request(server)
      .post('/users/me/export')
      .set('Authorization', otherToken);
    expect(reqRes.status).toBe(202);
    const { exportId } = reqRes.body;
    expect(exportId).toBeDefined();

    // Status poll
    const statusRes = await request(server)
      .get(`/users/me/export/${exportId}`)
      .set('Authorization', otherToken);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.status).toBe('ready');

    // Cross-user forbidden
    const crossRes = await request(server)
      .get(`/users/me/export/${exportId}/download`)
      .set('Authorization', ownerToken);
    expect(crossRes.status).toBe(403);

    // Rate limit 429 within 1 hour
    const rateRes = await request(server)
      .post('/users/me/export')
      .set('Authorization', otherToken);
    expect(rateRes.status).toBe(429);
    expect(rateRes.body.code).toBe('EXPORT_RATE_LIMIT');

    // Valid download
    const dlRes = await request(server)
      .get(`/users/me/export/${exportId}/download`)
      .set('Authorization', otherToken);
    expect(dlRes.status).toBe(200);
    const archive = JSON.parse(dlRes.text);
    expect(archive.profile.email).toBe('arjun.sharma@teamforge.io');
    expect(archive.messages.some((m: any) => m.content === 'Own message for export')).toBe(true);
    expect(archive.messages.some((m: any) => m.content === 'Owner private note')).toBe(false);

    // After 25h -> 404 EXPORT_EXPIRED
    ctx.advanceTime({ hours: 25 });
    const expiredRes = await request(server)
      .get(`/users/me/export/${exportId}/download`)
      .set('Authorization', otherToken);
    expect(expiredRes.status).toBe(404);
    expect(expiredRes.body.code).toBe('EXPORT_EXPIRED');

    delete process.env.EXPORT_DIR;
  });

  it('3. Account deletion HTTP lifecycle: obligations 409, admin 403, deleted user JWT immediately 401, login rejected, chat/task anonymized', async () => {
    const tempUser = ctx.usersRepository.create({
      name: 'Sam E2E Delete',
      email: 'sam.delete@test.local',
      username: 'sam_delete_e2e',
      role: UserRole.Collaborator,
      password: 'DeletePass@123',
      skills: ['Node.js'],
      status: UserStatus.Active,
    } as any);
    const samToken = ctx.loginAs(tempUser.id, [], {
      email: tempUser.email,
      role: 'collaborator',
    });

    // Unauthenticated call -> 401
    await request(server).post('/users/me/delete').send({ username: 'sam_delete_e2e' }).expect(401);

    const adminSelfRes = await request(server)
      .post('/users/me/delete')
      .set('Authorization', adminToken)
      .send({ username: 'tf_admin' });
    expect(adminSelfRes.status).toBe(403);
    expect(adminSelfRes.body.code).toBe('ADMIN_CANNOT_SELF_DELETE');

    const proj = ctx.projectsService.create(tempUser.id, {
      title: 'Sam Unfinished Project',
      description: longDesc,
      teamSize: 3,
      dueDate: '2027-03-01T00:00:00.000Z',
    });
    const task = ctx.tasksService.create({
      projectId: proj.id,
      title: 'Preserved Task After Deletion',
      assigneeId: tempUser.id,
      assigneeName: tempUser.name,
      status: TaskStatus.Completed,
      dueDate: '2027-02-01T00:00:00.000Z',
    });
    ctx.communicationRepository.sendMessage(tempUser.id, { projectId: proj.id, text: 'Chat persists after deletion' }, 'Owner');

    // Mismatched username (even another user's username) -> 400 USERNAME_MISMATCH
    const mismatchRes = await request(server)
      .post('/users/me/delete')
      .set('Authorization', samToken)
      .send({ username: 'arjunsharma', id: '2' });
    expect(mismatchRes.status).toBe(400);
    expect(mismatchRes.body.code).toBe('USERNAME_MISMATCH');
    expect(ctx.usersRepository.findById('2')?.isDeleted).toBeFalsy();

    const blockedRes = await request(server)
      .post('/users/me/delete')
      .set('Authorization', samToken)
      .send({ username: 'sam_delete_e2e' });
    expect(blockedRes.status).toBe(409);
    expect(blockedRes.body.code).toBe('ACCOUNT_HAS_OPEN_OBLIGATIONS');
    expect(Array.isArray(blockedRes.body.obligations)).toBe(true);

    // Close project then delete account (without password)
    ctx.projectsService.closeProject(proj.id, 'Finished before self delete', 'u-admin');
    const okRes = await request(server)
      .post('/users/me/delete')
      .set('Authorization', samToken)
      .send({ username: 'sam_delete_e2e' });
    expect(okRes.status).toBe(200);
    expect(okRes.body.success).toBe(true);

    // Existing JWT immediately rejected -> 401
    const meAfterRes = await request(server).get('/users/me').set('Authorization', samToken);
    expect(meAfterRes.status).toBe(401);

    // Login fails -> 401
    const loginRes = await request(server)
      .post('/auth/login')
      .send({ identifier: 'sam.delete@test.local', password: 'DeletePass@123' });
    expect(loginRes.status).toBe(401);

    // Chat and task remain intact under "Deleted user"
    const msgsRes = await request(server)
      .get(`/communication/messages/project/${proj.id}`)
      .set('Authorization', adminToken);
    expect(msgsRes.status).toBe(200);
    expect(msgsRes.body[0].senderName).toBe('Deleted user');

    const savedTask = ctx.tasksRepository.findById(task.id);
    expect(savedTask?.assigneeName).toBe('Deleted user');
  });

  it('4. Notification settings validation & digest flush over HTTP + jobs/tick', async () => {
    const getInit = await request(server)
      .get('/users/me/settings')
      .set('Authorization', otherToken);
    expect(getInit.status).toBe(200);
    expect(getInit.body.digestEnabled).toBe(true);
    expect(getInit.body.digestHour).toBe(9);

    const badHour = await request(server)
      .patch('/users/me/settings')
      .set('Authorization', otherToken)
      .send({ digestHour: 24 });
    expect(badHour.status).toBe(400);

    const setRes = await request(server)
      .patch('/users/me/settings')
      .set('Authorization', otherToken)
      .send({ digestEnabled: true, digestHour: 11, utcOffsetMinutes: 0 });
    expect(setRes.status).toBe(200);
    expect(setRes.body.digestHour).toBe(11);

    // Emit digest notifications before 11:00 UTC
    const proj = ctx.projectsService.create('1', {
      title: 'Digest E2E Proj',
      description: longDesc,
      teamSize: 3,
      dueDate: '2027-03-01T00:00:00.000Z',
    });
    for (let i = 0; i < 8; i++) {
      ctx.notificationsService.create({
        userId: '2',
        type: 'TASKS_RELEASED',
        message: `Task #${i + 1}`,
        referenceId: proj.id,
        metadata: { projectTitle: 'Digest E2E Proj' },
      });
    }

    // Immediate warning bypasses digest buffer
    ctx.notificationsService.create({
      userId: '2',
      type: 'ACCOUNT_WARNED',
      title: 'Warning 1/4',
      message: 'Immediate moderation warning',
    });

    let notifsBefore = await request(server).get('/notifications').set('Authorization', otherToken);
    expect(notifsBefore.status).toBe(200);
    expect(notifsBefore.body.some((n: any) => n.title === 'Warning 1/4')).toBe(true);
    expect(notifsBefore.body.some((n: any) => n.type === 'DAILY_DIGEST')).toBe(false);

    // Advance to 11:05 UTC & run job tick
    ctx.clockService.setTime('2026-11-11T11:05:00.000Z');
    const superuserToken = ctx.loginAs('superuser');
    const tickRes = await request(server).post('/admin/jobs/tick').set('Authorization', superuserToken);
    expect([200, 201, 202]).toContain(tickRes.status);

    const notifsAfter = await request(server).get('/notifications').set('Authorization', otherToken);
    const digestNotif = notifsAfter.body.find((n: any) => n.type === 'DAILY_DIGEST');
    expect(digestNotif).toBeDefined();
    expect(digestNotif.message).toContain('8 tasks released from Digest E2E Proj');
  });
});
