import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, TestAppContext } from './helpers/test-helpers';
import { ProjectDifficulty, ProjectStatus } from '../src/projects/dto/create-project.dto';
import { TaskStatus } from '../src/tasks/dto/create-task.dto';
import { UserRole, UserStatus } from '../src/users/dto/create-user.dto';

describe('Phase 26 E2E API Tests: Notification Aggregation', () => {
  let ctx: TestAppContext;
  let app: INestApplication;
  let server: any;
  let ownerToken: string;
  let superuserToken: string;

  const longDesc =
    'Comprehensive E2E workspace used to verify Phase 26 HTTP bulk notification aggregation rules across suspension, deletion, and closure.';

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;
    server = app.getHttpServer();
    ownerToken = ctx.loginAs('owner');
    superuserToken = ctx.loginAs('superuser');
  });

  beforeEach(() => {
    ctx.resetStores();
    ctx.clockService.setTime('2026-11-11T10:00:00.000Z');
    ctx.usersRepository.update('1', { emailVerified: true } as any);
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Suspending a collaborator with 8 Open tasks creates ONE owner notification', async () => {
    const proj = ctx.projectsService.create('1', {
      title: 'Project Atlas E2E',
      description: longDesc,
      teamSize: 5,
      dueDate: '2027-06-01T00:00:00.000Z',
    });

    const collab = ctx.usersRepository.create({
      name: 'Suspended Collab E2E',
      username: 'e2e_suspend_collab',
      email: 'e2e.suspend@test.local',
      password: 'Password@123',
      role: UserRole.Collaborator,
      emailVerified: true,
      status: UserStatus.Active,
    } as any);

    ctx.projectsService.addCollaborator(proj.id, {
      id: collab.id,
      name: collab.name,
      role: 'Collaborator',
    });

    for (let i = 1; i <= 8; i++) {
      ctx.tasksService.create({
        projectId: proj.id,
        title: `Atlas Task ${i}`,
        assigneeId: collab.id,
        assigneeName: collab.name,
        priority: 'Medium',
        status: TaskStatus.ToDo,
        dueDate: '2027-05-01T00:00:00.000Z',
      });
    }

    ctx.notificationsService.reset();

    const suspRes = await request(server)
      .post(`/admin/users/${collab.id}/suspend`)
      .set('Authorization', superuserToken)
      .send({ reason: 'E2E suspension policy check for bulk task release.' });
    expect(suspRes.status).toBe(200);

    const notifsRes = await request(server)
      .get('/notifications')
      .set('Authorization', ownerToken);
    expect(notifsRes.status).toBe(200);

    const taskReleasedNotifs = (notifsRes.body as any[]).filter(
      (n) => n.type === 'TASK_RELEASED',
    );
    expect(taskReleasedNotifs).toHaveLength(1);
    expect(taskReleasedNotifs[0].count).toBe(8);
    expect(taskReleasedNotifs[0].items).toHaveLength(8);
  });

  it('2. Deleting an account participating in 3 projects creates ONE notification per affected owner', async () => {
    const collab = ctx.usersRepository.create({
      name: 'Multi Project Collab',
      username: 'e2e_multi_del',
      email: 'e2e.multidel@test.local',
      password: 'DeletePass@123',
      role: UserRole.Collaborator,
      emailVerified: true,
      status: UserStatus.Active,
    } as any);
    const collabToken = ctx.loginAs(collab.id, [], {
      email: collab.email,
      role: 'collaborator',
    });

    for (let i = 1; i <= 3; i++) {
      const proj = ctx.projectsRepository.create(
        '1',
        {
          title: `Delete E2E Project ${i}`,
          description: longDesc,
          difficulty: ProjectDifficulty.Medium,
          requiredSkills: ['TypeScript'],
          duration: '2 Months',
          dueDate: '2027-06-01T00:00:00.000Z',
        } as any,
        ProjectStatus.Open,
      );
      ctx.projectsService.addCollaborator(proj.id, {
        id: collab.id,
        name: collab.name,
        role: 'Collaborator',
      });
      ctx.tasksService.create({
        projectId: proj.id,
        title: `Task ${i} for Delete`,
        assigneeId: collab.id,
        assigneeName: collab.name,
        priority: 'Low',
        status: TaskStatus.ToDo,
        dueDate: '2027-05-01T00:00:00.000Z',
      });
    }

    ctx.notificationsService.reset();

    const delRes = await request(server)
      .post('/users/me/delete')
      .set('Authorization', collabToken)
      .send({ username: collab.username });
    expect(delRes.status).toBe(200);

    const ownerNotifsRes = await request(server)
      .get('/notifications')
      .set('Authorization', ownerToken);
    expect(ownerNotifsRes.status).toBe(200);

    const ownerDelNotifs = (ownerNotifsRes.body as any[]).filter(
      (n) => n.type === 'TASK_RELEASED' && String(n.groupKey || '').startsWith('account_deleted:'),
    );
    expect(ownerDelNotifs).toHaveLength(1);
    expect(ownerDelNotifs[0].count).toBe(3);
    expect(ownerDelNotifs[0].items).toHaveLength(3);
  });

  it('3. Closing a project with 5 pending requests via HTTP sends 5 applicant notices and 1 owner summary notice', async () => {
    const proj = ctx.projectsService.create('1', {
      title: 'Closure E2E Project',
      description: longDesc,
      teamSize: 5,
      dueDate: '2027-06-01T00:00:00.000Z',
    });

    const applicants: Array<{ id: string; token: string }> = [];
    for (let i = 1; i <= 5; i++) {
      const appUser = ctx.usersRepository.create({
        name: `Closure App ${i}`,
        username: `e2e_closure_app_${i}`,
        email: `e2e.closure${i}@test.local`,
        password: 'Password@123',
        role: UserRole.Collaborator,
        emailVerified: true,
        status: UserStatus.Active,
      } as any);
      const token = ctx.loginAs(appUser.id, [], {
        email: appUser.email,
        role: 'collaborator',
      });
      applicants.push({ id: appUser.id, token });

      const jrRes = await request(server)
        .post('/join-requests')
        .set('Authorization', token)
        .send({
          projectId: proj.id,
          message: `Application ${i} hoping to collaborate on Closure E2E Project.`,
        });
      expect(jrRes.status).toBe(201);
    }

    ctx.notificationsService.reset();

    const closeRes = await request(server)
      .post(`/projects/${proj.id}/close`)
      .set('Authorization', superuserToken)
      .send({ reason: 'Closing project for E2E bulk notice verification' });
    expect(closeRes.status).toBe(200);

    for (const appEntry of applicants) {
      const res = await request(server)
        .get('/notifications')
        .set('Authorization', appEntry.token);
      expect(res.status).toBe(200);
      const closedNotices = (res.body as any[]).filter(
        (n) => n.type === 'PROJECT_CLOSED' && n.referenceId === proj.id,
      );
      expect(closedNotices).toHaveLength(1);
    }

    const ownerNotifsRes = await request(server)
      .get('/notifications')
      .set('Authorization', ownerToken);
    expect(ownerNotifsRes.status).toBe(200);
    const ownerSummary = (ownerNotifsRes.body as any[]).filter(
      (n) => n.groupKey === `project_closed_owner:${proj.id}`,
    );
    expect(ownerSummary).toHaveLength(1);
    expect(ownerSummary[0].count).toBe(5);
    expect(ownerSummary[0].items).toHaveLength(5);
  });
});
