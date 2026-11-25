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

async function runPhase1Verification() {
  console.log('=== RUNNING PHASE 1 VERIFICATION SUITE ===');
  const ts = Date.now();

  // 1. Admin login
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: { identifier: 'superuser@teamforge.io', password: 'Super@123' },
  });
  assert.strictEqual(adminLogin.status, 200, 'Admin login succeeded');
  const adminToken = adminLogin.data.accessToken || adminLogin.data.token;
  const adminHeaders = {
    'Authorization': `Bearer ${adminToken}`,
    'x-user-role': 'superuser',
    'x-user-id': 'super-1',
  };

  // 2. Signup fresh user
  const userEmail = `mentor.phase1.${ts}@teamforge.io`;
  const username = `candidate_${ts}`;
  const userPass = 'Password123!';
  const userName = 'Riya Sharma';

  const userSignup = await request('/auth/signup', {
    method: 'POST',
    body: { email: userEmail, username, password: userPass, name: userName, role: 'Collaborator' },
  });
  assert(userSignup.status === 201 || userSignup.status === 200, 'User signup succeeded');
  const userToken = userSignup.data.accessToken || userSignup.data.token;
  const userId = userSignup.data.user?.id || userSignup.data.id;
  const userHeaders = {
    'Authorization': `Bearer ${userToken}`,
    'x-user-role': 'collaborator',
    'x-user-id': userId,
  };

  console.log(`✓ User created: ${userId} (${userEmail})`);

  // Check initial /mentor-applications/me: status none, unlocked false
  const initialMe = await request('/mentor-applications/me', { headers: userHeaders });
  assert.strictEqual(initialMe.status, 200, 'GET /mentor-applications/me returns 200');
  assert.strictEqual(initialMe.data.status, 'none', 'Initial status is none');
  assert.strictEqual(initialMe.data.mentorUnlocked, false, 'Initial mentorUnlocked is false');
  console.log('✓ Check 1: Initial status endpoint returns none/unlocked=false');

  // 3. User submits Application 1
  const app1Payload = {
    userId,
    name: userName,
    email: userEmail,
    bio: 'Passionate full-stack developer with 6 years experience mentoring juniors.',
    years: 6,
    skills: ['React', 'TypeScript', 'Node.js'],
    cvFileName: 'candidate_cv.pdf',
    certificates: [
      {
        holderName: userName,
        documentType: 'Degree Certificate',
        issuer: 'Stanford University',
        documentNumber: `DEG-${ts}`,
        status: 'verified',
        verificationStatus: 'verified',
      }
    ],
  };

  const submit1 = await request('/mentor-applications', {
    method: 'POST',
    headers: userHeaders,
    body: app1Payload,
  });
  assert.strictEqual(submit1.status, 201, 'Application 1 submission succeeded: ' + JSON.stringify(submit1.data));
  const app1Id = submit1.data.id;
  console.log(`✓ Check 2: Application 1 submitted (id: ${app1Id}, status: pending)`);

  // 4. Submit while one is pending -> Expect 409
  const submitPendingConflict = await request('/mentor-applications', {
    method: 'POST',
    headers: userHeaders,
    body: app1Payload,
  });
  assert.strictEqual(submitPendingConflict.status, 409, 'Submitting while pending returned 409');
  console.log('✓ Check 3: Submitting while an application is pending returns 409 Conflict');

  // 5. Admin rejects Application 1 with "Reason: try again"
  const rejectRes = await request(`/mentor-applications/${app1Id}/reject`, {
    method: 'PUT',
    headers: adminHeaders,
    body: { reason: 'try again' },
  });
  assert.strictEqual(rejectRes.status, 200, 'Admin rejection succeeded');
  console.log('✓ Check 4: Admin rejected Application 1 with reason "try again"');

  // 6. Check user status after rejection
  const afterRejectMe = await request('/mentor-applications/me', { headers: userHeaders });
  assert.strictEqual(afterRejectMe.status, 200);
  assert.strictEqual(afterRejectMe.data.status, 'rejected', 'Status is rejected');
  assert.strictEqual(afterRejectMe.data.mentorUnlocked, false, 'Mentor is still locked');
  assert.strictEqual(afterRejectMe.data.application.rejectionReason, 'try again');
  console.log('✓ Check 5: Status endpoint returns rejected with reason "try again"');

  // 7. User resubmits Application 2
  const app2Payload = {
    ...app1Payload,
    bio: 'Updated application with revised experience statement and expanded credentials.',
    years: 7,
    certificates: [
      {
        holderName: userName,
        documentType: 'Master of Science Degree',
        issuer: 'MIT',
        documentNumber: `MST-${ts}`,
        status: 'verified',
        verificationStatus: 'verified',
      }
    ],
  };

  const submit2 = await request('/mentor-applications', {
    method: 'POST',
    headers: userHeaders,
    body: app2Payload,
  });
  assert.strictEqual(submit2.status, 201, 'Application 2 resubmission succeeded');
  const app2Id = submit2.data.id;
  assert.notStrictEqual(app2Id, app1Id, 'Application 2 has a distinct ID');
  console.log(`✓ Check 6: Application 2 resubmitted (id: ${app2Id}, status: pending)`);

  // 8. Admin approves Application 2
  const approveRes = await request(`/mentor-applications/${app2Id}/approve`, {
    method: 'PUT',
    headers: adminHeaders,
    body: {},
  });
  assert.strictEqual(approveRes.status, 200, 'Admin approval succeeded');
  console.log('✓ Check 7: Admin approved Application 2');

  // 9. Confirm immediately without logging out that user is approved and mentor unlocked
  const afterApproveMe = await request('/mentor-applications/me', { headers: userHeaders });
  assert.strictEqual(afterApproveMe.status, 200);
  assert.strictEqual(afterApproveMe.data.status, 'approved', 'Status is approved (latest application wins)');
  assert.strictEqual(afterApproveMe.data.mentorUnlocked, true, 'mentorUnlocked is true immediately');
  assert.strictEqual(afterApproveMe.data.application.id, app2Id, 'Latest application is app 2');
  assert.strictEqual(afterApproveMe.data.application.rejectionReason, undefined, 'Rejection reason cleared');
  console.log('✓ Check 8: User status immediately shows approved & mentorUnlocked=true without logout');

  // 10. Confirm auth/me reflects mentorUnlocked
  const authMe = await request('/auth/me', { headers: userHeaders });
  assert.strictEqual(authMe.status, 200);
  assert.strictEqual(authMe.data.mentorUnlocked, true, 'auth/me reflects mentorUnlocked=true');
  console.log('✓ Check 9: GET /auth/me returns mentorUnlocked=true');

  // 11. Role switch to Mentor succeeds
  const switchRoleRes = await request('/auth/switch-role', {
    method: 'POST',
    headers: userHeaders,
    body: { role: 'Mentor' },
  });
  assert.strictEqual(switchRoleRes.status, 200, 'Role switch to Mentor succeeded: ' + JSON.stringify(switchRoleRes.data));
  console.log('✓ Check 10: Role switch to Mentor succeeded');

  // 12. Mentored Projects is empty for newly approved mentor
  const mentorHeaders = {
    'Authorization': `Bearer ${userToken}`,
    'x-user-role': 'mentor',
    'x-user-id': userId,
  };
  const mentorReqs = await request('/mentor-requests', { headers: mentorHeaders });
  const myApprovedMentorReqs = (Array.isArray(mentorReqs.data) ? mentorReqs.data : [])
    .filter(r => String(r.mentorId) === String(userId) && (r.status === 'accepted' || r.status === 'approved'));
  assert.strictEqual(myApprovedMentorReqs.length, 0, 'Mentored projects list is empty');
  console.log('✓ Check 11: Mentored projects list is verified empty');

  // 13. Approved user attempts to submit another application -> Expect 409
  const submitApprovedConflict = await request('/mentor-applications', {
    method: 'POST',
    headers: mentorHeaders,
    body: app2Payload,
  });
  assert.strictEqual(submitApprovedConflict.status, 409, 'Approved user submit returned 409 Conflict');
  console.log('✓ Check 12: Approved user submitting again returns 409 Conflict');

  // 14. Rejection of a later or another application never revokes earlier approval
  // Admin rejects an older application or edge application
  const edgeReject = await request(`/mentor-applications/${app1Id}/reject`, {
    method: 'PUT',
    headers: adminHeaders,
    body: { reason: 'stale review' },
  });
  // Check user still unlocked
  const checkStillUnlocked = await request('/mentor-applications/me', { headers: userHeaders });
  assert.strictEqual(checkStillUnlocked.data.mentorUnlocked, true, 'User remains unlocked');
  console.log('✓ Check 13: Rejection of another application never revokes earlier approval');

  // 15. Check Notifications
  const notifs = await request(`/notifications?userId=${userId}`, { headers: userHeaders });
  assert.strictEqual(notifs.status, 200);
  const notifList = Array.isArray(notifs.data) ? notifs.data : (notifs.data.data || []);
  const approvalNotif = notifList.find(n => n.type === 'MENTOR_APPLICATION_APPROVED');
  assert(approvalNotif, 'Approval notification arrived');
  assert.strictEqual(approvalNotif.title, 'Mentor Application Approved');
  assert(approvalNotif.message.includes('Congratulations!'), 'Approval notification message matches expected text');
  console.log('✓ Check 14: Approval notification verified with intact text');

  console.log('\nALL 14 PHASE 1 VERIFICATION CHECKS PASSED SUCCESSFULLY!\n');
}

runPhase1Verification().catch(err => {
  console.error('Phase 1 Verification Failed:', err);
  process.exit(1);
});
