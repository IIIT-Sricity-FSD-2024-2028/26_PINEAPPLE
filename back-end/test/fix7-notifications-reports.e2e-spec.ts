import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, TestAppContext } from './helpers/test-helpers';
import { NotificationsService } from '../src/notifications/notifications.service';
import { ReportsService } from '../src/moderation/reports.service';
import { CommunicationRepository } from '../src/communication/communication.repository';
import { ProjectsRepository } from '../src/projects/projects.repository';
import { ProjectStatus, ProjectDifficulty } from '../src/projects/dto/create-project.dto';

describe('Fix 7 E2E Tests: Notifications Read-All & Chat Reports Visibility', () => {
  let ctx: TestAppContext;
  let app: INestApplication;
  let server: any;
  let notificationsService: NotificationsService;
  let reportsService: ReportsService;
  let commsRepo: CommunicationRepository;
  let projectsRepo: ProjectsRepository;

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;
    server = app.getHttpServer();
    notificationsService = app.get(NotificationsService);
    reportsService = app.get(ReportsService);
    commsRepo = app.get(CommunicationRepository);
    projectsRepo = app.get(ProjectsRepository);
  });

  beforeEach(() => {
    ctx.resetStores();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('ITEM 10: Bulk Mark All Read & Route Ordering', () => {
    it('PATCH /notifications/read-all with 3 unread returns updated: 3, unread: 0; second call returns updated: 0', async () => {
      const userAToken = ctx.loginAs('2');

      // Clear any prior seed unread notifications for User 2 & User 3 so we have a clean slate
      notificationsService.markAllAsRead('2');
      notificationsService.markAllAsRead('3');

      // Create 3 unread immediate notifications for User 2
      notificationsService.create({
        userId: '2',
        type: 'PROJECT_UPDATE',
        title: 'Notif 1',
        message: 'Message 1',
        readStatus: false,
      });
      notificationsService.create({
        userId: '2',
        type: 'PROJECT_UPDATE',
        title: 'Notif 2',
        message: 'Message 2',
        readStatus: false,
      });
      notificationsService.create({
        userId: '2',
        type: 'PROJECT_UPDATE',
        title: 'Notif 3',
        message: 'Message 3',
        readStatus: false,
      });

      // User 3 also has an unread notification
      notificationsService.create({
        userId: '3',
        type: 'PROJECT_UPDATE',
        title: 'User 3 Notif',
        message: 'User 3 Message',
        readStatus: false,
      });

      // Check unread count before
      const countRes1 = await request(server)
        .get('/notifications/unread-count')
        .set('Authorization', userAToken);
      expect(countRes1.status).toBe(200);
      expect(countRes1.body.unreadCount).toBe(3);

      // First call to PATCH /notifications/read-all
      const res1 = await request(server)
        .patch('/notifications/read-all')
        .set('Authorization', userAToken);

      expect(res1.status).toBe(200);
      expect(res1.body).toEqual({ updated: 3, unread: 0 });

      // Second call is idempotent and returns updated: 0, unread: 0
      const res2 = await request(server)
        .patch('/notifications/read-all')
        .set('Authorization', userAToken);

      expect(res2.status).toBe(200);
      expect(res2.body).toEqual({ updated: 0, unread: 0 });

      // Check unread count after for User 2
      const countRes2 = await request(server)
        .get('/notifications/unread-count')
        .set('Authorization', userAToken);
      expect(countRes2.status).toBe(200);
      expect(countRes2.body.unreadCount).toBe(0);

      // User 3's notifications remain untouched and unread
      const userBToken = ctx.loginAs('3');
      const countResB = await request(server)
        .get('/notifications/unread-count')
        .set('Authorization', userBToken);
      expect(countResB.status).toBe(200);
      expect(countResB.body.unreadCount).toBe(1);
    });

    it('requires authentication (no token returns 401)', async () => {
      const res = await request(server).patch('/notifications/read-all');
      expect(res.status).toBe(401);
    });

    it('route order test: read-all and unread-count are NOT mistaken for :id', async () => {
      const userToken = ctx.loginAs('2');

      // If GET /notifications/unread-count was matched by GET /notifications/:id, it would throw 404 NOTIFICATION_NOT_FOUND
      const getCount = await request(server)
        .get('/notifications/unread-count')
        .set('Authorization', userToken);
      expect(getCount.status).toBe(200);
      expect(getCount.body.unreadCount).toBeDefined();

      // If PATCH /notifications/read-all was matched by an :id route, it would throw 404
      const patchReadAll = await request(server)
        .patch('/notifications/read-all')
        .set('Authorization', userToken);
      expect(patchReadAll.status).toBe(200);
      expect(patchReadAll.body.unread).toBe(0);

      // PUT /notifications/read-all alias also works without :id collision
      const putReadAll = await request(server)
        .put('/notifications/read-all')
        .set('Authorization', userToken);
      expect(putReadAll.status).toBe(200);
      expect(putReadAll.body.unread).toBe(0);
    });

    it('single-item read and delete routes still work and reject other users with 404', async () => {
      const user2Token = ctx.loginAs('2');
      const user3Token = ctx.loginAs('3');

      const notif1 = notificationsService.create({
        userId: '2',
        type: 'PROJECT_UPDATE',
        title: 'Single Read Test',
        message: 'Only user 2',
        readStatus: false,
      });

      // User 3 cannot read user 2's notification -> 404
      const failRead = await request(server)
        .put(`/notifications/${notif1.id}/read`)
        .set('Authorization', user3Token);
      expect(failRead.status).toBe(404);

      // User 2 marks own notification as read with PUT -> 200
      const okRead = await request(server)
        .put(`/notifications/${notif1.id}/read`)
        .set('Authorization', user2Token);
      expect(okRead.status).toBe(200);
      expect(okRead.body.readStatus).toBe(true);

      // PATCH alias also works
      const okPatchRead = await request(server)
        .patch(`/notifications/${notif1.id}/read`)
        .set('Authorization', user2Token);
      expect(okPatchRead.status).toBe(200);
      expect(okPatchRead.body.readStatus).toBe(true);

      // User 3 cannot delete user 2's notification -> 404
      const failDel = await request(server)
        .delete(`/notifications/${notif1.id}`)
        .set('Authorization', user3Token);
      expect(failDel.status).toBe(404);

      // User 2 deletes own notification -> 200
      const okDel = await request(server)
        .delete(`/notifications/${notif1.id}`)
        .set('Authorization', user2Token);
      expect(okDel.status).toBe(200);
    });

    it('GET /notifications/unread-count matches the list of unread items', async () => {
      const userToken = ctx.loginAs('2');
      notificationsService.markAllAsRead('2');

      notificationsService.create({
        userId: '2',
        type: 'PROJECT_UPDATE',
        title: 'Item A',
        message: 'Msg A',
        readStatus: false,
      });
      notificationsService.create({
        userId: '2',
        type: 'PROJECT_UPDATE',
        title: 'Item B',
        message: 'Msg B',
        readStatus: true,
      });
      notificationsService.create({
        userId: '2',
        type: 'PROJECT_UPDATE',
        title: 'Item C',
        message: 'Msg C',
        readStatus: false,
      });

      const countRes = await request(server)
        .get('/notifications/unread-count')
        .set('Authorization', userToken);
      expect(countRes.status).toBe(200);
      expect(countRes.body.unreadCount).toBe(2);

      const listRes = await request(server)
        .get('/notifications')
        .set('Authorization', userToken);
      expect(listRes.status).toBe(200);
      const unreadInList = listRes.body.filter((n: any) => !n.readStatus).length;
      expect(unreadInList).toBe(countRes.body.unreadCount);
    });
  });

  describe('ITEM 9: Chat Reports Visibility & Admin Queue', () => {
    let projectId: string;
    let messageId: string;

    beforeEach(() => {
      // Create project with owner '1' and collaborators '2' and '3'
      const proj = projectsRepo.create(
        '1',
        {
          title: 'Secure Chat Project',
          description: 'Testing chat reports visibility',
          difficulty: ProjectDifficulty.Easy,
          requiredSkills: ['Node.js'],
          duration: '1 Month',
        } as any,
        ProjectStatus.InProgress,
      );
      projectId = proj.id;
      // Add collaborator '2' and '3'
      projectsRepo.addCollaborator(projectId, { id: '2', name: 'User 2', role: 'Collaborator' });
      projectsRepo.addCollaborator(projectId, { id: '3', name: 'User 3', role: 'Collaborator' });

      // Create message from user '3' (Sarah Chen - non-admin)
      const msg = commsRepo.sendMessage(
        '3',
        { projectId, content: 'This message violates safety policies' } as any,
        'Collaborator',
      );
      messageId = msg.id;
    });

    it('member reports message: appears in admin reports list with type chat_message and context snapshot', async () => {
      const memberToken = ctx.loginAs('2');
      const adminToken = ctx.loginAs('admin');

      // Admin open count before
      const countBefore = await request(server)
        .get('/admin/reports/open-count')
        .set('Authorization', adminToken);
      expect(countBefore.status).toBe(200);
      const initialOpen = countBefore.body.openCount;

      // Member '2' reports message from user '3'
      const reportRes = await request(server)
        .post(`/communication/messages/${messageId}/report`)
        .set('Authorization', memberToken)
        .send({ reason: 'This chat message violates acceptable conduct standards.' });

      expect(reportRes.status).toBe(201);
      const reportId = reportRes.body.id;

      // Admin open count increases by 1
      const countAfter = await request(server)
        .get('/admin/reports/open-count')
        .set('Authorization', adminToken);
      expect(countAfter.status).toBe(200);
      expect(countAfter.body.openCount).toBe(initialOpen + 1);

      // Admin queries reports list
      const adminList = await request(server)
        .get('/admin/reports')
        .set('Authorization', adminToken);
      expect(adminList.status).toBe(200);

      const foundReport = adminList.body.items.find((r: any) => r.id === reportId);
      expect(foundReport).toBeDefined();
      expect(foundReport.type).toBe('chat_message');
      expect(foundReport.reportedMessage.content).toBe('This message violates safety policies');
      expect(foundReport.messageSnapshot).toBeDefined();
      expect(foundReport.messageSnapshot.length).toBeGreaterThan(0);
      expect(foundReport.projectName).toBe('Secure Chat Project');
      expect(foundReport.reporter.id).toBe('2');
      expect(foundReport.reportedUser.id).toBe('3');
    });

    it('report does NOT appear for collaborators, owners, or the reported user', async () => {
      const memberToken = ctx.loginAs('2');
      const reportedUserToken = ctx.loginAs('3');
      const ownerToken = ctx.loginAs('1');

      // Member '2' reports message
      await request(server)
        .post(`/communication/messages/${messageId}/report`)
        .set('Authorization', memberToken)
        .send({ reason: 'Inappropriate remark in team channel.' });

      // Non-admins cannot access /admin/reports
      const collAdminAccess = await request(server)
        .get('/admin/reports')
        .set('Authorization', memberToken);
      expect(collAdminAccess.status).toBe(403);

      const reportedUserAdminAccess = await request(server)
        .get('/admin/reports')
        .set('Authorization', reportedUserToken);
      expect(reportedUserAdminAccess.status).toBe(403);

      // Reported user '3' checks own reports at /reports/mine -> knows nothing about the report against them
      const reportedUserMine = await request(server)
        .get('/reports/mine')
        .set('Authorization', reportedUserToken);
      expect(reportedUserMine.status).toBe(200);
      expect(reportedUserMine.body.length).toBe(0);

      // Owner checks /reports/mine -> knows nothing unless they were the reporter
      const ownerMine = await request(server)
        .get('/reports/mine')
        .set('Authorization', ownerToken);
      expect(ownerMine.status).toBe(200);
      expect(ownerMine.body.length).toBe(0);
    });

    it('GET /reports/mine returns only caller reports, displays Received status, and hides admin notes', async () => {
      const memberToken = ctx.loginAs('2');

      const reportRes = await request(server)
        .post(`/communication/messages/${messageId}/report`)
        .set('Authorization', memberToken)
        .send({ reason: 'Report details for privacy check.' });

      // Admin adds a private note
      const adminToken = ctx.loginAs('admin');
      await request(server)
        .patch(`/admin/reports/${reportRes.body.id}/status`)
        .set('Authorization', adminToken)
        .send({ status: 'Under review', note: 'Top secret internal moderator note' });

      // Reporter calls GET /reports/mine
      const mineRes = await request(server)
        .get('/reports/mine')
        .set('Authorization', memberToken);

      expect(mineRes.status).toBe(200);
      expect(mineRes.body.length).toBe(1);
      const myReport = mineRes.body[0];

      expect(myReport.id).toBe(reportRes.body.id);
      expect(myReport.status).toBe('Under review');
      expect(myReport.projectName).toBe('Secure Chat Project');
      // Must NOT contain private admin notes
      expect(myReport.adminNote).toBeUndefined();
    });

    it('deciding the report sends exactly one notification to reporter with no sanction details; reported user notification omits reporter', async () => {
      const memberToken = ctx.loginAs('2');
      const adminToken = ctx.loginAs('admin');

      const reportRes = await request(server)
        .post(`/communication/messages/${messageId}/report`)
        .set('Authorization', memberToken)
        .send({ reason: 'Repeated offensive remarks in group chat.' });
      const reportId = reportRes.body.id;

      // Admin resolves the report with action: warn on user '3'
      const actionRes = await request(server)
        .post(`/admin/reports/${reportId}/action`)
        .set('Authorization', adminToken)
        .send({
          action: 'warn',
          reason: 'Violation of professional communication policy.',
        });
      expect([200, 201]).toContain(actionRes.status);

      // Reporter '2' receives exactly ONE notification
      const reporterNotifs = notificationsService.findByUser('2');
      const decisionNotifs = reporterNotifs.filter(
        (n) => n.title === 'Your report was reviewed' || n.message.includes('Your report was reviewed'),
      );
      expect(decisionNotifs.length).toBe(1);
      const decisionNotif = decisionNotifs[0];
      expect(decisionNotif.title).toBe('Your report was reviewed');
      expect(decisionNotif.message).toContain('Resolved');
      // Crucial privacy rule: never reveals the sanction given (e.g. warn/suspend) to reporter
      expect(decisionNotif.message.toLowerCase()).not.toContain('warn');
      expect(decisionNotif.message.toLowerCase()).not.toContain('suspend');

      // Reported user '3' receives warning notification without the reporter's identity
      const reportedUserNotifs = notificationsService.findByUser('3');
      const warningNotif = reportedUserNotifs.find((n) => n.type === 'WARNING');
      expect(warningNotif).toBeDefined();
      expect(warningNotif?.message).not.toContain('2');
      expect(warningNotif?.message).not.toContain('User 2');
    });

    it('admin open reports count goes up on report creation and down when resolved or dismissed', async () => {
      const memberToken = ctx.loginAs('2');
      const adminToken = ctx.loginAs('admin');

      const before = await request(server)
        .get('/admin/reports/open-count')
        .set('Authorization', adminToken);
      const count0 = before.body.openCount;

      const reportRes = await request(server)
        .post(`/communication/messages/${messageId}/report`)
        .set('Authorization', memberToken)
        .send({ reason: 'Disruptive content in workspace.' });

      const afterCreate = await request(server)
        .get('/admin/reports/open-count')
        .set('Authorization', adminToken);
      expect(afterCreate.body.openCount).toBe(count0 + 1);

      // Admin dismisses the report
      await request(server)
        .post(`/admin/reports/${reportRes.body.id}/action`)
        .set('Authorization', adminToken)
        .send({
          action: 'dismiss',
          reason: 'No policy violation identified.',
        });

      const afterDismiss = await request(server)
        .get('/admin/reports/open-count')
        .set('Authorization', adminToken);
      expect(afterDismiss.body.openCount).toBe(count0);
    });
  });
});
