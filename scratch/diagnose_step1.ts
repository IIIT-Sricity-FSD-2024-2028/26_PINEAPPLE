import request from 'supertest';
import { createTestApp, TestAppContext } from '../back-end/test/helpers/test-helpers';

async function runDiagnosis() {
  console.log('=== STARTING STEP 1 DIAGNOSIS ===\n');
  const ctx: TestAppContext = await createTestApp();
  const server = ctx.app.getHttpServer();
  const ownerToken = ctx.loginAs('1'); // Priya Patel (Owner)
  const mentorToken = ctx.loginAs('3'); // Kiran Bose (Mentor)
  const collabBToken = ctx.loginAs('8'); // Vikram Nair

  try {
    // -------------------------------------------------------------
    // SCENARIO S1:
    // Owner, collaborators A (User 3, has mentor profile) and B (User 8).
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
        description: 'Comprehensive diagnostic project testing role collisions, collaborator removal, and member counts.',
        requiredSkills: ['TypeScript', 'React'],
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      });
    const projectId = createProjRes.body.id;
    console.log(`[S1] Created Project: ${projectId}`);

    // 2. Add collaborator A (User 3 - Kiran Bose, who has mentor profile 'mentor-profile-3')
    // We add via join request + approve (or invites)
    const joinARes = await request(server)
      .post('/join-requests')
      .set('Authorization', mentorToken)
      .send({
        projectId,
        role: 'Collaborator',
        message: 'Applying as collaborator A',
      });
    console.log(`[S1] Join Request A (User 3 - Mentor Profile): status ${joinARes.status}`);
    const joinAId = joinARes.body.id;

    // Approve A
    const approveARes = await request(server)
      .put(`/join-requests/${joinAId}`)
      .set('Authorization', ownerToken)
      .send({ status: 'approved' });
    console.log(`[S1] Approved A: status ${approveARes.status}`);

    // 3. Add collaborator B (User 8 - Vikram Nair)
    const joinBRes = await request(server)
      .post('/join-requests')
      .set('Authorization', collabBToken)
      .send({
        projectId,
        role: 'Collaborator',
        message: 'Applying as collaborator B',
      });
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

    // 4. Owner removes B
    const removeBRes = await request(server)
      .delete(`/projects/${projectId}/members/8`)
      .set('Authorization', ownerToken)
      .send({ reason: 'Removing collaborator B for project downsizing' });
    console.log(`\n[S1] Remove B (User 8): status ${removeBRes.status}`);

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
      .get(`/mentor-marketplace/sessions/student`)
      .set('Authorization', ownerToken);
    const projSessions = (sessionsRes.body || []).filter((s: any) => s.projectId === projectId);
    console.log('Linked mentor sessions count:', projSessions.length);

    // -------------------------------------------------------------
    // SCENARIO S2:
    // User M (with mentor profile) is an approved collaborator.
    // Owner books M as project mentor, M accepts, owner pays.
    // -------------------------------------------------------------
    console.log('\n-------------------------------------------------------------');
    console.log('SCENARIO S2: Booking collaborator M as mentor');
    console.log('-------------------------------------------------------------');
    // In our project, User 3 (Kiran Bose) is currently an approved collaborator!
    // Try to book User 3 (mentor-profile-3) as mentor:
    const bookMRes = await request(server)
      .post('/mentor-marketplace/sessions/book')
      .set('Authorization', ownerToken)
      .send({
        mentorId: 'mentor-profile-3',
        projectId,
        subject: 'Architecture review',
      });
    console.log(`[S2] Book collaborator M as mentor: status ${bookMRes.status}`);
    console.log('[S2] Book response body:', JSON.stringify(bookMRes.body));

    if (bookMRes.status === 201 || bookMRes.status === 200) {
      const sessionId = bookMRes.body.session?.id;
      // M accepts
      const acceptRes = await request(server)
        .post(`/mentor-marketplace/sessions/${sessionId}/accept`)
        .set('Authorization', mentorToken);
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
    // Let's create a fresh project with User 3 as assigned mentor
    // Note: proj-1 has ownerId: '1', mentorId: '3' (Kiran Bose) already assigned!
    const proj1Res = await request(server)
      .get('/projects/proj-1')
      .set('Authorization', ownerToken);
    console.log('[S3] proj-1 mentor:', proj1Res.body.mentorId, proj1Res.body.mentor);

    // Case 3a: Mentor (User 3) applies as collaborator to proj-1
    const mentorAppliesRes = await request(server)
      .post('/join-requests')
      .set('Authorization', mentorToken)
      .send({
        projectId: 'proj-1',
        role: 'Collaborator',
        message: 'Mentor trying to apply as collaborator',
      });
    console.log(`[S3a] Assigned mentor applies: status ${mentorAppliesRes.status}`);
    console.log('[S3a] Response body:', JSON.stringify(mentorAppliesRes.body));

    // Case 3b: Owner invites assigned mentor (User 3, username: 'kiranbose')
    const ownerInvitesMentorRes = await request(server)
      .post('/projects/proj-1/invites')
      .set('Authorization', ownerToken)
      .send({
        username: 'kiranbose',
        message: 'Inviting assigned mentor as collaborator',
      });
    console.log(`[S3b] Owner invites assigned mentor: status ${ownerInvitesMentorRes.status}`);
    console.log('[S3b] Response body:', JSON.stringify(ownerInvitesMentorRes.body));

    // Case 3c: What if an application was submitted (if status was 201), does owner approval succeed?
    if (mentorAppliesRes.status === 201) {
      const approveMentorAppRes = await request(server)
        .put(`/join-requests/${mentorAppliesRes.body.id}`)
        .set('Authorization', ownerToken)
        .send({ status: 'approved' });
      console.log(`[S3c] Owner approves mentor application: status ${approveMentorAppRes.status}`);
      console.log('[S3c] Response body:', JSON.stringify(approveMentorAppRes.body));
    }

    // Case 3d: Owner applies or is invited to their own project
    const ownerAppliesRes = await request(server)
      .post('/join-requests')
      .set('Authorization', ownerToken)
      .send({
        projectId: 'proj-1',
        role: 'Collaborator',
        message: 'Owner applying to own project',
      });
    console.log(`[S3d] Owner applies to own project: status ${ownerAppliesRes.status}`);
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

  } finally {
    await ctx.app.close();
    console.log('\n=== DIAGNOSIS COMPLETE ===');
  }
}

runDiagnosis().catch((err) => {
  console.error('Diagnosis error:', err);
  process.exit(1);
});
