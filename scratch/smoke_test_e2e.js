const http = require('http');
const assert = require('assert');

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`http://localhost:3000${path}`);
    const req = http.request(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, data: json });
        } catch {
          resolve({ status: res.statusCode, text: body });
        }
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runSmokeTest() {
  console.log('--- STARTING END-TO-END SMOKE TEST ---');
  const ts = Date.now();

  // 1. Health check
  const health = await request('/mail/health');
  assert.strictEqual(health.status, 200, 'Mail health endpoint should return 200');
  console.log('✓ Check 1: Mail health endpoint live');

  // 2. Signup Owner
  const ownerEmail = `smoke.owner.${ts}@teamforge.io`;
  const ownerUsername = `owner_${ts}`;
  const ownerPass = 'Password123!';
  const ownerSignup = await request('/auth/signup', {
    method: 'POST',
    body: { email: ownerEmail, username: ownerUsername, password: ownerPass, name: 'Smoke Owner', role: 'Project Owner' }
  });
  assert(ownerSignup.status === 201 || ownerSignup.status === 200, 'Owner signup succeeded: ' + JSON.stringify(ownerSignup.data));
  const ownerToken = ownerSignup.data.accessToken || ownerSignup.data.token;
  const ownerId = ownerSignup.data.user.id;
  console.log('✓ Check 2: Owner signup & token obtained');

  // 3. Signup Collaborator
  const collabEmail = `smoke.collab.${ts}@teamforge.io`;
  const collabUsername = `collab_${ts}`;
  const collabPass = 'Password123!';
  const collabSignup = await request('/auth/signup', {
    method: 'POST',
    body: { email: collabEmail, username: collabUsername, password: collabPass, name: 'Smoke Collab', role: 'Collaborator' }
  });
  assert(collabSignup.status === 201 || collabSignup.status === 200, 'Collab signup succeeded: ' + JSON.stringify(collabSignup.data));
  const collabToken = collabSignup.data.accessToken || collabSignup.data.token;
  const collabId = collabSignup.data.user.id;
  console.log('✓ Check 3: Collaborator signup & token obtained');

  // 4. Owner creates project
  const createProjRes = await request('/projects', {
    method: 'POST',
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: {
      title: `Smoke Project ${ts}`,
      description: 'End-to-end smoke test collaboration project with milestone delivery',
      category: 'Web Development',
      skills: ['React', 'NestJS', 'TypeScript'],
      dueDate: '2027-01-15T00:00:00.000Z',
      maxCollaborators: 3
    }
  });
  assert(createProjRes.status === 201 || createProjRes.status === 200, 'Project creation succeeded: ' + JSON.stringify(createProjRes.data));
  const project = createProjRes.data;
  const projectId = project.id;
  console.log('✓ Check 4: Owner created project:', projectId);

  // 5. Collaborator applies to project
  const applyRes = await request('/join-requests', {
    method: 'POST',
    headers: { Authorization: `Bearer ${collabToken}` },
    body: {
      projectId: projectId,
      message: 'Excited to contribute to this project!'
    }
  });
  assert(applyRes.status === 201 || applyRes.status === 200, 'Join request creation succeeded: ' + JSON.stringify(applyRes.data));
  const joinRequest = applyRes.data;
  const joinRequestId = joinRequest.id;
  console.log('✓ Check 5: Collaborator applied to project:', joinRequestId);

  // 6. Owner approves join request
  const approveRes = await request(`/join-requests/${joinRequestId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: { status: 'approved' }
  });
  assert(approveRes.status === 200 || approveRes.status === 201, 'Join request approval succeeded: ' + JSON.stringify(approveRes.data));
  console.log('✓ Check 6: Owner approved join request');

  // 7. Owner creates task and assigns to Collaborator
  const taskRes = await request('/tasks', {
    method: 'POST',
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: {
      projectId: projectId,
      title: 'Smoke Test Implementation Task',
      description: 'Implement core smoke test verification routines',
      assigneeId: collabId,
      points: 150,
      priority: 'High',
      dueDate: '2026-12-31T00:00:00.000Z'
    }
  });
  assert(taskRes.status === 201 || taskRes.status === 200, 'Task creation succeeded: ' + JSON.stringify(taskRes.data));
  const task = taskRes.data;
  const taskId = task.id;
  console.log('✓ Check 7: Owner created task:', taskId);

  // 8. Collaborator submits task proof
  const submitRes = await request(`/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${collabToken}` },
    body: {
      status: 'submitted',
      proofLink: 'https://github.com/teamforge/pull/1'
    }
  });
  assert(submitRes.status === 200, 'Task submission succeeded: ' + JSON.stringify(submitRes.data));
  console.log('✓ Check 8: Collaborator submitted task proof');

  // 9. Owner approves task
  const approveTaskRes = await request(`/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: { status: 'approved' }
  });
  assert(approveTaskRes.status === 200, 'Task approval succeeded: ' + JSON.stringify(approveTaskRes.data));
  console.log('✓ Check 9: Owner approved task (XP awarded)');

  // 10. Signup Mentor Applicant
  const mentorEmail = `smoke.mentor.${ts}@teamforge.io`;
  const mentorUsername = `mentor_${ts}`;
  const mentorSignup = await request('/auth/signup', {
    method: 'POST',
    body: { email: mentorEmail, username: mentorUsername, password: 'Password123!', name: 'Smoke Mentor', role: 'Collaborator' }
  });
  assert(mentorSignup.status === 201 || mentorSignup.status === 200, 'Mentor signup succeeded: ' + JSON.stringify(mentorSignup.data));
  const mentorToken = mentorSignup.data.accessToken || mentorSignup.data.token;
  const mentorUserId = mentorSignup.data.user.id;
  console.log('✓ Check 10: Mentor applicant registered');

  // 11. Mentor submits application
  const mentorAppRes = await request('/mentor-applications', {
    method: 'POST',
    headers: { Authorization: `Bearer ${mentorToken}` },
    body: {
      userId: mentorUserId,
      name: 'Smoke Mentor',
      email: mentorEmail,
      bio: 'Senior Software Engineer with 8+ years experience in distributed systems.',
      skills: ['Architecture', 'Cloud', 'TypeScript', 'React'],
      yearsOfExperience: 8,
      cvFileName: 'mentor_cv_smoke.pdf',
      cvOriginalName: 'mentor_cv_smoke.pdf',
      certificates: [
        {
          id: 'cert-smoke-1',
          title: 'Master of Science in Computer Science',
          issuer: 'Stanford University (DigiLocker Verified)',
          holderName: 'Smoke Mentor',
          issuedDate: '2023-06-15'
        }
      ],
      portfolio: 'https://smoke-mentor.io'
    }
  });
  assert(mentorAppRes.status === 201 || mentorAppRes.status === 200, 'Mentor application submitted: ' + JSON.stringify(mentorAppRes.data));
  const mentorAppId = mentorAppRes.data.id;
  console.log('✓ Check 11: Mentor application submitted:', mentorAppId);

  // 12. Admin logs in and approves mentor application with override
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: { identifier: 'superuser@teamforge.io', password: 'Super@123' }
  });
  assert.strictEqual(adminLogin.status, 200, 'Admin login succeeded');
  const adminToken = adminLogin.data.accessToken || adminLogin.data.token;

  const adminApproveRes = await request(`/mentor-applications/${mentorAppId}/approve`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      overrideVerification: true,
      overrideNote: 'Smoke test administrative verification override'
    }
  });
  assert.strictEqual(adminApproveRes.status, 200, 'Admin approved mentor application: ' + JSON.stringify(adminApproveRes.data));
  console.log('✓ Check 12: Admin approved mentor application');

  // 13. Mentor switches role to Mentor
  const switchRes = await request('/auth/switch-role', {
    method: 'POST',
    headers: { Authorization: `Bearer ${mentorToken}` },
    body: { role: 'Mentor' }
  });
  assert(switchRes.status === 200, 'Mentor role switch succeeded: ' + JSON.stringify(switchRes.data));
  const activeMentorToken = switchRes.data.accessToken || mentorToken;
  console.log('✓ Check 13: Mentor switched role to Mentor');

  // 14. Mentor updates marketplace profile
  const profileRes = await request('/mentor-marketplace/mentors/profile', {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeMentorToken}` },
    body: {
      name: 'Smoke Mentor',
      title: 'Senior Cloud Architect',
      bio: 'Verified cloud architect mentor.',
      skills: ['Architecture', 'Mentorship', 'Cloud'],
      experienceYears: 8,
      sessionPrice: 500,
      sessionDuration: 60,
      availability: 'Weekdays'
    }
  });
  assert(profileRes.status === 200 || profileRes.status === 201, 'Mentor marketplace profile updated: ' + JSON.stringify(profileRes.data));
  const mentorProfileId = profileRes.data.id;
  console.log('✓ Check 14: Mentor marketplace profile configured:', mentorProfileId);

  // 15. Owner books mentor session
  const bookRes = await request('/mentor-marketplace/sessions/book', {
    method: 'POST',
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: {
      projectId: projectId,
      mentorId: mentorProfileId,
      projectDescription: 'Architecture Review Session'
    }
  });
  assert(bookRes.status === 201 || bookRes.status === 200, 'Mentor session booking created: ' + JSON.stringify(bookRes.data));
  console.log('✓ Check 15: Owner booked mentor session');

  // 16. Verify notifications delivered
  const notifRes = await request('/notifications', {
    method: 'GET',
    headers: { Authorization: `Bearer ${collabToken}` }
  });
  assert.strictEqual(notifRes.status, 200, 'Collaborator notifications fetched');
  assert(Array.isArray(notifRes.data) && notifRes.data.length > 0, 'Collaborator received notifications');
  console.log('✓ Check 16: Notifications verified (' + notifRes.data.length + ' received)');

  console.log('\n========================================');
  console.log('ALL 16 SMOKE TEST CHECKS PASSED WITH ZERO ERRORS!');
  console.log('========================================');
}

runSmokeTest().catch((err) => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});
