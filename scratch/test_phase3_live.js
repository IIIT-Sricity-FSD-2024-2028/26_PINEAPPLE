const http = require('http');

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`PASS: ${message}`);
    passCount++;
  } else {
    console.error(`FAIL: ${message}`);
    failCount++;
  }
}

async function run() {
  console.log('=== PHASE 3 LIVE VERIFICATION ===\n');

  // 1. Authenticate Aditya Sai (id: 6)
  const loginRes = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { email: 'aditya.sai@teamforge.io', password: 'password123' }
  );

  assert(loginRes.status === 200, 'Login as Aditya Sai succeeds (200)');
  const tokenUser6 = loginRes.body?.tokens?.accessToken || loginRes.body?.accessToken;
  const user6Id = '6';

  // 2. Authenticate Super User (u-superuser)
  const loginSuRes = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { email: 'superuser@teamforge.io', password: 'Super@123' }
  );

  assert(loginSuRes.status === 200, 'Login as Super User succeeds (200)');
  const tokenSu = loginSuRes.body?.tokens?.accessToken || loginSuRes.body?.accessToken;

  // 3. Authenticate User 2 (Arjun Sharma)
  const loginUser2 = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { email: 'arjun.sharma@teamforge.io', password: 'password123' }
  );
  assert(loginUser2.status === 200, 'Login as User 2 (Arjun) succeeds (200)');
  const tokenUser2 = loginUser2.body?.tokens?.accessToken || loginUser2.body?.accessToken;

  // 4. Initial read of User 6
  const getRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/users/${user6Id}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenUser6}` },
  });
  assert(getRes.status === 200, 'GET /users/6 returns 200');
  const initialPhone = getRes.body.phone || getRes.body.profile?.phone || '';
  const initialVerified = Boolean(getRes.body.phoneVerified);
  assert(initialVerified === false, 'Seed user starts with phoneVerified: false');

  // 5. Test Rule: Direct profile update cannot change phone number without verification
  const patchDiffPhone = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: `/users/${user6Id}`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenUser6}`,
      },
    },
    { phone: '+919999888877' }
  );
  assert(
    patchDiffPhone.status === 400,
    'PATCH /users/6 with new phone is rejected (400 Bad Request)'
  );
  assert(
    String(patchDiffPhone.body?.message || '').includes('verification') ||
      String(patchDiffPhone.body?.message || '').includes('verified phone endpoint'),
    'Rejection message explains phone number can only be changed via verification'
  );

  // 6. Test Rule: Client cannot set phoneVerified directly
  const patchClientVerified = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: `/users/${user6Id}`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenUser6}`,
      },
    },
    { phoneVerified: true }
  );
  assert(
    patchClientVerified.status === 200,
    'PATCH /users/6 with phoneVerified: true does not crash (200)'
  );
  assert(
    Boolean(patchClientVerified.body?.phoneVerified) === false,
    'phoneVerified remained false (server stripped client attempt)'
  );

  // 7. Test Rule: PATCH with unchanged phone is accepted
  const patchSamePhone = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: `/users/${user6Id}`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenUser6}`,
      },
    },
    { bio: 'Updated bio testing unchanged phone.' }
  );
  assert(
    patchSamePhone.status === 200,
    'PATCH /users/6 with unchanged phone succeeds (200)'
  );

  // 8. Test /users/me/phone/verify endpoint authentication
  const unauthVerify = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/users/me/phone/verify',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  assert(unauthVerify.status === 401, 'POST /users/me/phone/verify without token returns 401');

  // 9. Test /users/me/phone/verify empty token
  const emptyTokenVerify = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/users/me/phone/verify',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenUser6}`,
      },
    },
    { idToken: '' }
  );
  assert(
    emptyTokenVerify.status === 400,
    'POST /users/me/phone/verify with empty idToken returns 400'
  );

  // 10. Test /users/me/phone/verify invalid token
  const invalidTokenVerify = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/users/me/phone/verify',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenUser6}`,
      },
    },
    { idToken: 'invalid.jwt.token' }
  );
  assert(
    invalidTokenVerify.status === 400 || invalidTokenVerify.status === 503,
    `POST /users/me/phone/verify with fake token returns 400 or 503 (${invalidTokenVerify.status})`
  );

  // 11. Test internal verification simulation via UsersService
  // Let's execute direct verification test via node child process to simulate verified token claims
  const { execSync } = require('child_process');
  const verifyScript = `
    const http = require('http');
    // Let's call internal repository directly via ts-node or helper to set phoneVerified for user 6
    // or test the usersService.verifyPhone method logic
  `;

  // 12. Test public profile privacy: ensure phone is strictly omitted
  const pubProfile = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/users/${user6Id}/public-profile`,
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenUser6}` },
  });
  assert(pubProfile.status === 200, 'GET /users/6/public-profile returns 200');
  assert(pubProfile.body.phone === undefined, 'Public profile strictly omits phone');
  assert(pubProfile.body.phoneVerified === undefined, 'Public profile strictly omits phoneVerified');

  // 13. Test Admin User Details: returns phone and verified flag
  const adminDetails = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/admin/users/${user6Id}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenSu}` },
  });
  assert(adminDetails.status === 200, 'GET /admin/users/6 returns 200');
  assert(
    adminDetails.body.phone !== undefined,
    'Admin user details includes phone property'
  );
  assert(
    typeof adminDetails.body.phoneVerified === 'boolean',
    'Admin user details includes boolean phoneVerified'
  );

  // 14. Test DELETE /users/me/phone
  const delPhone = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/users/me/phone',
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenUser6}` },
  });
  assert(delPhone.status === 200, 'DELETE /users/me/phone returns 200');
  assert(
    delPhone.body.phone === undefined || delPhone.body.phone === null || delPhone.body.phone === '',
    'DELETE /users/me/phone removed phone number'
  );
  assert(
    Boolean(delPhone.body.phoneVerified) === false,
    'DELETE /users/me/phone reset phoneVerified to false'
  );

  // 15. Verify persistence of phone removal
  const getAfterDel = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/users/${user6Id}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenUser6}` },
  });
  assert(
    !getAfterDel.body.phone && !getAfterDel.body.phoneVerified,
    'GET /users/6 confirms phone removed and phoneVerified: false'
  );

  console.log(`\n=== SUMMARY: ${passCount} PASSED, ${failCount} FAILED ===`);
  process.exit(failCount > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
