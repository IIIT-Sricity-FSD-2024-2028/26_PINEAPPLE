import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, TestAppContext } from './helpers/test-helpers';
import { EscrowService } from '../src/escrow/escrow.service';
import { EscrowState } from '../src/escrow/entities/escrow-account.entity';
import { UserRole, UserStatus } from '../src/users/dto/create-user.dto';

describe('Phase 27 E2E API Tests: Admin Support Inbox & Project Closure Actions', () => {
  let ctx: TestAppContext;
  let app: INestApplication;
  let server: any;
  let ownerToken: string;
  let collabToken: string;
  let otherCollabToken: string;
  let mentorToken: string;
  let adminSupportToken: string;
  let adminNoSupportToken: string;
  let superuserToken: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;
    server = app.getHttpServer();

    ownerToken = ctx.loginAs('1', [], { email: 'priya.patel@teamforge.io', role: 'project-owner' });
    collabToken = ctx.loginAs('2', [], { email: 'arjun.sharma@teamforge.io', role: 'collaborator' });
    otherCollabToken = ctx.loginAs('3', [], { email: 'kiran.bose@teamforge.io', role: 'collaborator' });
    mentorToken = ctx.loginAs('7', [], { email: 'neha.gupta@teamforge.io', role: 'mentor' });
    adminSupportToken = ctx.loginAs('admin', ['support', 'reports']);
    adminNoSupportToken = ctx.loginAs('admin', ['users', 'projects']);
    superuserToken = ctx.loginAs('superuser');
  });

  beforeEach(() => {
    ctx.resetStores();
    ctx.clockService.setTime('2026-11-12T10:00:00.000Z');
    ctx.usersRepository.update('1', { emailVerified: true, digestEnabled: false } as any);
    ctx.usersRepository.update('2', { emailVerified: true, digestEnabled: false } as any);
    ctx.usersRepository.update('3', { emailVerified: true, digestEnabled: false } as any);
    ctx.usersRepository.update('7', { emailVerified: true, digestEnabled: false } as any);
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Enforces ticket ownership (404 across users), visitor email rule, admin "support" permission (403), and hides internal notes', async () => {
    // Visitor without email is rejected 400
    const badVisitor = await request(server)
      .post('/support/tickets')
      .send({ subject: 'Visitor missing email', message: 'Anonymous visitor trying without email.' });
    expect(badVisitor.status).toBe(400);

    // Visitor with email succeeds
    const okVisitor = await request(server)
      .post('/support/tickets')
      .send({
        type: 'help',
        email: 'visitor.guest@example.com',
        subject: 'Visitor Account Question',
        message: 'Can I sign up with my university email account?',
      });
    expect(okVisitor.status).toBe(201);
    expect(okVisitor.body.type).toBe('help');
    expect(okVisitor.body.from).toBe('visitor.guest@example.com');

    // Logged-in collaborator opens ticket
    const createRes = await request(server)
      .post('/support/tickets')
      .set('Authorization', collabToken)
      .send({
        type: 'help',
        subject: 'Cannot upload proof PDF',
        message: 'Getting an error when uploading my milestone document.',
      });
    expect(createRes.status).toBe(201);
    const ticketId = createRes.body.id;

    // Another collaborator cannot read this ticket -> 404 TICKET_NOT_FOUND
    const crossRead = await request(server)
      .get(`/support/tickets/${ticketId}`)
      .set('Authorization', otherCollabToken);
    expect(crossRead.status).toBe(404);
    expect(crossRead.body.code).toBe('TICKET_NOT_FOUND');

    // Collaborator cannot access any admin support route -> 403
    const collabAdminRes = await request(server)
      .get('/admin/support/tickets')
      .set('Authorization', collabToken);
    expect(collabAdminRes.status).toBe(403);

    // Admin WITHOUT "support" permission -> 403
    const deniedAdminList = await request(server)
      .get('/admin/support/tickets')
      .set('Authorization', adminNoSupportToken);
    expect(deniedAdminList.status).toBe(403);

    const deniedAdminPatch = await request(server)
      .patch(`/admin/support/tickets/${ticketId}`)
      .set('Authorization', adminNoSupportToken)
      .send({ status: 'in_progress' });
    expect(deniedAdminPatch.status).toBe(403);

    // Admin WITH "support" permission lists, filters, pages (newest first), assigns, replies (public + internal), and resolves with note
    const supportList = await request(server)
      .get('/admin/support/tickets?type=help&page=1&limit=10')
      .set('Authorization', adminSupportToken);
    expect(supportList.status).toBe(200);
    expect(supportList.body.total).toBeGreaterThanOrEqual(2);
    expect(supportList.body.items[0].id).toBe(ticketId);

    // Assign to Super User ('u-superuser' / seeded super user)
    const suUser = ctx.usersRepository.findAll().find((u) => String(u.role).toLowerCase().includes('super'))!;
    const assignRes = await request(server)
      .patch(`/admin/support/tickets/${ticketId}`)
      .set('Authorization', adminSupportToken)
      .send({ assigneeId: suUser.id, priority: 'high', status: 'in_progress' });
    expect(assignRes.status).toBe(200);
    expect(assignRes.body.assigneeId).toBe(suUser.id);
    expect(assignRes.body.status).toBe('in_progress');
    expect(assignRes.body.priority).toBe('high');

    // Internal note + public reply
    const internalRes = await request(server)
      .post(`/admin/support/tickets/${ticketId}/replies`)
      .set('Authorization', adminSupportToken)
      .send({ body: 'Internal debug note for admins only.', internal: true });
    expect([200, 201]).toContain(internalRes.status);

    const publicRes = await request(server)
      .post(`/admin/support/tickets/${ticketId}/replies`)
      .set('Authorization', adminSupportToken)
      .send({ body: 'Public support reply: please retry with PDF <= 5MB.', internal: false });
    expect([200, 201]).toContain(publicRes.status);

    // User reads ticket -> sees ONLY public reply, never internal note
    const userRead = await request(server)
      .get(`/support/tickets/${ticketId}`)
      .set('Authorization', collabToken);
    expect(userRead.status).toBe(200);
    expect(userRead.body.replies).toHaveLength(1);
    expect(userRead.body.replies[0].body).toContain('please retry with PDF');

    // Resolving without note -> 400 NOTE_REQUIRED
    const noNoteResolve = await request(server)
      .patch(`/admin/support/tickets/${ticketId}`)
      .set('Authorization', adminSupportToken)
      .send({ status: 'resolved', note: 'short' });
    expect(noNoteResolve.status).toBe(400);
    expect(noNoteResolve.body.code).toBe('NOTE_REQUIRED');

    // Resolve with valid note -> 200
    const resolvedRes = await request(server)
      .patch(`/admin/support/tickets/${ticketId}`)
      .set('Authorization', adminSupportToken)
      .send({ status: 'resolved', note: 'Confirmed file upload limit guidance was shared with user.' });
    expect(resolvedRes.status).toBe(200);
    expect(resolvedRes.body.status).toBe('resolved');

    // Resolved ticket cannot be reopened -> 409 TICKET_CLOSED (or legacy INVALID_STATUS_CHANGE)
    const reopenRes = await request(server)
      .patch(`/admin/support/tickets/${ticketId}`)
      .set('Authorization', adminSupportToken)
      .send({ status: 'open' });
    expect(reopenRes.status).toBe(409);
    expect(['INVALID_STATUS_CHANGE', 'TICKET_CLOSED']).toContain(reopenRes.body.code);

    // User cannot reply to resolved ticket -> 409, but can open a linked follow-up
    const lockedReply = await request(server)
      .post(`/support/tickets/${ticketId}/replies`)
      .set('Authorization', collabToken)
      .send({ body: 'Reply after resolved should fail.' });
    expect(lockedReply.status).toBe(409);

    const followUp = await request(server)
      .post('/support/tickets')
      .set('Authorization', collabToken)
      .send({
        type: 'help',
        subject: 'Follow-up on PDF error',
        message: 'Still seeing the upload error even after reducing size below 5MB.',
        parentTicketId: ticketId,
      });
    expect(followUp.status).toBe(201);
    expect(followUp.body.parentTicketId).toBe(ticketId);

    // Check required audit log entries were recorded
    const auditActions = ctx.auditService.findAll().map((a) => a.action);
    expect(auditActions).toEqual(
      expect.arrayContaining(['TICKET_ASSIGNED', 'TICKET_STATUS_CHANGED', 'TICKET_REPLY']),
    );
  });

  it('2. Closure ticket close-project closes abandoned project ("Owner inactive"), processes Phase 9 escrow refund, notifies all parties, resolves ticket, and blocks 2nd close', async () => {
    // Setup owner inactive project with collaborator '2' and funded pending session with mentor '7'
    const proj = ctx.projectsService.create('1', {
      title: 'Abandoned E2E Escrow Project',
      description: 'Project with inactive owner, active collaborator, and pending escrow mentor booking to verify closure ticket.',
      teamSize: 4,
      dueDate: '2027-06-01T00:00:00.000Z',
    });
    ctx.projectsService.addCollaborator(proj.id, { id: '2', name: 'Arjun Sharma', role: 'Collaborator' });

    const mentorProfile = ctx.mentorMarketplaceService.listMentors({ includeOwnForOwnerId: '__none__' } as any)[0] || {
      id: 'mentor-profile-neha',
      userId: '7',
    };
    const bookRes = await ctx.mentorMarketplaceService.bookSession('1', {
      mentorId: mentorProfile.id,
      projectId: proj.id,
      projectDescription: 'Architecture session',
      scheduledAt: '2026-12-15T10:00:00.000Z',
    } as any);
    await ctx.mentorMarketplaceService.confirmPayment(bookRes.session.id, '1');

    // Flag 30d owner inactivity so collaborator can raise Phase 12 closure request
    ctx.projectsRepository.update(proj.id, { ownerInactive30d: true } as any);

    const reqCloseRes = await request(server)
      .post(`/projects/${proj.id}/request-close`)
      .set('Authorization', collabToken)
      .send({ reason: 'Project owner has not logged in for 30+ days.' });
    expect(reqCloseRes.status).toBe(200);
    const closureTicketId = reqCloseRes.body.ticketId;
    expect(closureTicketId).toBeTruthy();

    // Admin fetches ticket -> sees type project_closure, high priority, and live projectFacts
    const ticketDetail = await request(server)
      .get(`/admin/support/tickets/${closureTicketId}`)
      .set('Authorization', adminSupportToken);
    expect(ticketDetail.status).toBe(200);
    expect(ticketDetail.body.type).toBe('project_closure');
    expect(ticketDetail.body.priority).toBe('high');
    expect(ticketDetail.body.projectFacts?.projectId).toBe(proj.id);
    expect(ticketDetail.body.projectFacts?.escrowHeldAmount).toBeGreaterThan(0);

    ctx.notificationsService.reset();

    // SuperUser or Admin with support permission closes project from ticket
    const closeActionRes = await request(server)
      .post(`/admin/support/tickets/${closureTicketId}/close-project`)
      .set('Authorization', adminSupportToken)
      .send({ reason: 'Verified 30+ days owner inactivity; closing project and refunding pending escrow.' });
    expect(closeActionRes.status).toBe(200);
    expect(closeActionRes.body.ticket.status).toBe('resolved');
    expect(closeActionRes.body.ticket.resolutionNote).toContain('Verified 30+ days owner inactivity');

    // Verify project closed with Owner inactive & Phase 9 escrow refunded
    const updatedProj = ctx.projectsRepository.findById(proj.id)!;
    expect(updatedProj.status).toBe('Closed');
    expect(updatedProj.closureReason).toBe('Owner inactive');

    const sessionsAfter = ctx.mentorMarketplaceService.getSessionsByProject(proj.id);
    expect(sessionsAfter[0].status).toBe('refunded');
    const escrows = ctx.app.get(EscrowService, { strict: false });
    if (escrows) {
      const e = escrows.findAll().find((x: any) => x.mentorSessionId === sessionsAfter[0].id);
      expect(e?.status).toBe(EscrowState.Refunded);
    }

    // Notifications reached owner ('1'), collaborator ('2'), and mentor ('7')
    expect(ctx.notificationsService.findByUser('1').length).toBeGreaterThanOrEqual(1);
    expect(ctx.notificationsService.findByUser('2').some((n) => n.type === 'PROJECT_CLOSED')).toBe(true);
    expect(ctx.notificationsService.findByUser('7').length).toBeGreaterThanOrEqual(1);

    // Audit recorded PROJECT_CLOSED_FROM_TICKET
    expect(ctx.auditService.findAll().some((a) => a.action === 'PROJECT_CLOSED_FROM_TICKET')).toBe(true);

    // Second click gets 409 TICKET_CLOSED (or PROJECT_NOT_CLOSABLE)
    const secondCloseRes = await request(server)
      .post(`/admin/support/tickets/${closureTicketId}/close-project`)
      .set('Authorization', superuserToken)
      .send({ reason: 'Duplicate close attempt should fail cleanly with 409.' });
    expect(secondCloseRes.status).toBe(409);
    expect(['PROJECT_NOT_CLOSABLE', 'TICKET_CLOSED']).toContain(secondCloseRes.body.code);

    expect(mentorToken).toBeTruthy();
    expect(ownerToken).toBeTruthy();
    expect(UserRole.Collaborator).toBeTruthy();
    expect(UserStatus.Active).toBeTruthy();
  });
});
