const http = require('http');

const PORT = 3000;

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const reqHeaders = { ...headers };
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
  console.log('PHASE 3: LIVE INTEGRATION VERIFICATION TEST SUITE');
  console.log('====================================================\n');

  const results = [];
  function check(name, pass, detail) {
    results.push({ name, pass, detail });
    console.log(`${pass ? '✅ PASS' : '❌ FAIL'}: ${name}`);
    if (detail) console.log(`   Detail: ${detail}`);
  }

  // 0. Wait for backend to be ready
  for (let i = 0; i < 20; i++) {
    try {
      const res = await request('GET', '/api-docs');
      if (res.status < 500) break;
    } catch {}
    await sleep(500);
  }

  // 1. Login as Super User
  const suLogin = await request('POST', '/admin/login', {
    email: 'superuser@teamforge.io',
    password: 'Super@123',
  });
  check('Super User login', suLogin.status === 201 && suLogin.data?.token, `Token acquired for ${suLogin.data?.role}`);
  const suToken = suLogin.data?.token;
  const suHeaders = { Authorization: `Bearer ${suToken}` };

  // 2. Provision and Login as Admin with mentor_apps permission
  const adminEmail = `mentor_admin_${Date.now()}@teamforge.io`;
  const createAdminRes = await request('POST', '/portal-admins', {
    name: 'Mentor Approver Admin',
    email: adminEmail,
    password: 'AdminPassword@123',
    permissions: ['mentor_apps', 'dashboard'],
  }, suHeaders);
  check('Super User provisions Admin with mentor_apps permission', createAdminRes.status === 201, `Email: ${adminEmail}`);

  const adminLogin = await request('POST', '/admin/login', {
    email: adminEmail,
    password: 'AdminPassword@123',
  });
  check('Admin login with mentor_apps permission', adminLogin.status === 201 && adminLogin.data?.token, `Token acquired for ${adminLogin.data?.role}`);
  const adminToken = adminLogin.data?.token;
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };

  // 3. Login as Collaborator (Arjun Sharma)
  const collabLogin = await request('POST', '/auth/login', {
    email: 'arjun.sharma@teamforge.io',
    password: 'password123',
  });
  check('Collaborator login (Arjun Sharma)', (collabLogin.status === 200 || collabLogin.status === 201) && collabLogin.data?.accessToken, `Status: ${collabLogin.status}`);
  const collabToken = collabLogin.data?.accessToken;
  const collabHeaders = { Authorization: `Bearer ${collabToken}` };
  const arjunUserId = String(collabLogin.data?.user?.id || '2');

  // 4. Test DigiLocker Sandbox document pull
  console.log('\n--- Step 1: DigiLocker Sandbox document retrieval ---');
  const pullRes = await request('POST', '/mentor-applications/digilocker/pull-documents', {
    applicantName: 'Arjun Sharma',
  }, collabHeaders);

  const docs = Array.isArray(pullRes.data?.documents) ? pullRes.data.documents : [];
  const verifiedCount = docs.filter(d => d.status === 'verified').length;
  const mismatchCount = docs.filter(d => d.status === 'name_mismatch').length;

  check('Sandbox document retrieval returns 3 documents', docs.length === 3, `Count: ${docs.length}`);
  check('Sandbox credentials: 2 verified, 1 name mismatch', verifiedCount === 2 && mismatchCount === 1, `Verified: ${verifiedCount}, Mismatch: ${mismatchCount}`);

  const sampleDoc = docs[0];
  const hasFields = sampleDoc && sampleDoc.issuer && sampleDoc.documentType && sampleDoc.documentNumber && sampleDoc.holderName && sampleDoc.issueDate && sampleDoc.status && sampleDoc.verificationId;
  check('Credential schema has all standardized fields', Boolean(hasFields), `Doc: ${sampleDoc?.documentType}, issuer: ${sampleDoc?.issuer}`);

  const mismatchDoc = docs.find(d => d.status === 'name_mismatch');
  check('Demo mismatch document clearly labelled with reason', Boolean(mismatchDoc?.mismatchReason), `Reason: ${mismatchDoc?.mismatchReason}`);

  // 5. Test Case 1: Application with 0 verified credentials (only mismatch) rejected
  console.log('\n--- Step 2: Reject application with 0 verified credentials (HTTP 400) ---');
  const zeroVerifiedRes = await request('POST', '/mentor-applications', {
    userId: arjunUserId,
    name: 'Arjun Sharma',
    email: 'arjun.sharma@teamforge.io',
    years: 5,
    skills: ['TypeScript', 'NestJS'],
    bio: 'Enthusiastic mentor with 5 years in backend design.',
    cvFileName: 'arjun_cv.pdf',
    certificates: [mismatchDoc],
  }, collabHeaders);

  check('Application with 0 verified credentials rejected with HTTP 400', zeroVerifiedRes.status === 400, `Status: ${zeroVerifiedRes.status}, Message: ${zeroVerifiedRes.data?.message}`);

  // 6. Test Case 2: Forged client request tampering with status
  console.log('\n--- Step 3: Forged request tampering with status ---');
  const forgedDoc = {
    ...mismatchDoc,
    status: 'verified',
    verificationStatus: 'verified',
  };
  const forgedRes = await request('POST', '/mentor-applications', {
    userId: arjunUserId,
    name: 'Arjun Sharma',
    email: 'arjun.sharma@teamforge.io',
    years: 5,
    skills: ['TypeScript'],
    bio: 'Enthusiastic mentor with 5 years in backend design.',
    cvFileName: 'arjun_cv.pdf',
    certificates: [forgedDoc],
  }, collabHeaders);

  check('Forged status re-evaluated server side and rejected (HTTP 400)', forgedRes.status === 400, `Status: ${forgedRes.status}, Server message: ${forgedRes.data?.message}`);

  // 7. Test Case 3: Genuine application submission with 2 verified and 1 mismatched credential
  console.log('\n--- Step 4: Genuine application submission ---');
  const verifiedDocs = docs.filter(d => d.status === 'verified');
  const submitRes = await request('POST', '/mentor-applications', {
    userId: arjunUserId,
    name: 'Arjun Sharma',
    email: 'arjun.sharma@teamforge.io',
    years: 5,
    skills: ['TypeScript', 'NestJS', 'Architecture'],
    bio: 'Passionate about distributed systems and guiding student teams through clean architecture.',
    cvFileName: 'arjun_cv.pdf',
    certificates: verifiedDocs,
    excludedCertificates: [mismatchDoc],
  }, collabHeaders);

  const genuineAppId = submitRes.data?.id;
  check('Application submitted successfully (HTTP 201)', submitRes.status === 201, `App ID: ${genuineAppId}`);
  check('Submitted application stores verified certificates', submitRes.data?.certificates?.length === 2, `Count: ${submitRes.data?.certificates?.length}`);
  check('Submitted application stores excludedCertificates', submitRes.data?.excludedCertificates?.length === 1, `Count: ${submitRes.data?.excludedCertificates?.length}`);

  // 8. Test Case 4: Admin views application
  console.log('\n--- Step 5: Admin view of application credentials ---');
  const viewRes = await request('GET', `/mentor-applications/${genuineAppId}`, null, adminHeaders);
  const adminVerified = viewRes.data?.certificates?.length || 0;
  const adminExcluded = viewRes.data?.excludedCertificates?.length || 0;
  check('Admin view matches: 2 verified and 1 excluded', adminVerified === 2 && adminExcluded === 1, `Verified: ${adminVerified}, Excluded: ${adminExcluded}`);

  // 9. Test Case 5: Approving application with 0 verified credentials refused (HTTP 409)
  console.log('\n--- Step 6: Approval refusal for 0 verified credentials (HTTP 409) ---');
  // Login as Sneha Iyer to submit another application
  const snehaLogin = await request('POST', '/auth/login', {
    email: 'sneha.iyer@teamforge.io',
    password: 'password123',
  });
  const snehaToken = snehaLogin.data?.accessToken;
  const snehaHeaders = { Authorization: `Bearer ${snehaToken}` };
  const snehaUserId = String(snehaLogin.data?.user?.id || '5');

  // Sneha submits with 1 verified doc
  const snehaAppRes = await request('POST', '/mentor-applications', {
    userId: snehaUserId,
    name: 'Sneha Iyer',
    email: 'sneha.iyer@teamforge.io',
    years: 6,
    skills: ['React', 'CSS'],
    bio: 'Frontend expert with passion for mentorship.',
    cvFileName: 'sneha_cv.pdf',
    certificates: [
      {
        issuer: 'DigiLocker',
        documentType: 'Degree Certificate',
        documentNumber: 'DOC-SNEHA-01',
        holderName: 'Sneha Iyer',
        issueDate: '2021-06-01',
        status: 'verified',
        verificationStatus: 'verified',
        verificationId: 'VERIF-SNEHA-01',
      },
    ],
  }, snehaHeaders);

  const snehaAppId = snehaAppRes.data?.id;
  check('Sneha application created (HTTP 201)', snehaAppRes.status === 201, `App ID: ${snehaAppId}`);

  // Empty certificates on sneha's application to simulate 0 verified
  await request('PUT', `/mentor-applications/${snehaAppId}`, { certificates: [] }, suHeaders);

  // Attempt standard approval on snehaAppId (now with 0 verified) without override -> MUST RETURN HTTP 409
  const unverifiedApproveRes = await request('PUT', `/mentor-applications/${snehaAppId}/approve`, {}, adminHeaders);
  check(
    'Approval of application with 0 verified credentials refused with HTTP 409',
    unverifiedApproveRes.status === 409,
    `Status: ${unverifiedApproveRes.status}, Message: ${unverifiedApproveRes.data?.message}`
  );

  // 10. Test Case 6: Approve with verification override and required note
  console.log('\n--- Step 7: Approve with verification override and note ---');
  const overrideRes = await request('PUT', `/mentor-applications/${snehaAppId}/approve`, {
    overrideVerification: true,
    overrideNote: 'Offline degree certificate manually verified and approved by Department Head.',
  }, adminHeaders);

  check('Approval with verification override succeeds (HTTP 200)', overrideRes.status === 200 && overrideRes.data?.status === 'approved', `Status: ${overrideRes.data?.status}`);
  check('Approval override note saved in application entity', Boolean(overrideRes.data?.approvalOverrideNote), `Note: ${overrideRes.data?.approvalOverrideNote}`);

  // 11. Test Case 7: Approving genuine application with verified credentials
  console.log('\n--- Step 8: Approving genuine application with verified credentials ---');
  const approveRes = await request('PUT', `/mentor-applications/${genuineAppId}/approve`, null, suHeaders);
  check('Super User approves application with verified credentials (HTTP 200)', approveRes.status === 200 && approveRes.data?.status === 'approved', `Status: ${approveRes.data?.status}`);

  // Verify applicant user record updated with mentorUnlocked
  const userCheckRes = await request('GET', `/users/${arjunUserId}`, null, suHeaders);
  const isMentorUnlocked = userCheckRes.data?.profile?.mentorUnlocked || userCheckRes.data?.mentorUnlocked || userCheckRes.data?.role === 'Mentor';
  check('Applicant user record updated with mentor access (mentorUnlocked)', Boolean(isMentorUnlocked), `mentorUnlocked: ${userCheckRes.data?.profile?.mentorUnlocked}`);

  // Verify applicant received notification
  const notifRes = await request('GET', '/notifications', null, collabHeaders);
  const hasApproveNotif = Array.isArray(notifRes.data) && notifRes.data.some(n => n.type === 'MENTOR_APPLICATION_APPROVED' || (n.title && n.title.includes('Approved')));
  check('Applicant received MENTOR_APPLICATION_APPROVED notification', Boolean(hasApproveNotif), `Notifications count: ${notifRes.data?.length}`);

  // 12. Test Case 8: Reject application with reason
  console.log('\n--- Step 9: Reject application with reason ---');
  // Create another application for reject test
  const rejectAppRes = await request('POST', '/mentor-applications', {
    userId: '99',
    name: 'Temporary Applicant',
    email: 'temp.applicant@teamforge.io',
    years: 5,
    skills: ['DevOps'],
    bio: 'DevOps enthusiast looking to mentor.',
    cvFileName: 'temp_cv.pdf',
    certificates: [
      {
        issuer: 'DigiLocker',
        documentType: 'Certificate',
        documentNumber: 'DOC-TEMP-01',
        holderName: 'Temporary Applicant',
        issueDate: '2022-01-01',
        status: 'verified',
        verificationStatus: 'verified',
        verificationId: 'VERIF-TEMP-01',
      },
    ],
  }, suHeaders);

  const rejectAppId = rejectAppRes.data?.id;
  const rejectRes = await request('PUT', `/mentor-applications/${rejectAppId}/reject`, {
    reason: 'Portfolio does not meet required minimum specialization for this cohort.',
  }, adminHeaders);

  check('Reject application with reason succeeds (HTTP 200)', rejectRes.status === 200 && rejectRes.data?.status === 'rejected', `Status: ${rejectRes.data?.status}`);
  check('Rejection reason recorded in application entity', rejectRes.data?.rejectionReason === 'Portfolio does not meet required minimum specialization for this cohort.', `Reason: ${rejectRes.data?.rejectionReason}`);

  // 13. Verify Audit Log entries
  console.log('\n--- Step 10: Audit Log verification ---');
  const auditRes = await request('GET', '/admin/audit', null, suHeaders);
  const auditLogs = Array.isArray(auditRes.data) ? auditRes.data : [];
  const approveAudit = auditLogs.find(a => a.action === 'mentor-application-approved');
  const rejectAudit = auditLogs.find(a => a.action === 'mentor-application-rejected');
  const overrideAudit = auditLogs.find(a => a.action === 'mentor-application-approved-without-verification');
  check('Audit log records mentor-application-approved', Boolean(approveAudit), `Actor: ${approveAudit?.actor || approveAudit?.adminEmail}`);
  check('Audit log records mentor-application-rejected', Boolean(rejectAudit), `Actor: ${rejectAudit?.actor || rejectAudit?.adminEmail}`);
  check('Audit log records mentor-application-approved-without-verification override', Boolean(overrideAudit), `Actor: ${overrideAudit?.actor}, Event: ${overrideAudit?.event}`);

  console.log('\n====================================================');
  const passed = results.filter(r => r.pass).length;
  const total = results.length;
  console.log(`RESULTS: ${passed}/${total} checks PASSED`);
  console.log('====================================================');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
