import request from 'supertest';
import { createTestApp, TestAppContext } from './helpers/test-helpers';

describe('STEP 1 DIAGNOSIS: One Role Per Person In A Project', () => {
  let ctx: TestAppContext;
  let server: any;

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('runs S1, S2, and S3 diagnosis and dumps project records', async () => {
    console.log('\n=== STARTING STEP 1 DIAGNOSIS ===\n');
    const ownerToken = ctx.loginAs('1'); // Priya Patel (Owner)
    const mentorToken = ctx.loginAs('3'); // Kiran Bose (Mentor)

    // Create fresh test users for clean diagnosis
    // User A: mentor account (User 7 - Neha Gupta, has mentor profile)
    // User B: student account (User 6 - Aditya Sai or clean new collaborator)
    const userAToken = ctx.loginAs('7'); // Neha Gupta (has mentor profile 'mentor-profile-1')
    const userBToken = ctx.loginAs('5'); // Sneha Iyer (has mentor profile 'mentor-profile-4')

    const validDescription =
      'This is an extensive and comprehensive diagnostic project designed to rigorously test role collisions, collaborator removal, and member counts in TeamForge platform.';

    // -------------------------------------------------------------
    // SCENARIO S1:
    // Owner, collaborators A (User 7, has mentor profile) and B (User 5).
    // Owner removes B. Read members list and count after each step.
    // -------------------------------------------------------------
    console.log('-------------------------------------------------------------');
    console.log('SCENARIO S1: Reproduce removal of B when A has mentor profile');
    console.log('-------------------------------------------------------------');

    // 1. Create project by owner
    const createProjRes = await request(server)
      .post('/projects')
      .set('Authorization', ownerToken)
      .send({
        title: 'Diagnostic Test Project S1',
        description: validDescription,
        requiredSkills: ['TypeScript', 'React'],
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      });
    const projectId = createProjRes.body.id;
    console.log(`[S1] Created Project: ${projectId}`);

    // 2. Add collaborator A (User 7 - Neha Gupta, who has mentor profile 'mentor-profile-1')
    const joinARes = await request(server)
      .post('/join-requests')
      .set('Authorization', userAToken)
      .send({
        projectId,
        role: 'Collaborator',
        message: 'Applying as collaborator A for diagnostic testing',
      });
    console.log(`[S1] Join Request A (User 7): status ${joinARes.status}`);
    const joinAId = joinARes.body.id;

    const approveARes = await request(server)
      .put(`/join-requests/${joinAId}`)
      .set('Authorization', ownerToken)
      .send({ status: 'approved' });
    console.log(`[S1] Approved A: status ${approveARes.status}`);

    // 3. Add collaborator B (User 5 - Sneha Iyer)
    const joinBRes = await request(server)
      .post('/join-requests')
      .set('Authorization', userBToken)
      .send({
        projectId,
        role: 'Collaborator',
        message: 'Applying as collaborator B for diagnostic testing',
      });
    console.log(`[S1] Join Request B (User 5): status ${joinBRes.status}`);
    const joinBId = joinBRes.body.id;

    const approveBRes = await request(server)
      .put(`/join-requests/${joinBId}`)
      .set('Authorization', ownerToken)
      .send({ status: 'approved' });
    console.log(`[S1] Approved B: status ${approveBRes.status}`);

    // Dump project record before removal
    const projBeforeRes = await request(server)
      .get(`/projects/${projectId}`)
      .set('Authorization', ownerToken);

    console.log('\n[S1 BEFORE REMOVAL OF B]');
    console.log('collaborators:', JSON.stringify(projBeforeRes.body.collaborators, null, 2));
    console.log('mentor fields: mentorId =', projBeforeRes.body.mentorId, ', mentor =', projBeforeRes.body.mentor);
    console.log('members:', JSON.stringify(projBeforeRes.body.members, null, 2));
    console.log('members count in API response:', projBeforeRes.body.members?.length);

    // 4. Owner removes B (User 5)
    const removeBRes = await request(server)
      .delete(`/projects/${projectId}/members/5`)
      .set('Authorization', ownerToken)
      .send({ reason: 'Removing collaborator B for project downsizing and diagnostic tests' });
    console.log(`\n[S1] Remove B (User 5): status ${removeBRes.status}`);

    // Dump project record after removal
    const projAfterRes = await request(server)
      .get(`/projects/${projectId}`)
      .set('Authorization', ownerToken);

    console.log('\n[S1 AFTER REMOVAL OF B]');
    console.log('collaborators:', JSON.stringify(projAfterRes.body.collaborators, null, 2));
    console.log('mentor fields: mentorId =', projAfterRes.body.mentorId, ', mentor =', projAfterRes.body.mentor);
    console.log('members:', JSON.stringify(projAfterRes.body.members, null, 2));
    console.log('members count in API response:', projAfterRes.body.members?.length);

    // Check linked mentor sessions for this project
    const sessionsRes = await request(server)
      .get(`/mentor-marketplace/sessions/mine`)
      .set('Authorization', ownerToken);
    const projSessions = Array.isArray(sessionsRes.body)
      ? sessionsRes.body.filter((s: any) => s.projectId === projectId)
      : [];
    console.log('Linked mentor sessions count:', projSessions.length);

    // -------------------------------------------------------------
    // SCENARIO S2:
    // User M (with mentor profile) is an approved collaborator.
    // Owner books M as project mentor, M accepts, owner pays.
    // -------------------------------------------------------------
    console.log('\n-------------------------------------------------------------');
    console.log('SCENARIO S2: Booking collaborator M as mentor');
    console.log('-------------------------------------------------------------');
    // User 7 (Neha Gupta, mentor-profile-1) is currently an approved collaborator on projectId!
    const bookMRes = await request(server)
      .post('/mentor-marketplace/sessions/book')
      .set('Authorization', ownerToken)
      .send({
        mentorId: 'mentor-profile-1',
        projectId,
        subject: 'Architecture review',
        projectDescription: 'Comprehensive diagnostic project testing role collisions in TeamForge platform.',
      });
    console.log(`[S2] Book collaborator M as mentor: status ${bookMRes.status}`);
    console.log('[S2] Book response body:', JSON.stringify(bookMRes.body));

    if (bookMRes.status === 201 || bookMRes.status === 200) {
      const sessionId = bookMRes.body.session?.id;
      // M accepts
      const acceptRes = await request(server)
        .post(`/mentor-marketplace/sessions/${sessionId}/accept`)
        .set('Authorization', userAToken);
      console.log(`[S2] Mentor accepts session: status ${acceptRes.status}`);
      console.log('[S2] Accept response body:', JSON.stringify(acceptRes.body));

      // Owner pays
      const payRes = await request(server)
        .post(`/mentor-marketplace/sessions/${sessionId}/confirm-payment`)
        .set('Authorization', ownerToken)
        .send({ idempotencyKey: 'diag-pay-1' });
      console.log(`[S2] Owner confirms payment: status ${payRes.status}`);
      console.log('[S2] Pay response body:', JSON.stringify(payRes.body));
    }

    // -------------------------------------------------------------
    // SCENARIO S3:
    // M is the assigned mentor first; then M applies, is invited, or is approved as collaborator.
    // -------------------------------------------------------------
    console.log('\n-------------------------------------------------------------');
    console.log('SCENARIO S3: Assigned mentor applies, is invited, or approved as collaborator');
    console.log('-------------------------------------------------------------');
    // proj-1 has ownerId: '1', mentorId: '3' (Kiran Bose) already assigned!
    const proj1BeforeRes = await request(server)
      .get('/projects/proj-1')
      .set('Authorization', ownerToken);
    console.log('[S3 BEFORE] proj-1 mentor:', proj1BeforeRes.body.mentorId, proj1BeforeRes.body.mentor);
    console.log('[S3 BEFORE] proj-1 collaborators count:', proj1BeforeRes.body.collaborators?.length);
    console.log('[S3 BEFORE] proj-1 members count:', proj1BeforeRes.body.members?.length);

    // Case 3a: Mentor (User 3) applies as collaborator to proj-1
    const mentorAppliesRes = await request(server)
      .post('/join-requests')
      .set('Authorization', mentorToken)
      .send({
        projectId: 'proj-1',
        role: 'Collaborator',
        message: 'Mentor trying to apply as collaborator for diagnostic testing',
      });
    console.log(`[S3a] Assigned mentor applies: status ${mentorAppliesRes.status}`);
    console.log('[S3a] Response body:', JSON.stringify(mentorAppliesRes.body));

    // Case 3c: If application succeeded, owner approves mentor application:
    if (mentorAppliesRes.status === 201) {
      const approveMentorAppRes = await request(server)
        .put(`/join-requests/${mentorAppliesRes.body.id}`)
        .set('Authorization', ownerToken)
        .send({ status: 'approved' });
      console.log(`[S3c] Owner approves mentor application: status ${approveMentorAppRes.status}`);
      console.log('[S3c] Response body:', JSON.stringify(approveMentorAppRes.body));
    }

    // Read proj-1 after mentor was approved as collaborator!
    const proj1AfterApprovalRes = await request(server)
      .get('/projects/proj-1')
      .set('Authorization', ownerToken);
    console.log('\n[S3 AFTER APPROVING MENTOR AS COLLABORATOR]');
    console.log('proj-1 mentorId:', proj1AfterApprovalRes.body.mentorId, 'mentor:', proj1AfterApprovalRes.body.mentor);
    console.log('proj-1 collaborators:', JSON.stringify(proj1AfterApprovalRes.body.collaborators, null, 2));
    console.log('proj-1 members:', JSON.stringify(proj1AfterApprovalRes.body.members, null, 2));
    console.log('proj-1 members count:', proj1AfterApprovalRes.body.members?.length);

    // Case 3b: Test owner inviting assigned mentor on a separate project where mentor has no pending request
    // Create proj-s3-invite
    const projS3Res = await request(server)
      .post('/projects')
      .set('Authorization', ownerToken)
      .send({
        title: 'Diagnostic Test Project S3 Invite',
        description: validDescription,
        requiredSkills: ['TypeScript', 'React'],
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      });
    const projS3Id = projS3Res.body.id;

    // Assign User 3 as mentor on projS3Id by booking, accepting, and paying:
    const bookS3Res = await request(server)
      .post('/mentor-marketplace/sessions/book')
      .set('Authorization', ownerToken)
      .send({
        mentorId: 'mentor-profile-3',
        projectId: projS3Id,
        subject: 'Diagnostic mentorship',
        projectDescription: validDescription,
      });
    if (bookS3Res.status === 201) {
      await request(server)
        .post(`/mentor-marketplace/sessions/${bookS3Res.body.session.id}/accept`)
        .set('Authorization', mentorToken);
      await request(server)
        .post(`/mentor-marketplace/sessions/${bookS3Res.body.session.id}/confirm-payment`)
        .set('Authorization', ownerToken)
        .send({ idempotencyKey: 'diag-pay-s3' });
    }

    // Now User 3 is verified assigned mentor on projS3Id.
    // Now Owner invites User 3 (username: 'kiranbose')
    const ownerInvitesMentorRes = await request(server)
      .post(`/projects/${projS3Id}/invites`)
      .set('Authorization', ownerToken)
      .send({
        username: 'kiranbose',
        message: 'Inviting assigned mentor as collaborator',
      });
    console.log(`[S3b] Owner invites assigned mentor: status ${ownerInvitesMentorRes.status}`);
    console.log('[S3b] Response body:', JSON.stringify(ownerInvitesMentorRes.body));

    if (ownerInvitesMentorRes.status === 201) {
      // Mentor accepts the invite:
      const acceptInviteRes = await request(server)
        .post(`/invites/${ownerInvitesMentorRes.body.id}/accept`)
        .set('Authorization', mentorToken);
      console.log(`[S3b] Assigned mentor accepts invite: status ${acceptInviteRes.status}`);
      console.log('[S3b] Accept invite response:', JSON.stringify(acceptInviteRes.body));
    }

    // Case 3d: Owner applies or is invited to their own project
    const ownerAppliesRes = await request(server)
      .post('/join-requests')
      .set('Authorization', ownerToken)
      .send({
        projectId: 'proj-1',
        role: 'Collaborator',
        message: 'Owner applying to own project diagnostic test',
      });
    console.log(`\n[S3d] Owner applies to own project: status ${ownerAppliesRes.status}`);
    console.log('[S3d] Response body:', JSON.stringify(ownerAppliesRes.body));

    const ownerInvitedRes = await request(server)
      .post('/projects/proj-1/invites')
      .set('Authorization', ownerToken)
      .send({
        username: 'priyapatel',
        message: 'Inviting owner to own project',
      });
    console.log(`[S3d] Owner invites themselves to own project: status ${ownerInvitedRes.status}`);
    console.log('[S3d] Response body:', JSON.stringify(ownerInvitedRes.body));

    console.log('\n=== DIAGNOSIS COMPLETE ===');
  });
});
