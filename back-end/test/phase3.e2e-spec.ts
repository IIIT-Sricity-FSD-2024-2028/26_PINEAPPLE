import request from 'supertest';
import { createTestApp, TestAppContext } from './helpers/test-helpers';

describe('Phase 3 Joining and Leaving - E2E API Tests', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(() => {
    ctx.resetStores();
  });

  describe('Join Request Limits & Requests Used', () => {
    it('returns 401 when submitting join request unauthenticated', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/join-requests')
        .send({
          projectId: 'proj-2',
          message: 'Interested in joining this project team.',
        });
      expect(res.status).toBe(401);
    });

    it('returns 403 OWN_PROJECT when owner applies to their own project', async () => {
      // proj-2 is owned by User 2 (Arjun Sharma)
      const token = ctx.loginAs('2');
      const res = await request(ctx.app.getHttpServer())
        .post('/join-requests')
        .set('Authorization', token)
        .send({
          projectId: 'proj-2',
          message: 'Applying to my own project.',
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('OWN_PROJECT');
    });

    it('returns 409 ALREADY_PENDING when user submits duplicate pending request', async () => {
      // User 3 (Sneha Rao) applies to proj-2 (owned by User 2)
      const token = ctx.loginAs('3');
      const res1 = await request(ctx.app.getHttpServer())
        .post('/join-requests')
        .set('Authorization', token)
        .send({
          projectId: 'proj-2',
          message: 'First application for this project.',
        });
      expect(res1.status).toBe(201);

      // Attempt second pending request without first being resolved
      const res2 = await request(ctx.app.getHttpServer())
        .post('/join-requests')
        .set('Authorization', token)
        .send({
          projectId: 'proj-2',
          message: 'Duplicate application while pending.',
        });
      expect(res2.status).toBe(409);
      expect(res2.body.code).toBe('ALREADY_PENDING');
    });

    it('enforces 2-request limit per project and returns 409 REQUEST_LIMIT_REACHED on 3rd attempt', async () => {
      const applicantToken = ctx.loginAs('3');
      const ownerToken = ctx.loginAs('2');

      // 1st Request
      const r1 = await request(ctx.app.getHttpServer())
        .post('/join-requests')
        .set('Authorization', applicantToken)
        .send({
          projectId: 'proj-2',
          message: 'Application attempt number 1.',
        });
      expect(r1.status).toBe(201);

      // Owner rejects 1st request with valid reason
      const rej1 = await request(ctx.app.getHttpServer())
        .patch(`/join-requests/${r1.body.id}`)
        .set('Authorization', ownerToken)
        .send({
          status: 'rejected',
          reason: 'Need candidate with more React experience.',
        });
      expect(rej1.status).toBe(200);

      // Check status: rejected_can_retry, requestsUsed: 1, requestsLeft: 1
      const statusAfterRej1 = await request(ctx.app.getHttpServer())
        .get('/projects/proj-2/my-request-status')
        .set('Authorization', applicantToken);
      expect(statusAfterRej1.status).toBe(200);
      expect(statusAfterRej1.body.state).toBe('rejected_can_retry');
      expect(statusAfterRej1.body.requestsUsed).toBe(1);
      expect(statusAfterRej1.body.requestsLeft).toBe(1);
      expect(statusAfterRej1.body.lastReason).toBe('Need candidate with more React experience.');

      // 2nd Request
      const r2 = await request(ctx.app.getHttpServer())
        .post('/join-requests')
        .set('Authorization', applicantToken)
        .send({
          projectId: 'proj-2',
          message: 'Application attempt number 2 with portfolio.',
        });
      expect(r2.status).toBe(201);

      // Owner rejects 2nd request
      const rej2 = await request(ctx.app.getHttpServer())
        .patch(`/join-requests/${r2.body.id}`)
        .set('Authorization', ownerToken)
        .send({
          status: 'rejected',
          reason: 'Still insufficient experience for this milestone.',
        });
      expect(rej2.status).toBe(200);

      // Check status: rejected_final, requestsUsed: 2, requestsLeft: 0
      const statusAfterRej2 = await request(ctx.app.getHttpServer())
        .get('/projects/proj-2/my-request-status')
        .set('Authorization', applicantToken);
      expect(statusAfterRej2.status).toBe(200);
      expect(statusAfterRej2.body.state).toBe('rejected_final');
      expect(statusAfterRej2.body.requestsUsed).toBe(2);
      expect(statusAfterRej2.body.requestsLeft).toBe(0);

      // 3rd Request attempt is refused with 409 REQUEST_LIMIT_REACHED
      const r3 = await request(ctx.app.getHttpServer())
        .post('/join-requests')
        .set('Authorization', applicantToken)
        .send({
          projectId: 'proj-2',
          message: 'Application attempt number 3 should fail.',
        });
      expect(r3.status).toBe(409);
      expect(r3.body.code).toBe('REQUEST_LIMIT_REACHED');
    });

    it('withdrawn request after 2 hours counts toward the 2-request limit', async () => {
      const applicantToken = ctx.loginAs('3');

      // Create request
      const r1 = await request(ctx.app.getHttpServer())
        .post('/join-requests')
        .set('Authorization', applicantToken)
        .send({
          projectId: 'proj-2',
          message: 'I want to apply for frontend role.',
        });
      expect(r1.status).toBe(201);

      // Advance clock past the 2-hour early-withdraw refund window (3 hours)
      ctx.advanceTime({ hours: 3 });

      // Withdraw request via DELETE
      const del = await request(ctx.app.getHttpServer())
        .delete(`/join-requests/${r1.body.id}`)
        .set('Authorization', applicantToken);
      expect(del.status).toBe(200);

      // Check request status: used = 1, left = 1
      const status = await request(ctx.app.getHttpServer())
        .get('/projects/proj-2/my-request-status')
        .set('Authorization', applicantToken);
      expect(status.status).toBe(200);
      expect(status.body.requestsUsed).toBe(1);
      expect(status.body.requestsLeft).toBe(1);
    });

    it('returns 409 PROJECT_CLOSED when applying to a closed project', async () => {
      // Close proj-2 directly via projects service
      ctx.projectsService.closeProject('proj-2', 'Testing project closure');

      const token = ctx.loginAs('3');
      const res = await request(ctx.app.getHttpServer())
        .post('/join-requests')
        .set('Authorization', token)
        .send({
          projectId: 'proj-2',
          message: 'Trying to apply to a closed project.',
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('PROJECT_CLOSED');
    });

    it('returns 403 BANNED when a user removed by owner tries to re-apply', async () => {
      const proj = ctx.projectsService.findById('proj-2');
      proj.removedUsers = [
        {
          userId: '5',
          userName: 'Vikram Malhotra',
          reason: 'Violated team code of conduct repeatedly.',
          removedAt: new Date().toISOString(),
        },
      ];

      const token = ctx.loginAs('5');
      const res = await request(ctx.app.getHttpServer())
        .post('/join-requests')
        .set('Authorization', token)
        .send({
          projectId: 'proj-2',
          message: 'Trying to re-apply after being removed.',
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('BANNED');
    });
  });

  describe('Owner Rejection & Notifications', () => {
    it('returns 400 REASON_REQUIRED when owner rejects without a 10+ character reason', async () => {
      const applicantToken = ctx.loginAs('3');
      const ownerToken = ctx.loginAs('2');

      const r = await request(ctx.app.getHttpServer())
        .post('/join-requests')
        .set('Authorization', applicantToken)
        .send({
          projectId: 'proj-2',
          message: 'Applying for developer position.',
        });

      // No reason
      const rej1 = await request(ctx.app.getHttpServer())
        .patch(`/join-requests/${r.body.id}`)
        .set('Authorization', ownerToken)
        .send({
          status: 'rejected',
        });
      expect(rej1.status).toBe(400);
      expect(rej1.body.code).toBe('REASON_REQUIRED');

      // Reason under 10 characters
      const rej2 = await request(ctx.app.getHttpServer())
        .patch(`/join-requests/${r.body.id}`)
        .set('Authorization', ownerToken)
        .send({
          status: 'rejected',
          reason: 'Too short',
        });
      expect(rej2.status).toBe(400);
      expect(rej2.body.code).toBe('REASON_REQUIRED');
    });

    it('returns 403 FORBIDDEN when a non-owner tries to reject a join request', async () => {
      const applicantToken = ctx.loginAs('3');
      const imposterToken = ctx.loginAs('5'); // Not the owner of proj-2

      const r = await request(ctx.app.getHttpServer())
        .post('/join-requests')
        .set('Authorization', applicantToken)
        .send({
          projectId: 'proj-2',
          message: 'Applying for developer position.',
        });

      const rej = await request(ctx.app.getHttpServer())
        .patch(`/join-requests/${r.body.id}`)
        .set('Authorization', imposterToken)
        .send({
          status: 'rejected',
          reason: 'Valid reason but imposter is rejecting.',
        });
      expect(rej.status).toBe(403);
    });

    it('notifies applicant with rejection reason on valid rejection', async () => {
      const applicantToken = ctx.loginAs('3');
      const ownerToken = ctx.loginAs('2');

      const r = await request(ctx.app.getHttpServer())
        .post('/join-requests')
        .set('Authorization', applicantToken)
        .send({
          projectId: 'proj-2',
          message: 'Applying for developer position.',
        });

      await request(ctx.app.getHttpServer())
        .patch(`/join-requests/${r.body.id}`)
        .set('Authorization', ownerToken)
        .send({
          status: 'rejected',
          reason: 'Required experience with NestJS is missing.',
        });

      // Applicant notifications
      const notifs = await request(ctx.app.getHttpServer())
        .get('/notifications')
        .set('Authorization', applicantToken);
      expect(notifs.status).toBe(200);

      const rejNotif = notifs.body.find((n: any) => n.type === 'APPLICATION_REJECTED');
      expect(rejNotif).toBeDefined();
      expect(rejNotif.message).toContain('Required experience with NestJS is missing.');
    });

    it('GET /join-requests/mine returns user requests with rejectionReason, requestsUsed, and requestsLeft', async () => {
      const applicantToken = ctx.loginAs('3');
      const ownerToken = ctx.loginAs('2');

      const r = await request(ctx.app.getHttpServer())
        .post('/join-requests')
        .set('Authorization', applicantToken)
        .send({
          projectId: 'proj-2',
          message: 'Applying for developer position.',
        });

      await request(ctx.app.getHttpServer())
        .patch(`/join-requests/${r.body.id}`)
        .set('Authorization', ownerToken)
        .send({
          status: 'rejected',
          reason: 'Candidate needs more frontend portfolio items.',
        });

      const mine = await request(ctx.app.getHttpServer())
        .get('/join-requests/mine')
        .set('Authorization', applicantToken);

      expect(mine.status).toBe(200);
      expect(Array.isArray(mine.body)).toBe(true);
      expect(mine.body.length).toBeGreaterThanOrEqual(1);

      const target = mine.body.find((item: any) => item.id === r.body.id);
      expect(target).toBeDefined();
      expect(target.rejectionReason).toBe('Candidate needs more frontend portfolio items.');
      expect(target.requestsUsed).toBe(1);
      expect(target.requestsLeft).toBe(1);
    });
  });

  describe('Leaving a Project (POST /projects/:id/leave)', () => {
    it('returns 400 REASON_REQUIRED when leave category or explanation is missing or invalid', async () => {
      // proj-2 collaborators: add User 3
      ctx.projectsService.addCollaborator('proj-2', { id: '3', name: 'Sneha Rao', role: 'Developer' });

      const token = ctx.loginAs('3');

      // Missing category
      const res1 = await request(ctx.app.getHttpServer())
        .post('/projects/proj-2/leave')
        .set('Authorization', token)
        .send({
          reason: 'Valid explanation over 10 characters long.',
        });
      expect(res1.status).toBe(400);
      expect(res1.body.code).toBe('REASON_REQUIRED');

      // Reason under 10 characters
      const res2 = await request(ctx.app.getHttpServer())
        .post('/projects/proj-2/leave')
        .set('Authorization', token)
        .send({
          category: 'Too busy',
          reason: 'Short',
        });
      expect(res2.status).toBe(400);
      expect(res2.body.code).toBe('REASON_REQUIRED');
    });

    it('returns 403 OWNER_CANNOT_LEAVE when project owner attempts to leave', async () => {
      // User 2 owns proj-2
      const token = ctx.loginAs('2');
      const res = await request(ctx.app.getHttpServer())
        .post('/projects/proj-2/leave')
        .set('Authorization', token)
        .send({
          category: 'Personal reasons',
          reason: 'Owner attempting to leave their own project.',
        });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('OWNER_CANNOT_LEAVE');
    });

    it('returns 403 MENTOR_CANNOT_LEAVE when a mentor attempts to leave', async () => {
      // User 4 (Rohan Mehta) is the mentor of proj-2
      const token = ctx.loginAs('4');
      const res = await request(ctx.app.getHttpServer())
        .post('/projects/proj-2/leave')
        .set('Authorization', token)
        .send({
          category: 'Personal reasons',
          reason: 'Mentor trying to leave the active project.',
        });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('MENTOR_CANNOT_LEAVE');
    });

    it('returns 403 NOT_A_MEMBER when non-member attempts to leave', async () => {
      // User 6 is a collaborator not in proj-1
      const token = ctx.loginAs('6');
      const res = await request(ctx.app.getHttpServer())
        .post('/projects/proj-1/leave')
        .set('Authorization', token)
        .send({
          category: 'Other',
          reason: 'Non-member trying to leave project.',
        });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('NOT_A_MEMBER');
    });

    it('returns 409 PROJECT_LOCKED when collaborator attempts to leave completed or closed project', async () => {
      ctx.projectsService.addCollaborator('proj-2', { id: '3', name: 'Sneha Rao', role: 'Developer' });
      ctx.projectsService.closeProject('proj-2', 'Project closed for policy test');

      const token = ctx.loginAs('3');
      const res = await request(ctx.app.getHttpServer())
        .post('/projects/proj-2/leave')
        .set('Authorization', token)
        .send({
          category: 'Too busy',
          reason: 'Leaving a closed project should be prevented.',
        });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('PROJECT_LOCKED');
    });

    it('successfully leaves project: frees slot, resets unapproved tasks, and notifies owner', async () => {
      // User 6 (Aditya Sai) is an approved collaborator on proj-2

      // Create an unapproved task assigned to User 6
      ctx.tasksService.create({
        projectId: 'proj-2',
        title: 'Task 1 - Unapproved',
        description: 'Should be reset to ToDo / unassigned upon collaborator leave',
        assigneeId: '6',
        assignee: 'Aditya Sai',
        priority: 'Medium' as any,
        status: 'in-progress' as any,
        dueDate: '2027-04-01T00:00:00.000Z',
      });

      const token = ctx.loginAs('6');
      const res = await request(ctx.app.getHttpServer())
        .post('/projects/proj-2/leave')
        .set('Authorization', token)
        .send({
          category: 'Too busy',
          reason: 'College exams and deadlines are taking up all my time.',
        });

      expect(res.status).toBe(201); // or 200

      // Verify member is no longer in collaborators
      const proj = ctx.projectsService.findById('proj-2');
      const isCollab = proj.collaborators?.some((c: any) => String(c.id || c.userId || c) === '6');
      expect(isCollab).toBe(false);

      // Verify owner received notification with category & explanation
      const ownerNotifs = await request(ctx.app.getHttpServer())
        .get('/notifications')
        .set('Authorization', ctx.loginAs('2'));
      const leaveNotif = ownerNotifs.body.find(
        (n: any) =>
          n.title === 'Collaborator Left Project' ||
          (n.type === 'TASK_RELEASED' && n.referenceId === 'proj-2'),
      );
      expect(leaveNotif).toBeDefined();
      expect(leaveNotif.message).toContain('Too busy');
      expect(leaveNotif.message).toContain('College exams and deadlines');

      // Verify task was reset to Unassigned & Open (ToDo)
      const tasks = ctx.tasksService.findAllByProjectId('proj-2');
      const resetTask = tasks.find((t: any) => t.title === 'Task 1 - Unapproved');
      expect(resetTask).toBeDefined();
      expect(resetTask?.assignee || resetTask?.assignedTo).toBe('Unassigned');
      expect(String(resetTask?.status).replace(/\s+/g, '').toLowerCase()).toBe('todo');
    });
  });

  describe('Auto-Closing Empty Projects via JobsService', () => {
    it('Day 4: sends reminder once to owner of empty project', async () => {
      // Create empty project owned by User 2
      const emptyProj = ctx.projectsRepository.create('2', {
        name: 'Empty Project for Day 4 test',
        desc: 'Testing inactivity reminder on day 4.',
        dueDate: '2027-12-31T00:00:00.000Z',
        skills: ['React'],
      } as any, 'open' as any);
      emptyProj.collaborators = [];
      emptyProj.createdAt = ctx.clockService.now();

      // Advance clock by 96 hours (4 days)
      ctx.advanceTime({ hours: 96 });

      const result = await ctx.jobsService.closeEmptyProjects();
      expect(result.remindersSent).toContain(emptyProj.id);

      // Verify owner received notification
      const ownerNotifs = await request(ctx.app.getHttpServer())
        .get('/notifications')
        .set('Authorization', ctx.loginAs('2'));
      const reminder = ownerNotifs.body.find(
        (n: any) =>
          String(n.title || '').startsWith('Project Inactivity Reminder') &&
          (n.referenceId === emptyProj.id || n.metadata?.projectIds?.includes(emptyProj.id)),
      );
      expect(reminder).toBeDefined();

      // Second run: reminder is not resent (idempotent)
      const result2 = await ctx.jobsService.closeEmptyProjects();
      expect(result2.remindersSent).toHaveLength(0);
    });

    it('Day 5: closes empty project with reason "No applicants within 5 days"', async () => {
      const emptyProj = ctx.projectsRepository.create('2', {
        name: 'Empty Project for Day 5 test',
        desc: 'Testing auto-closure on day 5.',
        dueDate: '2027-12-31T00:00:00.000Z',
        skills: ['React'],
      } as any, 'open' as any);
      emptyProj.collaborators = [];
      emptyProj.createdAt = ctx.clockService.now();

      // Advance clock by 120 hours (5 days)
      ctx.advanceTime({ hours: 120 });

      const result = await ctx.jobsService.closeEmptyProjects();
      expect(result.closedProjects).toContain(emptyProj.id);

      const updatedProj = ctx.projectsService.findById(emptyProj.id);
      expect(updatedProj.status).toBe('Closed');
      expect(updatedProj.closureReason).toBe('No applicants within 5 days');

      // Running job again does not re-close or fail
      const result2 = await ctx.jobsService.closeEmptyProjects();
      expect(result2.closedProjects).toHaveLength(0);
    });

    it('Day 5: pending join requests pause auto-closing and remind owner to decide', async () => {
      const emptyProj = ctx.projectsRepository.create('2', {
        name: 'Empty Project with Pending for Day 5 test',
        desc: 'Testing auto-closure paused by pending application.',
        dueDate: '2027-12-31T00:00:00.000Z',
        skills: ['React'],
      } as any, 'open' as any);
      emptyProj.collaborators = [];
      emptyProj.createdAt = ctx.clockService.now();

      // Submit a pending request
      const applicantToken = ctx.loginAs('3');
      await request(ctx.app.getHttpServer())
        .post('/join-requests')
        .set('Authorization', applicantToken)
        .send({
          projectId: emptyProj.id,
          message: 'Pending applicant awaiting owner decision.',
        });

      // Advance clock by 120 hours (5 days)
      ctx.advanceTime({ hours: 120 });

      const result = await ctx.jobsService.closeEmptyProjects();
      // Project is paused, NOT closed
      expect(result.closedProjects).toHaveLength(0);
      expect(result.pausedProjects).toContain(emptyProj.id);

      const updatedProj = ctx.projectsService.findById(emptyProj.id);
      expect(String(updatedProj.status).toLowerCase()).toBe('open');

      // Owner receives pause notification
      const ownerNotifs = await request(ctx.app.getHttpServer())
        .get('/notifications')
        .set('Authorization', ctx.loginAs('2'));
      const pauseNotif = ownerNotifs.body.find(
        (n: any) =>
          String(n.title || '').startsWith('Pending Applications Require Decision') &&
          (n.referenceId === emptyProj.id || n.metadata?.projectIds?.includes(emptyProj.id)),
      );
      expect(pauseNotif).toBeDefined();
    });
  });
});
