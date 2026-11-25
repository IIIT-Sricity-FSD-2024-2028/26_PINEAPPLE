const http = require('http');

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body
      ? typeof body === 'string'
        ? body
        : JSON.stringify(body)
      : null;

    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers,
    };
    if (payload) {
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    } else if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      reqHeaders['Content-Length'] = 0;
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 3000,
        path,
        method,
        headers: reqHeaders,
      },
      (res) => {
        let resBody = '';
        res.on('data', (chunk) => (resBody += chunk));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(resBody);
          } catch {
            json = resBody;
          }
          resolve({ status: res.statusCode, body: json });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('=== Starting Phase 2 Verification ===\n');
  let passCount = 0;
  let totalTests = 0;

  function assert(scenario, condition, details = '') {
    totalTests++;
    if (condition) {
      passCount++;
      console.log(`[PASS] ${scenario}`);
    } else {
      console.error(`[FAIL] ${scenario} - ${details}`);
    }
  }

  // 1. Admin login to obtain admin token
  const adminLogin = await request('POST', '/auth/login', {
    identifier: 'superuser@teamforge.io',
    password: 'Super@123',
  });
  const adminToken = adminLogin.body?.accessToken || adminLogin.body?.token;
  assert('Admin login succeeds', adminLogin.status === 200 && Boolean(adminToken));

  // 2. Direct DELETE /projects/:id must return 404 Not Found (route removed)
  const deleteProj = await request('DELETE', '/projects/proj-1', null, {
    Authorization: `Bearer ${adminToken}`,
  });
  assert(
    'DELETE /projects/:id returns 404 (route removed)',
    deleteProj.status === 404,
    `Status was ${deleteProj.status}, expected 404`
  );

  // 3. Direct DELETE /projects/:id without auth must also return 404 (not 401/403)
  const deleteProjNoAuth = await request('DELETE', '/projects/proj-1');
  assert(
    'DELETE /projects/:id without auth returns 404 (route not found at all)',
    deleteProjNoAuth.status === 404,
    `Status was ${deleteProjNoAuth.status}, expected 404`
  );

  // 4. Any direct calls to suspend project endpoints return 404
  const suspendProjPut = await request('PUT', '/projects/proj-1/suspend', null, {
    Authorization: `Bearer ${adminToken}`,
  });
  assert(
    'PUT /projects/:id/suspend returns 404',
    suspendProjPut.status === 404,
    `Status was ${suspendProjPut.status}, expected 404`
  );

  const suspendProjPost = await request('POST', '/projects/proj-1/suspend', null, {
    Authorization: `Bearer ${adminToken}`,
  });
  assert(
    'POST /projects/:id/suspend returns 404',
    suspendProjPost.status === 404,
    `Status was ${suspendProjPost.status}, expected 404`
  );

  // 5. PATCH /projects/:id with status 'Suspended' is rejected with 400 Bad Request
  const patchSuspended = await request('PATCH', '/projects/proj-1', { status: 'Suspended' }, {
    Authorization: `Bearer ${adminToken}`,
    'x-user-role': 'superuser',
    'x-user-id': 'u-superuser',
  });
  assert(
    'PATCH /projects/:id with status Suspended returns 400',
    patchSuspended.status === 400,
    `Status was ${patchSuspended.status}, expected 400: ${JSON.stringify(patchSuspended.body)}`
  );

  // 6. GET /projects returns 200 and lists projects
  const listProjects = await request('GET', '/projects', null, {
    Authorization: `Bearer ${adminToken}`,
  });
  assert(
    'GET /projects returns 200 with project list',
    listProjects.status === 200 && Array.isArray(listProjects.body) && listProjects.body.length > 0,
    `Status: ${listProjects.status}`
  );

  // 7. GET /projects/:id returns 200 with full metadata (read-only view data preserved)
  const getProj = await request('GET', '/projects/proj-1', null, {
    Authorization: `Bearer ${adminToken}`,
  });
  assert(
    'GET /projects/proj-1 returns 200 with metadata',
    getProj.status === 200 && getProj.body?.id === 'proj-1' && Boolean(getProj.body?.title),
    `Status: ${getProj.status}`
  );

  // 8. Admin stats & dashboard counts still work
  const adminStats = await request('GET', '/admin/stats', null, {
    Authorization: `Bearer ${adminToken}`,
  });
  assert(
    'GET /admin/stats returns 200 with statistics',
    adminStats.status === 200 && typeof adminStats.body?.totalProjects === 'number',
    `Status: ${adminStats.status}`
  );

  // 9. User moderation STILL WORKS: Suspend user
  const suspendUserRes = await request('PUT', '/admin/users/2/suspend', null, {
    Authorization: `Bearer ${adminToken}`,
    'x-user-role': 'superuser',
    'x-user-id': 'u-superuser',
  });
  assert(
    'User suspend PUT /admin/users/:id/suspend returns 200',
    suspendUserRes.status === 200,
    `Status was ${suspendUserRes.status}`
  );

  // 10. User moderation STILL WORKS: Reactivate user
  const reactivateUserRes = await request('PATCH', '/admin/users/2/status', { status: 'Active' }, {
    Authorization: `Bearer ${adminToken}`,
    'x-user-role': 'superuser',
    'x-user-id': 'u-superuser',
  });
  assert(
    'User reactivate PATCH /admin/users/:id/status returns 200',
    reactivateUserRes.status === 200,
    `Status was ${reactivateUserRes.status}`
  );

  console.log(`\n=== Verification Complete: ${passCount}/${totalTests} Passed ===`);
  if (passCount === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
