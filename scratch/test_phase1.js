const http = require('http');

const PORT = 3000;

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      ...headers,
    };
    if (postData) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }
    const req = http.request(
      {
        hostname: 'localhost',
        port: PORT,
        path,
        method,
        headers: reqHeaders,
      },
      (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => {
          let data = null;
          try {
            data = JSON.parse(buf);
          } catch {
            data = buf;
          }
          resolve({ status: res.statusCode, data, headers: res.headers });
        });
      }
    );
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('PHASE 1: LIVE INTEGRATION VERIFICATION TEST SUITE');
  console.log('====================================================\n');

  const results = [];

  function check(name, pass, detail) {
    results.push({ name, pass, detail });
    console.log(`${pass ? '✅ PASS' : '❌ FAIL'}: ${name}`);
    if (detail) console.log(`   Detail: ${detail}`);
  }

  // 1. Login as Super User
  const suLogin = await request('POST', '/admin/login', {
    email: 'superuser@teamforge.io',
    password: 'Super@123',
  });
  check(
    'Super User login',
    suLogin.status === 201 && suLogin.data?.role === 'superuser',
    `Status: ${suLogin.status}, role: ${suLogin.data?.role}`
  );
  const suToken = suLogin.data.token;
  const suHeaders = { Authorization: `Bearer ${suToken}` };

  // 2. Login as regular Collaborator (Arjun Sharma)
  const collabLogin = await request('POST', '/auth/login', {
    email: 'arjun.sharma@teamforge.io',
    password: 'password123',
  });
  check(
    'Collaborator login (Arjun Sharma)',
    (collabLogin.status === 200 || collabLogin.status === 201) && collabLogin.data?.user?.email === 'arjun.sharma@teamforge.io',
    `Status: ${collabLogin.status}, userId: ${collabLogin.data?.user?.id}`
  );
  const collabToken = collabLogin.data.accessToken;
  const collabHeaders = { Authorization: `Bearer ${collabToken}` };
  const arjunUserId = String(collabLogin.data?.user?.id || '2');

  // 3. Login as second Collaborator (Sneha Iyer)
  const snehaLogin = await request('POST', '/auth/login', {
    email: 'sneha.iyer@teamforge.io',
    password: 'password123',
  });
  check(
    'Collaborator login (Sneha Iyer)',
    (snehaLogin.status === 200 || snehaLogin.status === 201) && snehaLogin.data?.user?.email === 'sneha.iyer@teamforge.io',
    `Status: ${snehaLogin.status}, userId: ${snehaLogin.data?.user?.id}`
  );
  const snehaToken = snehaLogin.data.accessToken;
  const snehaHeaders = { Authorization: `Bearer ${snehaToken}` };
  const snehaUserId = String(snehaLogin.data?.user?.id || '5');

  // 4. Submit mentor application for Arjun
  const app1 = await request('POST', '/mentor-applications', {
    userId: arjunUserId,
    name: 'Arjun Sharma',
    email: 'arjun.sharma@teamforge.io',
    years: 5,
    skills: ['React', 'NestJS'],
    cvFileName: 'arjun_cv.pdf',
    certificates: [
      {
        id: 'cert-1',
        verificationStatus: 'verified',
        issuer: 'DigiLocker',
        holderName: 'Arjun Sharma',
        documentNumber: 'DOC-101',
        issueDate: '2023-01-01',
      },
    ],
  }, collabHeaders);
  check(
    'Mentor application created for Arjun Sharma',
    app1.status === 201 && app1.data?.status === 'pending',
    `App ID: ${app1.data?.id}, Status: ${app1.data?.status}`
  );
  const app1Id = app1.data?.id;

  // 5. Submit mentor application for Sneha
  const app2 = await request('POST', '/mentor-applications', {
    userId: snehaUserId,
    name: 'Sneha Iyer',
    email: 'sneha.iyer@teamforge.io',
    years: 6,
    skills: ['Python', 'AI/ML'],
    cvFileName: 'sneha_cv.pdf',
    certificates: [
      {
        id: 'cert-2',
        verificationStatus: 'verified',
        issuer: 'DigiLocker',
        holderName: 'Sneha Iyer',
        documentNumber: 'DOC-102',
        issueDate: '2022-05-15',
      },
    ],
  }, snehaHeaders);
  check(
    'Mentor application created for Sneha Iyer',
    app2.status === 201 && app2.data?.status === 'pending',
    `App ID: ${app2.data?.id}, Status: ${app2.data?.status}`
  );
  const app2Id = app2.data?.id;

  // 6. Super User approves application 1 (Arjun)
  const suApprove = await request('PUT', `/mentor-applications/${app1Id}/approve`, null, suHeaders);
  check(
    'Super User approves mentor application (HTTP 200)',
    suApprove.status === 200 && suApprove.data?.status === 'approved',
    `Status: ${suApprove.status}, appStatus: ${suApprove.data?.status}`
  );

  // Verify Arjun is now unlocked as Mentor in users repository
  const arjunUser = await request('GET', '/users/2', null, suHeaders);
  check(
    'Applicant becomes mentor with mentorUnlocked',
    arjunUser.status === 200 && arjunUser.data?.profile?.mentorUnlocked === true,
    `Role: ${arjunUser.data?.role}, mentorUnlocked: ${arjunUser.data?.profile?.mentorUnlocked}`
  );

  // Check notification sent to Arjun
  const arjunNotifs = await request('GET', '/notifications', null, collabHeaders);
  const approveNotif = Array.isArray(arjunNotifs.data) && arjunNotifs.data.find(
    (n) => n.type === 'MENTOR_APPLICATION_APPROVED'
  );
  check(
    'Approval notification delivered to applicant',
    Boolean(approveNotif),
    `Found notification: ${approveNotif?.title} - ${approveNotif?.message}`
  );

  // 7. Super User rejects application 2 (Sneha)
  const rejectReason = 'Requires more hands-on production mentoring experience.';
  const suReject = await request('PUT', `/mentor-applications/${app2Id}/reject`, { reason: rejectReason }, suHeaders);
  check(
    'Super User rejects mentor application (HTTP 200)',
    suReject.status === 200 && suReject.data?.status === 'rejected' && suReject.data?.rejectionReason === rejectReason,
    `Status: ${suReject.status}, appStatus: ${suReject.data?.status}, reason: ${suReject.data?.rejectionReason}`
  );

  // Check notification sent to Sneha
  const snehaNotifs = await request('GET', '/notifications', null, snehaHeaders);
  const rejectNotif = Array.isArray(snehaNotifs.data) && snehaNotifs.data.find(
    (n) => n.type === 'MENTOR_APPLICATION_REJECTED'
  );
  check(
    'Rejection notification delivered to applicant with reason',
    Boolean(rejectNotif) && rejectNotif.message?.includes(rejectReason),
    `Found notification: ${rejectNotif?.title} - ${rejectNotif?.message}`
  );

  // 8. Provision Admin with mentor_apps permission
  const adminWithPermEmail = `mentor_admin_${Date.now()}@teamforge.io`;
  const createAdmin1 = await request('POST', '/portal-admins', {
    name: 'Mentor Approver Admin',
    email: adminWithPermEmail,
    password: 'AdminPassword@123',
    permissions: ['mentor_apps', 'dashboard'],
  }, suHeaders);
  check(
    'Super User provisions Admin with mentor_apps permission',
    createAdmin1.status === 201,
    `Email: ${adminWithPermEmail}`
  );

  const admin1Login = await request('POST', '/admin/login', {
    email: adminWithPermEmail,
    password: 'AdminPassword@123',
  });
  const admin1Token = admin1Login.data.token;
  const admin1Headers = { Authorization: `Bearer ${admin1Token}` };

  // Create another pending application to test Admin approval
  const app3 = await request('POST', '/mentor-applications', {
    userId: '4',
    name: 'Priya Patel',
    email: 'priya.patel@teamforge.io',
    years: 7,
    skills: ['Cybersecurity'],
    cvFileName: 'priya_cv.pdf',
    certificates: [
      {
        id: 'cert-3',
        verificationStatus: 'verified',
        issuer: 'DigiLocker',
        holderName: 'Priya Patel',
        documentNumber: 'DOC-103',
        issueDate: '2021-08-10',
      },
    ],
  }, collabHeaders);
  const app3Id = app3.data?.id;

  // Admin with mentor_apps approves app3
  const admin1Approve = await request('PUT', `/mentor-applications/${app3Id}/approve`, null, admin1Headers);
  check(
    'Admin with mentor_apps permission can approve (HTTP 200)',
    admin1Approve.status === 200 && admin1Approve.data?.status === 'approved',
    `Status: ${admin1Approve.status}, appStatus: ${admin1Approve.data?.status}`
  );

  // 9. Provision Admin WITHOUT mentor_apps permission (e.g. users only)
  const adminNoPermEmail = `users_only_admin_${Date.now()}@teamforge.io`;
  const createAdmin2 = await request('POST', '/portal-admins', {
    name: 'Users Only Admin',
    email: adminNoPermEmail,
    password: 'AdminPassword@123',
    permissions: ['users', 'dashboard'],
  }, suHeaders);
  check(
    'Super User provisions Admin WITHOUT mentor_apps permission',
    createAdmin2.status === 201,
    `Email: ${adminNoPermEmail}`
  );

  const admin2Login = await request('POST', '/admin/login', {
    email: adminNoPermEmail,
    password: 'AdminPassword@123',
  });
  const admin2Token = admin2Login.data.token;
  const admin2Headers = { Authorization: `Bearer ${admin2Token}` };

  // Create another app to test
  const app4 = await request('POST', '/mentor-applications', {
    userId: '5',
    name: 'Kavita Rao',
    email: 'kavita.rao@teamforge.io',
    years: 5,
    skills: ['Cloud Architecture'],
    cvFileName: 'kavita_cv.pdf',
    certificates: [
      {
        id: 'cert-4',
        verificationStatus: 'verified',
        issuer: 'DigiLocker',
        holderName: 'Kavita Rao',
        documentNumber: 'DOC-104',
        issueDate: '2022-01-10',
      },
    ],
  }, collabHeaders);
  const app4Id = app4.data?.id;

  // Admin without mentor_apps attempts to approve app4 -> MUST GET 403
  const admin2Approve = await request('PUT', `/mentor-applications/${app4Id}/approve`, null, admin2Headers);
  check(
    'Admin without mentor_apps gets 403 on approve',
    admin2Approve.status === 403,
    `Status: ${admin2Approve.status}, message: ${JSON.stringify(admin2Approve.data?.message || admin2Approve.data)}`
  );

  // Admin without mentor_apps attempts to reject app4 -> MUST GET 403
  const admin2Reject = await request('PUT', `/mentor-applications/${app4Id}/reject`, { reason: 'test' }, admin2Headers);
  check(
    'Admin without mentor_apps gets 403 on reject',
    admin2Reject.status === 403,
    `Status: ${admin2Reject.status}, message: ${JSON.stringify(admin2Reject.data?.message || admin2Reject.data)}`
  );

  // 10. Collaborator attempts to approve app4 -> MUST GET 403
  const collabApprove = await request('PUT', `/mentor-applications/${app4Id}/approve`, null, collabHeaders);
  check(
    'Collaborator gets 403 on approve',
    collabApprove.status === 403,
    `Status: ${collabApprove.status}, message: ${JSON.stringify(collabApprove.data?.message || collabApprove.data)}`
  );

  // 11. Other admin actions RBAC check:
  // Admin 2 (users only) CAN moderate users
  const admin2Users = await request('GET', '/admin/users', null, admin2Headers);
  check(
    'Admin with users permission can list users (HTTP 200)',
    admin2Users.status === 200 && Array.isArray(admin2Users.data),
    `Status: ${admin2Users.status}, count: ${admin2Users.data?.length}`
  );

  // Admin 2 (users only) CANNOT delete projects -> MUST GET 403
  const admin2DeleteProj = await request('DELETE', '/projects/proj-1', null, admin2Headers);
  check(
    'Admin without projects permission gets 403 on project delete',
    admin2DeleteProj.status === 403,
    `Status: ${admin2DeleteProj.status}, message: ${JSON.stringify(admin2DeleteProj.data?.message || admin2DeleteProj.data)}`
  );

  // Admin 2 (users only) CANNOT access portal-admins -> MUST GET 403
  const admin2ManageAdmins = await request('GET', '/portal-admins', null, admin2Headers);
  check(
    'Admin without manage_admins permission gets 403 on portal-admins',
    admin2ManageAdmins.status === 403,
    `Status: ${admin2ManageAdmins.status}`
  );

  // Admin 2 (users only) CANNOT update config -> MUST GET 403
  const admin2Config = await request('PUT', '/admin/config', { maxCollaboratorCapacity: 10 }, admin2Headers);
  check(
    'Admin without config permission gets 403 on config update',
    admin2Config.status === 403,
    `Status: ${admin2Config.status}`
  );

  // Super User CAN update config
  const suConfig = await request('PUT', '/admin/config', { maxCollaboratorCapacity: 10 }, suHeaders);
  check(
    'Super User can update config (HTTP 200)',
    suConfig.status === 200,
    `Status: ${suConfig.status}`
  );

  // 12. Audit log verification
  const auditRes = await request('GET', '/admin/audit', null, suHeaders);
  const auditEntries = Array.isArray(auditRes.data) ? auditRes.data : [];
  const approveAudit = auditEntries.find((a) => a.action === 'mentor-application-approved');
  const rejectAudit = auditEntries.find((a) => a.action === 'mentor-application-rejected');
  check(
    'Audit entries recorded for both approve and reject',
    Boolean(approveAudit) && Boolean(rejectAudit),
    `Found approve audit: ${approveAudit?.event}, reject audit: ${rejectAudit?.event}`
  );

  console.log('\n====================================================');
  console.log(`SUMMARY: ${results.filter(r => r.pass).length} / ${results.length} CHECKS PASSED`);
  console.log('====================================================');
}

runTests().catch(console.error);
