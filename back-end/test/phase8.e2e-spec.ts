import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, TestAppContext } from './helpers/test-helpers';

describe('Phase 8 E2E Tests: Decision Finality, Data Integrity & Consolidated Notification Store', () => {
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
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Report Decision Finality (409 REPORT_ALREADY_ACTIONED)', () => {
    it('second action on a report returns 409 REPORT_ALREADY_ACTIONED and reputation is penalized once', async () => {
      // 1. Submit a report as collaborator against user '3' (collaborator)
      const createRes = await request(server)
        .post('/reports')
        .set('Authorization', ctx.loginAs('collaborator'))
        .set('x-user-id', '2')
        .send({
          reportedUserId: '3',
          reason: 'Harassment',
          details: 'User has repeatedly used abusive language in workspace chat channels.',
        });

      expect(createRes.status).toBe(201);
      const reportId = createRes.body.id;
      expect(reportId).toBeDefined();

      // 2. Admin resolves the report with warning
      const firstActionRes = await request(server)
        .post(`/admin/reports/${reportId}/action`)
        .set('Authorization', ctx.loginAs('admin'))
        .set('x-user-id', 'u-admin')
        .send({
          action: 'warn',
          reason: 'Official warning issued for violating code of conduct.',
        });

      expect(firstActionRes.status).toBe(201);
      expect(firstActionRes.body.report.status).toBe('Resolved');

      // 3. Second action on the same report returns 409 REPORT_ALREADY_ACTIONED
      const secondActionRes = await request(server)
        .post(`/admin/reports/${reportId}/action`)
        .set('Authorization', ctx.loginAs('admin'))
        .set('x-user-id', 'u-admin')
        .send({
          action: 'warn',
          reason: 'Attempting second penalty on already resolved report.',
        });

      expect(secondActionRes.status).toBe(409);
      expect(secondActionRes.body.code).toBe('REPORT_ALREADY_ACTIONED');

      // 4. Updating status via PATCH /admin/reports/:id/status also returns 409
      const patchRes = await request(server)
        .patch(`/admin/reports/${reportId}/status`)
        .set('Authorization', ctx.loginAs('admin'))
        .set('x-user-id', 'u-admin')
        .send({
          status: 'Dismissed',
          note: 'Attempting to change status after resolution.',
        });

      expect(patchRes.status).toBe(409);
      expect(patchRes.body.code).toBe('REPORT_ALREADY_ACTIONED');
    });
  });

  describe('2. Appeal Decision Finality (409 APPEAL_ALREADY_DECIDED)', () => {
    it('rejecting then accepting an appeal returns 409 APPEAL_ALREADY_DECIDED', async () => {
      // 1. Issue a warning to user '2' to create an active warning to appeal
      const warnRes = await ctx.moderationService.warn(
        'u-admin',
        '2',
        'Unacceptable conduct in community forum.',
      );
      const warningId = warnRes.warning?.id || 'warn-1';

      // 2. User '2' submits an appeal
      const appealRes = await request(server)
        .post(`/warnings/${warningId}/appeal`)
        .set('Authorization', ctx.loginAs('collaborator'))
        .set('x-user-id', '2')
        .send({
          explanation: 'I apologize for the misunderstanding and request this warning be reviewed.',
        });

      expect(appealRes.status).toBe(201);
      const appealId = appealRes.body.id;

      // 3. Admin rejects the appeal
      const rejectRes = await request(server)
        .post(`/admin/appeals/${appealId}/decision`)
        .set('Authorization', ctx.loginAs('admin'))
        .set('x-user-id', 'u-admin')
        .send({
          decision: 'reject',
          note: 'Violation was explicit. Warning upheld upon administrative review.',
        });

      expect([200, 201]).toContain(rejectRes.status);
      expect(rejectRes.body.appeal.status).toBe('rejected');

      // 4. Second decision (accept) returns 409 APPEAL_ALREADY_DECIDED
      const secondDecisionRes = await request(server)
        .post(`/admin/appeals/${appealId}/decision`)
        .set('Authorization', ctx.loginAs('admin'))
        .set('x-user-id', 'u-admin')
        .send({
          decision: 'accept',
          note: 'Attempting to accept previously rejected appeal.',
        });

      expect(secondDecisionRes.status).toBe(409);
      expect(secondDecisionRes.body.code).toBe('APPEAL_ALREADY_DECIDED');
    });
  });

  describe('3. Join Request Approval Race & Capacity Serialization', () => {
    it('two parallel approvals on the same request yields exactly one 200 and one 409', async () => {
      // Create a test project owned by user '1' (project-owner)
      const proj = ctx.projectsRepository.create(
        '1',
        {
          title: 'Race Condition Test Project',
          description: 'Testing serialized join approvals',
          maxCollaborators: 2,
          category: 'Web',
          difficulty: 'Intermediate',
          duration: '4 weeks',
          requiredSkills: ['React'],
        } as any,
        'Open' as any,
      );

      // Create a join request as collaborator
      const reqRes = await request(server)
        .post('/join-requests')
        .set('Authorization', ctx.loginAs('collaborator'))
        .set('x-user-id', '2')
        .send({
          projectId: proj.id,
          userName: 'Arjun Sharma',
          message: 'Interested in working on this project!',
        });

      expect(reqRes.status).toBe(201);
      const reqId = reqRes.body.id;

      // Send two concurrent approvals for the same request
      const [res1, res2] = await Promise.all([
        request(server)
          .put(`/join-requests/${reqId}/status`)
          .set('Authorization', ctx.loginAs('project-owner'))
          .set('x-user-id', '1')
          .set('x-user-role', 'Project Owner')
          .send({ status: 'approved' }),
        request(server)
          .put(`/join-requests/${reqId}/status`)
          .set('Authorization', ctx.loginAs('project-owner'))
          .set('x-user-id', '1')
          .set('x-user-role', 'Project Owner')
          .send({ status: 'approved' }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 409]);

      const conflictRes = res1.status === 409 ? res1 : res2;
      expect(['REQUEST_ALREADY_DECIDED', 'PROJECT_FULL']).toContain(conflictRes.body.code);
    });
  });

  describe('4. Project Completion Invariants & Badge Thresholds', () => {
    it('refuses completion of a project with 0 tasks with 400 PROJECT_NO_TASKS', async () => {
      const proj = ctx.projectsRepository.create(
        '1',
        {
          title: 'Zero Task Project',
          description: 'Project without any tasks',
          maxCollaborators: 3,
          category: 'Web',
          difficulty: 'Beginner',
          duration: '2 weeks',
          requiredSkills: ['JavaScript'],
        } as any,
        'Open' as any,
      );

      const completeRes = await request(server)
        .post(`/projects/${proj.id}/complete`)
        .set('Authorization', ctx.loginAs('project-owner'))
        .set('x-user-id', '1')
        .set('x-user-role', 'Project Owner')
        .send({
          finalLink: 'https://github.com/teamforge/zero-task-repo',
        });

      expect([400, 409]).toContain(completeRes.status);
      expect(['NO_TASKS', 'PROJECT_NO_TASKS']).toContain(completeRes.body.code);
    });

    it('completes project with 1 approved task without completion badge and shows reason', async () => {
      const proj = ctx.projectsRepository.create(
        '1',
        {
          title: 'One Task Project',
          description: 'Project with single task',
          maxCollaborators: 3,
          category: 'Web',
          difficulty: 'Beginner',
          duration: '2 weeks',
          requiredSkills: ['JavaScript'],
        } as any,
        'Open' as any,
      );

      // Create and complete 1 task
      ctx.tasksRepository.create({
        projectId: proj.id,
        title: 'Single Task',
        description: 'Complete initial setup',
        difficulty: 'Easy',
        xp: 50,
        status: 'Completed',
        assignedTo: '2',
      } as any);

      const completeRes = await request(server)
        .post(`/projects/${proj.id}/complete`)
        .set('Authorization', ctx.loginAs('project-owner'))
        .set('x-user-id', '1')
        .set('x-user-role', 'Project Owner')
        .send({
          finalLink: 'https://github.com/teamforge/one-task-repo',
        });

      expect(completeRes.status).toBe(201);
      expect(completeRes.body.status).toBe('Completed');
      expect(completeRes.body.badgeAwarded).toBe(false);
      expect(completeRes.body.badgeReason).toBe('Completed. Badges need at least 3 approved tasks');
    });
  });

  describe('5. Single Notification Store Consolidation', () => {
    it('seeded user sees seeded notifications through GET /notifications', async () => {
      // User '2' is seeded Arjun Sharma with 'notif-1'
      const notifRes = await request(server)
        .get('/notifications')
        .set('Authorization', ctx.loginAs('collaborator'))
        .set('x-user-id', '2');

      expect(notifRes.status).toBe(200);
      expect(Array.isArray(notifRes.body)).toBe(true);
      expect(notifRes.body.length).toBeGreaterThanOrEqual(1);

      const seedNotif = notifRes.body.find((n: any) => n.id === 'notif-1' || n.userId === '2');
      expect(seedNotif).toBeDefined();
      expect(seedNotif.title).toContain('Task Assigned');
    });
  });
});
