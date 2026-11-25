async function run() {
  console.log('=== PHASE 1: REMOVE COLLABORATOR VERIFICATION ===\n');
  let passed = 0;
  let failed = 0;

  function assert(cond, name, details = '') {
    if (cond) {
      console.log(`  ✅ PASS: ${name} ${details ? `(${details})` : ''}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${name} ${details ? `(${details})` : ''}`);
      failed++;
    }
  }

  async function login(email, password) {
    const res = await fetch('http://localhost:3000/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(`Login failed for ${email}: ${JSON.stringify(data)}`);
    }
    return data.accessToken || data.token;
  }

  try {
    // 1. Authenticate Personas
    // Owner: Jathin (role: Project Owner, id: u-owner)
    const ownerToken = await login('jathin@example.com', 'password123');
    const ownerHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerToken}`,
    };

    // Collaborator: Arjun Sharma (role: Collaborator, id: 2)
    const collabToken = await login('arjun.sharma@teamforge.io', 'password123');
    const collabHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${collabToken}`,
    };

    // Admin: Priya Patel (id: 1, role: Administrator)
    const adminToken = await login('priya.patel@teamforge.io', 'password123');
    const adminHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    };

    // Collaborator 2: Aditya Sai (id: 6)
    const adityaToken = await login('aditya.sai@teamforge.io', 'password123');
    const adityaHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adityaToken}`,
    };

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const dueDate = futureDate.toISOString().split('T')[0];

    // Create a fresh test project owned by Jathin
    const createProjRes = await fetch('http://localhost:3000/projects', {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        title: 'Team Member Removal Live Test',
        description: 'Testing collaborator removal end-to-end with real auth',
        dueDate,
        requiredSkills: ['React', 'Node.js'],
        duration: '1 Month',
        maxCollaborators: 5,
      }),
    });
    const createProjData = await createProjRes.json();
    assert(createProjRes.status === 201, 'Owner creates test project', `id: ${createProjData?.id}`);
    const projectId = createProjData?.id;

    // Add Collaborator (Arjun Sharma, id 2) via join request apply + approve
    const applyRes = await fetch('http://localhost:3000/join-requests', {
      method: 'POST',
      headers: collabHeaders,
      body: JSON.stringify({
        projectId,
        userId: '2',
        userName: 'Arjun Sharma',
        message: 'I want to collaborate on this project',
      }),
    });
    const applyData = await applyRes.json();
    assert(applyRes.status === 201, 'Collaborator applies to project', `joinReqId: ${applyData?.id}`);
    const joinReqId = applyData?.id;

    // Owner approves the join request
    const approveRes = await fetch(`http://localhost:3000/join-requests/${joinReqId}`, {
      method: 'PUT',
      headers: ownerHeaders,
      body: JSON.stringify({ status: 'Approved' }),
    });
    const approveData = await approveRes.json();
    assert(approveRes.status === 200, 'Owner approves join request', `status: ${approveData?.status}`);

    // Create an unapproved task assigned to Arjun
    const taskRes = await fetch('http://localhost:3000/tasks', {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        projectId,
        title: 'Arjun Task 1',
        description: 'Implement auth module',
        assigneeId: '2',
        assigneeName: 'Arjun Sharma',
        priority: 'High',
        dueDate,
      }),
    });
    const taskData = await taskRes.json();
    assert(taskRes.status === 201, 'Task created for collaborator', `taskId: ${taskData?.id}`);
    const taskId = taskData?.id;

    // Check 1: Reason shorter than 10 chars is rejected with 400
    console.log('\n--- Check 1: Short reason rejected (< 10 chars) ---');
    const shortReasonRes = await fetch(`http://localhost:3000/projects/${projectId}/members/2`, {
      method: 'DELETE',
      headers: ownerHeaders,
      body: JSON.stringify({ reason: 'Short' }),
    });
    const shortReasonData = await shortReasonRes.json();
    assert(
      shortReasonRes.status === 400,
      'Short reason (< 10 chars) rejected with 400',
      shortReasonData?.message,
    );

    // Check 2: Collaborator calling removal endpoint receives 403 Forbidden
    console.log('\n--- Check 2: Collaborator calling removal endpoint receives 403 Forbidden ---');
    const collabRemoveRes = await fetch(`http://localhost:3000/projects/${projectId}/members/2`, {
      method: 'DELETE',
      headers: collabHeaders,
      body: JSON.stringify({ reason: 'Attempting unauthorized self or peer removal' }),
    });
    const collabRemoveData = await collabRemoveRes.json();
    assert(
      collabRemoveRes.status === 403,
      'Collaborator calling DELETE /projects/:id/members/:memberId receives 403',
      collabRemoveData?.message,
    );

    // Check 3: Another user/owner calling removal endpoint receives 403 Forbidden
    console.log('\n--- Check 3: Another user calling removal on project they do not own ---');
    const otherUserRemoveRes = await fetch(`http://localhost:3000/projects/${projectId}/members/2`, {
      method: 'DELETE',
      headers: adityaHeaders,
      body: JSON.stringify({ reason: 'Unauthorized third-party attempting member removal' }),
    });
    const otherUserData = await otherUserRemoveRes.json();
    assert(
      otherUserRemoveRes.status === 403,
      'Other user calling DELETE /members receives 403 Forbidden',
      otherUserData?.message,
    );

    // Check 4: Project owner cannot remove themselves (400 Bad Request)
    console.log('\n--- Check 4: Project owner cannot remove themselves ---');
    const selfRemoveRes = await fetch(`http://localhost:3000/projects/${projectId}/members/u-owner`, {
      method: 'DELETE',
      headers: ownerHeaders,
      body: JSON.stringify({ reason: 'Owner trying to remove themselves from project' }),
    });
    const selfRemoveData = await selfRemoveRes.json();
    assert(
      selfRemoveRes.status === 400,
      'Project owner removing themselves rejected with 400',
      selfRemoveData?.message,
    );

    // Check 5: Removing the mentor is refused (403 Forbidden)
    console.log('\n--- Check 5: Removing the project mentor is refused ---');
    // proj-1 has mentor Kiran Bose (id 3). Admin calling removal of mentor:
    const mentorRemoveRes = await fetch(`http://localhost:3000/projects/proj-1/members/3`, {
      method: 'DELETE',
      headers: adminHeaders,
      body: JSON.stringify({ reason: 'Trying to remove mentor from ongoing project' }),
    });
    const mentorRemoveData = await mentorRemoveRes.json();
    assert(
      mentorRemoveRes.status === 403,
      'Removing mentor from project refused with 403',
      mentorRemoveData?.message,
    );

    // Check 6: Removing from a locked (completed) project is refused (400 Bad Request)
    console.log('\n--- Check 6: Removing member from locked project is refused ---');
    const lockedProjRes = await fetch('http://localhost:3000/projects', {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        title: 'Temp Locked Project',
        description: 'For testing locked removal',
        requiredSkills: ['Node.js'],
        dueDate,
      }),
    });
    const lockedProjData = await lockedProjRes.json();
    const lockedProjId = lockedProjData.id;
    await fetch(`http://localhost:3000/projects/${lockedProjId}/complete`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({ finalLink: 'https://github.com/test/locked' }),
    });

    const lockedRemoveRes = await fetch(`http://localhost:3000/projects/${lockedProjId}/members/2`, {
      method: 'DELETE',
      headers: adminHeaders,
      body: JSON.stringify({ reason: 'Trying to remove member from completed project' }),
    });
    const lockedRemoveData = await lockedRemoveRes.json();
    assert(
      lockedRemoveRes.status === 400,
      'Removing member from locked/completed project refused with 400',
      lockedRemoveData?.message,
    );

    // Check 7: Owner successfully removes collaborator with >= 10 char reason
    console.log('\n--- Check 7: Owner successfully removes collaborator ---');
    const validRemoveRes = await fetch(`http://localhost:3000/projects/${projectId}/members/2`, {
      method: 'DELETE',
      headers: ownerHeaders,
      body: JSON.stringify({
        reason: 'Project scope shifted, collaborator no longer required on this project.',
      }),
    });
    const validRemoveData = await validRemoveRes.json();
    assert(
      validRemoveRes.status === 200,
      'Owner successfully removes collaborator (HTTP 200)',
      `Collabs count: ${validRemoveData?.collaborators?.length}`,
    );

    // Verify collaborator was removed from collaborators list
    const isStillCollab = (validRemoveData.collaborators || []).some(
      (c) => c === '2' || c.id === '2' || c.userId === '2',
    );
    assert(!isStillCollab, 'Collaborator is no longer in project collaborators list');

    // Verify removed user is in removedUsers list
    const inRemovedUsers = (validRemoveData.removedUsers || []).some((r) => r.userId === '2');
    assert(inRemovedUsers, 'Removed user is recorded in project.removedUsers list');

    // Check 8: Unapproved tasks of removed member reset to Unassigned and Open, proofLink cleared
    console.log('\n--- Check 8: Task of removed member reset to Unassigned and Open ---');
    const getTaskRes = await fetch(`http://localhost:3000/tasks/${taskId}`, { headers: ownerHeaders });
    const getTaskData = await getTaskRes.json();
    assert(
      getTaskRes.status === 200 &&
        getTaskData?.assignee === 'Unassigned' &&
        getTaskData?.status === 'To Do' &&
        !getTaskData?.proofLink,
      'Unapproved task of removed member reset to Unassigned and Open/To Do with proofLink cleared',
      `Assignee: ${getTaskData?.assignee}, Status: ${getTaskData?.status}`,
    );

    // Check 9: Removed user received notification with reason
    console.log('\n--- Check 9: Removed user receives notification ---');
    const notifsRes = await fetch('http://localhost:3000/notifications', { headers: collabHeaders });
    const notifsData = await notifsRes.json();
    const removalNotif = (notifsData || []).find(
      (n) => n.referenceId === projectId && n.title === 'Project Membership Ended',
    );
    assert(
      Boolean(removalNotif && removalNotif.message.includes('Project scope shifted')),
      'Removed user received notification with removal reason',
      removalNotif?.message,
    );

    // Check 10: Removed user cannot re-apply (rejected with reason)
    console.log('\n--- Check 10: Removed user cannot re-apply ---');
    const reapplyRes = await fetch('http://localhost:3000/join-requests', {
      method: 'POST',
      headers: collabHeaders,
      body: JSON.stringify({
        projectId,
        userId: '2',
        userName: 'Arjun Sharma',
        message: 'Please let me back in',
      }),
    });
    const reapplyData = await reapplyRes.json();
    assert(
      reapplyRes.status === 400 && reapplyData?.message?.includes('Re-applying is not permitted'),
      'Removed user re-application rejected with 400 and reason message',
      reapplyData?.message,
    );

    // Check 11: Application row in join requests became Removed
    console.log('\n--- Check 11: Member application row status is Removed ---');
    const checkReqsRes = await fetch(`http://localhost:3000/join-requests?projectId=${projectId}`, {
      headers: ownerHeaders,
    });
    const checkReqsData = await checkReqsRes.json();
    const userReq = (checkReqsData || []).find((r) => r.userId === '2');
    assert(
      userReq && userReq.status === 'Removed',
      'Member application row in join requests is marked Removed',
      `status: ${userReq?.status}, reason: ${userReq?.removalReason}`,
    );

    // Check 12: Capacity count dropped so slot is freed
    console.log('\n--- Check 12: Capacity slot freed ---');
    const projCheckRes = await fetch(`http://localhost:3000/projects/${projectId}`, {
      headers: ownerHeaders,
    });
    const projCheckData = await projCheckRes.json();
    assert(
      projCheckData.approvedCollaboratorCount === 0 && !projCheckData.isFull,
      'Project capacity count dropped and slot is open',
      `approvedCount: ${projCheckData.approvedCollaboratorCount}, isFull: ${projCheckData.isFull}`,
    );

    console.log(`\n========================================`);
    console.log(`Phase 1 Verification: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================\n`);

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  }
}

run();
