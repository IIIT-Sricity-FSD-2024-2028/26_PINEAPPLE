import request from 'supertest';
import { createTestApp, TestAppContext } from './helpers/test-helpers';

describe('Step 4 Integration & E2E: Resolved or Rejected Support Tickets Must Be Read-Only', () => {
  let ctx: TestAppContext;
  let server: any;
  let adminSupportToken: string;
  let superuserToken: string;
  let collabToken: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer();

    adminSupportToken = ctx.loginAs('admin', ['support']);
    superuserToken = ctx.loginAs('superuser');
    collabToken = ctx.loginAs('2', [], { email: 'arjun.sharma@teamforge.io', role: 'collaborator' });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(() => {
    ctx.resetStores();
    ctx.clockService.setTime('2026-11-20T10:00:00.000Z');
  });

  it('1. Resolving a ticket requires a 10-500 char note (400 NOTE_REQUIRED when missing or short)', async () => {
    const createRes = await request(server)
      .post('/support/tickets')
      .set('Authorization', collabToken)
      .send({
        type: 'help',
        subject: 'Need help with build setup',
        message: 'Getting build failure when compiling the workspace frontend.',
      })
      .expect(201);
    const ticketId = createRes.body.id;

    // Try resolving without note
    const noNoteRes = await request(server)
      .patch(`/admin/support/tickets/${ticketId}`)
      .set('Authorization', adminSupportToken)
      .send({ status: 'resolved' })
      .expect(400);
    expect(noNoteRes.body.code).toBe('NOTE_REQUIRED');

    // Try resolving with note < 10 chars
    const shortNoteRes = await request(server)
      .patch(`/admin/support/tickets/${ticketId}`)
      .set('Authorization', adminSupportToken)
      .send({ status: 'resolved', note: 'Too short' })
      .expect(400);
    expect(shortNoteRes.body.code).toBe('NOTE_REQUIRED');

    // Resolve with valid note -> succeeds 200
    const validRes = await request(server)
      .patch(`/admin/support/tickets/${ticketId}`)
      .set('Authorization', adminSupportToken)
      .send({ status: 'resolved', note: 'Issue was solved by rebuilding node_modules cache.' })
      .expect(200);
    expect(validRes.body.status).toBe('resolved');
    expect(validRes.body.resolutionNote).toBe('Issue was solved by rebuilding node_modules cache.');
  });

  it('2. Once resolved or rejected: PATCH priority, assignee, status, note return 409 TICKET_CLOSED', async () => {
    for (const termStatus of ['resolved', 'rejected'] as const) {
      const createRes = await request(server)
        .post('/support/tickets')
        .set('Authorization', collabToken)
        .send({
          type: 'help',
          subject: `Testing read-only enforcement on ${termStatus}`,
          message: 'Detailed message describing the scenario for read-only validation.',
        })
        .expect(201);
      const ticketId = createRes.body.id;

      // Close ticket
      await request(server)
        .patch(`/admin/support/tickets/${ticketId}`)
        .set('Authorization', adminSupportToken)
        .send({
          status: termStatus,
          note: `Proper explanation note for moving to ${termStatus}.`,
        })
        .expect(200);

      // Snapshot stored ticket state
      const beforeState = JSON.stringify(ctx.supportService.findOne(ticketId));

      // 1. PATCH priority -> 409 TICKET_CLOSED
      const patchPriority = await request(server)
        .patch(`/admin/support/tickets/${ticketId}`)
        .set('Authorization', adminSupportToken)
        .send({ priority: 'high' })
        .expect(409);
      expect(patchPriority.body.code).toBe('TICKET_CLOSED');

      // 2. PATCH assignee -> 409 TICKET_CLOSED
      const patchAssignee = await request(server)
        .patch(`/admin/support/tickets/${ticketId}`)
        .set('Authorization', adminSupportToken)
        .send({ assigneeId: 'u-admin' })
        .expect(409);
      expect(patchAssignee.body.code).toBe('TICKET_CLOSED');

      // 3. PATCH status to same status -> 409 TICKET_CLOSED
      const patchSameStatus = await request(server)
        .patch(`/admin/support/tickets/${ticketId}`)
        .set('Authorization', adminSupportToken)
        .send({ status: termStatus })
        .expect(409);
      expect(patchSameStatus.body.code).toBe('TICKET_CLOSED');

      // 4. PATCH status to another status -> 409 TICKET_CLOSED
      const patchDiffStatus = await request(server)
        .patch(`/admin/support/tickets/${ticketId}`)
        .set('Authorization', adminSupportToken)
        .send({ status: 'open' })
        .expect(409);
      expect(patchDiffStatus.body.code).toBe('TICKET_CLOSED');

      // 5. PATCH note -> 409 TICKET_CLOSED
      const patchNote = await request(server)
        .patch(`/admin/support/tickets/${ticketId}`)
        .set('Authorization', adminSupportToken)
        .send({ note: 'Attempting to overwrite resolution note.' })
        .expect(409);
      expect(patchNote.body.code).toBe('TICKET_CLOSED');

      // Verify the stored ticket is byte-for-byte unchanged after all refused attempts
      const afterState = JSON.stringify(ctx.supportService.findOne(ticketId));
      expect(afterState).toBe(beforeState);
    }
  });

  it('3. Admin reply, internal note, user reply, and Close Project action return 409 TICKET_CLOSED', async () => {
    // Setup abandoned project & closure ticket
    const proj = ctx.projectsService.create('1', {
      title: 'Closure Abandoned Project',
      description: 'Comprehensive description of the test project for testing closure action refusal on closed tickets. Needs to be at least 100 chars.',
      teamSize: 4,
      dueDate: '2027-01-01T00:00:00.000Z',
    });

    const createRes = await request(server)
      .post('/support/tickets')
      .set('Authorization', collabToken)
      .send({
        type: 'help',
        subject: 'General inquiries regarding milestone',
        message: 'Detailed body text for testing replies on closed tickets.',
      })
      .expect(201);
    const ticketId = createRes.body.id;

    // Resolve ticket
    await request(server)
      .patch(`/admin/support/tickets/${ticketId}`)
      .set('Authorization', adminSupportToken)
      .send({ status: 'resolved', note: 'Resolution explanation note completed.' })
      .expect(200);

    const beforeState = JSON.stringify(ctx.supportService.findOne(ticketId));

    // Admin public reply -> 409 TICKET_CLOSED
    const adminReply = await request(server)
      .post(`/admin/support/tickets/${ticketId}/replies`)
      .set('Authorization', adminSupportToken)
      .send({ body: 'Public admin reply after resolution', internal: false })
      .expect(409);
    expect(adminReply.body.code).toBe('TICKET_CLOSED');

    // Admin internal note -> 409 TICKET_CLOSED
    const internalNote = await request(server)
      .post(`/admin/support/tickets/${ticketId}/replies`)
      .set('Authorization', adminSupportToken)
      .send({ body: 'Internal note after resolution', internal: true })
      .expect(409);
    expect(internalNote.body.code).toBe('TICKET_CLOSED');

    // User reply -> 409 TICKET_CLOSED
    const userReply = await request(server)
      .post(`/support/tickets/${ticketId}/replies`)
      .set('Authorization', collabToken)
      .send({ body: 'User reply after resolution' })
      .expect(409);
    expect(userReply.body.code).toBe('TICKET_CLOSED');

    // Close project action on resolved ticket -> 409 TICKET_CLOSED
    const closeAction = await request(server)
      .post(`/admin/support/tickets/${ticketId}/close-project`)
      .set('Authorization', adminSupportToken)
      .send({ reason: 'Attempting close on already closed ticket.' })
      .expect(409);
    expect(closeAction.body.code).toBe('TICKET_CLOSED');

    // Stored ticket is byte-for-byte unchanged
    const afterState = JSON.stringify(ctx.supportService.findOne(ticketId));
    expect(afterState).toBe(beforeState);
  });

  it('4. Super User is refused too (409 TICKET_CLOSED)', async () => {
    const createRes = await request(server)
      .post('/support/tickets')
      .set('Authorization', collabToken)
      .send({
        type: 'help',
        subject: 'Super user override test ticket',
        message: 'Checking that even super user cannot modify a resolved ticket.',
      })
      .expect(201);
    const ticketId = createRes.body.id;

    await request(server)
      .patch(`/admin/support/tickets/${ticketId}`)
      .set('Authorization', adminSupportToken)
      .send({ status: 'resolved', note: 'Resolution note for super user test.' })
      .expect(200);

    // Super user attempts PATCH priority
    const suPriority = await request(server)
      .patch(`/admin/support/tickets/${ticketId}`)
      .set('Authorization', superuserToken)
      .send({ priority: 'high' })
      .expect(409);
    expect(suPriority.body.code).toBe('TICKET_CLOSED');

    // Super user attempts PATCH assignee
    const suAssignee = await request(server)
      .patch(`/admin/support/tickets/${ticketId}`)
      .set('Authorization', superuserToken)
      .send({ assigneeId: 'u-superuser' })
      .expect(409);
    expect(suAssignee.body.code).toBe('TICKET_CLOSED');

    // Super user attempts reply
    const suReply = await request(server)
      .post(`/admin/support/tickets/${ticketId}/replies`)
      .set('Authorization', superuserToken)
      .send({ body: 'Super user trying to reply', internal: true })
      .expect(409);
    expect(suReply.body.code).toBe('TICKET_CLOSED');
  });

  it('5. Audit log contains TICKET_CHANGE_REFUSED with attempted fields and no user content', async () => {
    const createRes = await request(server)
      .post('/support/tickets')
      .set('Authorization', collabToken)
      .send({
        type: 'help',
        subject: 'Audit refusal test ticket',
        message: 'Confidential secret message in ticket body that must never leak to audit log.',
      })
      .expect(201);
    const ticketId = createRes.body.id;

    await request(server)
      .patch(`/admin/support/tickets/${ticketId}`)
      .set('Authorization', adminSupportToken)
      .send({ status: 'resolved', note: 'Resolution explanation note completed.' })
      .expect(200);

    const secretReply = 'SECRET_TOKEN_DO_NOT_LEAK_12345';
    await request(server)
      .post(`/admin/support/tickets/${ticketId}/replies`)
      .set('Authorization', adminSupportToken)
      .send({ body: secretReply, internal: false })
      .expect(409);

    await request(server)
      .patch(`/admin/support/tickets/${ticketId}`)
      .set('Authorization', adminSupportToken)
      .send({ priority: 'high', assigneeId: 'u-admin' })
      .expect(409);

    const auditEntries = ctx.auditService.findAll().filter((a) => a.action === 'TICKET_CHANGE_REFUSED');
    expect(auditEntries.length).toBeGreaterThanOrEqual(2);

    for (const entry of auditEntries) {
      expect(entry.details.ticketId).toBe(ticketId);
      expect(Array.isArray(entry.details.attemptedFields)).toBe(true);
      // Ensure no freeform text from the request body leaked into audit details
      const detailsStr = JSON.stringify(entry.details);
      expect(detailsStr).not.toContain(secretReply);
      expect(detailsStr).not.toContain('Confidential secret message');
    }
  });

  it('6. Setting priority and resolving in the SAME request works and leaves ticket read-only immediately after', async () => {
    const createRes = await request(server)
      .post('/support/tickets')
      .set('Authorization', collabToken)
      .send({
        type: 'help',
        subject: 'Combined update test ticket',
        message: 'Testing combined priority and resolution update in a single request.',
      })
      .expect(201);
    const ticketId = createRes.body.id;

    // Combined request: priority + resolution note + status: resolved
    const combinedRes = await request(server)
      .patch(`/admin/support/tickets/${ticketId}`)
      .set('Authorization', adminSupportToken)
      .send({
        priority: 'high',
        status: 'resolved',
        note: 'Issue was completely investigated and resolved.',
      })
      .expect(200);

    expect(combinedRes.body.status).toBe('resolved');
    expect(combinedRes.body.priority).toBe('high');
    expect(combinedRes.body.resolutionNote).toBe('Issue was completely investigated and resolved.');

    // Ticket is now read-only immediately after: further patch returns 409 TICKET_CLOSED
    const subsequentPatch = await request(server)
      .patch(`/admin/support/tickets/${ticketId}`)
      .set('Authorization', adminSupportToken)
      .send({ priority: 'normal' })
      .expect(409);
    expect(subsequentPatch.body.code).toBe('TICKET_CLOSED');
  });

  it('7. GET on the resolved ticket and its thread still works for the requester and admins', async () => {
    const createRes = await request(server)
      .post('/support/tickets')
      .set('Authorization', collabToken)
      .send({
        type: 'help',
        subject: 'Read thread test ticket',
        message: 'Testing thread reading on closed ticket.',
      })
      .expect(201);
    const ticketId = createRes.body.id;

    // Add public reply while open
    await request(server)
      .post(`/admin/support/tickets/${ticketId}/replies`)
      .set('Authorization', adminSupportToken)
      .send({ body: 'Admin public reply before closing.', internal: false })
      .expect(201);

    // Resolve ticket
    await request(server)
      .patch(`/admin/support/tickets/${ticketId}`)
      .set('Authorization', adminSupportToken)
      .send({ status: 'resolved', note: 'Resolution note for thread reading.' })
      .expect(200);

    // Admin can GET ticket detail
    const adminGet = await request(server)
      .get(`/admin/support/tickets/${ticketId}`)
      .set('Authorization', adminSupportToken)
      .expect(200);
    expect(adminGet.body.id).toBe(ticketId);
    expect(adminGet.body.status).toBe('resolved');
    expect(adminGet.body.resolutionNote).toBe('Resolution note for thread reading.');
    expect(adminGet.body.replies.length).toBe(1);

    // Requester can GET ticket detail
    const userGet = await request(server)
      .get(`/support/tickets/${ticketId}`)
      .set('Authorization', collabToken)
      .expect(200);
    expect(userGet.body.id).toBe(ticketId);
    expect(userGet.body.status).toBe('resolved');
    expect(userGet.body.resolutionNote).toBe('Resolution note for thread reading.');
    expect(userGet.body.replies.length).toBe(1);
  });
});
