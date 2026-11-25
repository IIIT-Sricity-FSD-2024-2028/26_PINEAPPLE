import { BadRequestException } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, TestAppContext } from '../../test/helpers/test-helpers';
import { UserStatus } from '../users/dto/create-user.dto';

describe('AdminService - Phase 1 Moderation Core Unit/Logic Tests', () => {
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

  describe('Warning Rules', () => {
    it('rejects warning with explanation shorter than 10 characters', () => {
      expect(() =>
        ctx.adminService.warnUser('2', { reason: 'Too short' }),
      ).toThrow(BadRequestException);
    });

    it('issues warnings with incrementing active count and titles notification as Warning N/4', async () => {
      // User 2: Arjun Sharma (starts with 0 active warnings)
      const res1 = ctx.adminService.warnUser('2', {
        reason: 'Inappropriate language in chat channel',
      });
      expect(res1.activeWarningsCount).toBe(1);

      // Verify email was sent
      const sentMails = ctx.mailServiceMock.getSentMails();
      const warnMail1 = sentMails.find((m) => m.type === 'warning' && m.to === res1.email);
      expect(warnMail1).toBeDefined();
      expect(warnMail1?.warningNumber).toBe(1);

      // Verify notification title is "Warning 1/4"
      const notifs1 = ctx.notificationsService.findByUser('2');
      const warnNotif1 = notifs1.find((n) => n.title === 'Warning 1/4');
      expect(warnNotif1).toBeDefined();
      expect(warnNotif1?.message).toContain('Inappropriate language in chat channel');

      // 2nd warning
      const res2 = ctx.adminService.warnUser('2', {
        reason: 'Missed task deadline repeatedly',
      });
      expect(res2.activeWarningsCount).toBe(2);
      const notifs2 = ctx.notificationsService.findByUser('2');
      expect(notifs2.some((n) => n.title === 'Warning 2/4')).toBe(true);

      // 3rd warning
      const res3 = ctx.adminService.warnUser('2', {
        reason: 'Uncooperative behavior with teammates',
      });
      expect(res3.activeWarningsCount).toBe(3);
      const notifs3 = ctx.notificationsService.findByUser('2');
      expect(notifs3.some((n) => n.title === 'Warning 3/4')).toBe(true);
    });

    it('triggers automatic suspension on the 4th active warning with reason "Automatic suspension after 4 warnings"', async () => {
      // Give 3 warnings first
      ctx.adminService.warnUser('2', { reason: 'First infraction explanation here' });
      ctx.adminService.warnUser('2', { reason: 'Second infraction explanation here' });
      ctx.adminService.warnUser('2', { reason: 'Third infraction explanation here' });

      // 4th warning triggers automatic suspension
      const res4 = ctx.adminService.warnUser('2', { reason: 'Fourth infraction explanation here' });
      expect(res4.status).toBe(UserStatus.Suspended);
      expect(res4.suspensionReason).toBe('Automatic suspension after 4 warnings');

      // Suspension email must be sent
      const sentMails = ctx.mailServiceMock.getSentMails();
      const suspMail = sentMails.find(
        (m) => m.type === 'suspension' && m.reason === 'Automatic suspension after 4 warnings',
      );
      expect(suspMail).toBeDefined();
    });
  });

  describe('Manual Suspension & Reactivation Rules', () => {
    it('manual suspension requires at least 10 characters explanation', () => {
      expect(() =>
        ctx.adminService.suspendUser('2', { reason: 'bad' }),
      ).toThrow(BadRequestException);
    });

    it('manual suspension sends email only (no notification to suspended user)', async () => {
      ctx.mailServiceMock.clearSentMails();
      const beforeNotifCount = ctx.notificationsService.findByUser('2').length;

      const suspended = ctx.adminService.suspendUser('2', {
        reason: 'Severe violations of platform conduct policy',
      });
      expect(suspended.status).toBe(UserStatus.Suspended);
      expect(suspended.suspensionReason).toBe('Severe violations of platform conduct policy');

      // Mail sent
      const sentMails = ctx.mailServiceMock.getSentMails();
      const suspMail = sentMails.find((m) => m.type === 'suspension');
      expect(suspMail).toBeDefined();
      expect(suspMail?.reason).toBe('Severe violations of platform conduct policy');

      // NO notification created for the suspended user
      const afterNotifCount = ctx.notificationsService.findByUser('2').length;
      expect(afterNotifCount).toBe(beforeNotifCount);
    });

    it('reactivation requires at least 10 characters explanation', () => {
      expect(() =>
        ctx.adminService.reactivateUser('2', { reason: 'ok' }),
      ).toThrow(BadRequestException);
    });

    it('reactivation resets activeWarningsCount to 0, preserves history, and sends notification only', async () => {
      // First, warn the user twice
      ctx.adminService.warnUser('2', { reason: 'First violation explanation here' });
      ctx.adminService.warnUser('2', { reason: 'Second violation explanation here' });

      // Suspend user
      ctx.adminService.suspendUser('2', {
        reason: 'Conduct review pending investigation',
      });

      ctx.mailServiceMock.clearSentMails();

      // Reactivate user
      const reactivated = ctx.adminService.reactivateUser('2', {
        reason: 'Investigation concluded with warning acknowledgement',
      });

      expect(reactivated.status).toBe(UserStatus.Active);
      expect(reactivated.activeWarningsCount).toBe(0); // Cleared to 0!
      expect(reactivated.reactivationReason).toBe('Investigation concluded with warning acknowledgement');

      // Warning history is preserved
      expect(reactivated.warnings.length).toBeGreaterThanOrEqual(2);

      // Notification sent to user
      const notifs = ctx.notificationsService.findByUser('2');
      const reactNotif = notifs.find((n) => n.type === 'ACCOUNT_REACTIVATED');
      expect(reactNotif).toBeDefined();
      expect(reactNotif?.message).toContain('Investigation concluded with warning acknowledgement');

      // NO email sent on reactivation
      const sentMails = ctx.mailServiceMock.getSentMails();
      expect(sentMails).toHaveLength(0);

      // Next warning starts again at 1/4
      const nextWarn = ctx.adminService.warnUser('2', {
        reason: 'Post-reactivation infraction explanation',
      });
      expect(nextWarn.activeWarningsCount).toBe(1);
      const postNotifs = ctx.notificationsService.findByUser('2');
      expect(postNotifs.some((n) => n.title === 'Warning 1/4')).toBe(true);
    });
  });

  describe('Suspension Cascades', () => {
    it('suspending collaborator returns Open and In-Progress tasks to Unassigned & Open, keeps In-Review, and notifies owner', async () => {
      // User '2' (Arjun Sharma) is collaborator on 'proj-1'.
      // Task-1 is Completed.
      // Let's create an In-Progress task and an In-Review task assigned to '2'.
      const inProgressTask = ctx.tasksService.create({
        projectId: 'proj-1',
        title: 'Build API Gateway Proxy',
        description: 'Proxy routing implementation',
        xpReward: 40,
        status: 'in-progress' as any,
        assigneeId: '2',
        dueDate: '2027-01-01T00:00:00.000Z',
      });

      const inReviewTask = ctx.tasksService.create({
        projectId: 'proj-1',
        title: 'Write Documentation Guides',
        description: 'Documentation for team',
        xpReward: 30,
        status: 'in review' as any,
        assigneeId: '2',
        dueDate: '2027-01-01T00:00:00.000Z',
      });

      // Suspend user 2
      ctx.adminService.suspendUser('2', {
        reason: 'Violation of project guidelines and policies',
      });

      // Check task states:
      const updatedInProgress = ctx.tasksService.findById(inProgressTask.id);
      expect(updatedInProgress.assignee).toBe('Unassigned');
      expect(updatedInProgress.assigneeId).toBeUndefined();
      expect(updatedInProgress.status).toBe('To Do'); // returned to Open / To Do

      const updatedInReview = ctx.tasksService.findById(inReviewTask.id);
      // In-Review stays for owner decision
      expect(updatedInReview.assigneeId).toBe('2');

      // Project owner (User 1, Priya Patel) was notified
      const ownerNotifs = ctx.notificationsService.findByUser('1');
      const releaseNotif = ownerNotifs.find((n) => n.type === 'TASK_RELEASED');
      expect(releaseNotif).toBeDefined();
      expect(releaseNotif?.message).toContain('Build API Gateway Proxy');
    });

    it('suspending owner closes all owned projects with "Owner suspended", which cannot be reopened on owner reactivation', async () => {
      // User 1 owns 'proj-1'
      const projBefore = ctx.projectsService.findById('proj-1');
      expect(projBefore.status).not.toBe('closed');

      // Suspend owner
      ctx.adminService.suspendUser('1', {
        reason: 'Owner suspended for platform violations',
      });

      const projAfter = ctx.projectsService.findById('proj-1');
      expect(String(projAfter.status).toLowerCase()).toBe('closed');
      expect(projAfter.closureReason).toBe('Owner suspended');

      // Project is locked: cannot create tasks
      expect(ctx.projectsService.isLocked(projAfter)).toBe(true);

      // Reactivate owner: closed projects remain closed
      ctx.adminService.reactivateUser('1', {
        reason: 'Owner appeal accepted and reactivated',
      });

      const projAfterReactivation = ctx.projectsService.findById('proj-1');
      expect(String(projAfterReactivation.status).toLowerCase()).toBe('closed');
      expect(projAfterReactivation.closureReason).toBe('Owner suspended');
    });
  });

  describe('Admin Users Endpoint and DTO Policy', () => {
    it('GET /admin/users returns user list and behaves gracefully per DTO policy when filter=warned is sent', async () => {
      const adminToken = ctx.loginAs('admin', ['users', '*']);
      const res = await request(ctx.app.getHttpServer())
        .get('/admin/users?filter=warned')
        .set('Authorization', adminToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      const firstUser = res.body[0];
      expect(firstUser).toHaveProperty('id');
      expect(firstUser).toHaveProperty('name');
    });

    it('adminService.getUsers() returns all eligible users without filtering by warned', () => {
      const users = ctx.adminService.getUsers();
      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBeGreaterThan(0);
      const userIds = users.map((u: any) => u.id);
      expect(userIds).toContain('2'); // Arjun Sharma
      expect(userIds).toContain('3'); // Neha Sharma
    });
  });
});
