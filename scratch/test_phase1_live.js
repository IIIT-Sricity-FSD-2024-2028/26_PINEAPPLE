const http = require('http');

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(`http://localhost:3000${path}`);
    const req = http.request(parsedUrl, {
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

async function getUserToken() {
  const loginRes = await request('/auth/login', {
    method: 'POST',
    body: { identifier: 'arjun.sharma@teamforge.io', password: 'password123' },
  });
  if (loginRes.status !== 200) {
    throw new Error('User login failed: ' + JSON.stringify(loginRes.data));
  }
  return loginRes.data.accessToken || loginRes.data.token;
}

async function getAdminToken() {
  const loginRes = await request('/auth/login', {
    method: 'POST',
    body: { identifier: 'superuser@teamforge.io', password: 'Super@123' },
  });
  if (loginRes.status !== 200) {
    throw new Error('Super User login failed: ' + JSON.stringify(loginRes.data));
  }
  return loginRes.data.accessToken || loginRes.data.token;
}

async function runPhase1Checks() {
  console.log('=== PHASE 1 LIVE VERIFICATION ===\n');
  let passed = 0;
  let failed = 0;

  function check(desc, condition) {
    if (condition) {
      console.log(`PASS: ${desc}`);
      passed++;
    } else {
      console.error(`FAIL: ${desc}`);
      failed++;
    }
  }

  const token = await getUserToken();
  const adminToken = await getAdminToken();
  const userHeaders = { Authorization: `Bearer ${token}` };
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };

  // 1. Leaderboard periods - role-free check
  for (const period of ['alltime', 'monthly', 'weekly']) {
    const res = await request(`/leaderboard?period=${period}`, { headers: userHeaders });
    check(`GET /leaderboard?period=${period} returns 200`, res.status === 200);
    const list = res.data;
    check(`${period} leaderboard is non-empty array`, Array.isArray(list) && list.length > 0);

    // Stop returning role for leaderboard rows
    const anyHasRole = list.some(row => row.role !== undefined);
    check(`${period} rows do NOT return a role property`, !anyHasRole);

    // No name string includes a role or suffix
    const anyHasRoleSuffix = list.some(row => /\s*\([^)]*\)$/.test(row.user));
    check(`${period} row names contain NO role suffixes`, !anyHasRoleSuffix);

    // Exclude Admin and Super User accounts
    const hasAdmin = list.some(row =>
      String(row.user).toLowerCase().includes('admin') ||
      String(row.user).toLowerCase().includes('superuser') ||
      row.userId === 'u-admin' ||
      row.userId === 'u-superuser'
    );
    check(`${period} excludes Admin and Super User accounts`, !hasAdmin);

    // One row per person (no duplicate IDs or names)
    const ids = list.map(r => r.userId);
    const names = list.map(r => r.user.toLowerCase());
    check(`${period} has unique user IDs`, new Set(ids).size === ids.length);
    check(`${period} has unique contributor names`, new Set(names).size === names.length);
  }

  // 2. Profile vs Leaderboard consistency for at least 3 users
  const allTimeRes = await request('/leaderboard?period=alltime', { headers: userHeaders });
  const allTime = allTimeRes.data;
  const targetUsers = [
    { id: '2', name: 'Arjun Sharma' },
    { id: '4', name: 'Rohan Mehta' },
    { id: '5', name: 'Sneha Iyer' },
    { id: '7', name: 'Neha Gupta' },
  ];

  for (const tu of targetUsers) {
    const userRes = await request(`/users/${tu.id}`, { headers: userHeaders });
    check(`GET /users/${tu.id} returns 200`, userRes.status === 200);
    const uData = userRes.data;
    const lbRow = allTime.find(r => String(r.userId) === String(tu.id));
    check(`User ${tu.name} found on leaderboard`, !!lbRow);

    const userXp = uData.profile?.xp ?? uData.xp ?? 0;
    const userRep = uData.profile?.rep ?? uData.rep ?? 0;
    check(`User ${tu.name} XP matches Profile (${lbRow?.xp} === ${userXp})`, lbRow?.xp === userXp);
    check(`User ${tu.name} Rep matches Profile (${lbRow?.rep} === ${userRep})`, lbRow?.rep === userRep);
  }

  // 3. Aditya Sai vs Aditya Analysis
  console.log('\n--- Aditya Sai vs Aditya Investigation ---');
  const u6Res = await request('/users/6', { headers: userHeaders });
  const ucRes = await request('/users/u-collab', { headers: userHeaders });
  check('User 6 exists', u6Res.status === 200);
  check('User u-collab exists', ucRes.status === 200);
  const u6 = u6Res.data;
  const uc = ucRes.data;

  console.log(`  Account 1: ID="${u6.id}", Name="${u6.name}", Email="${u6.email}", Username="${u6.username}", Uni="${u6.university}", XP=${u6.profile?.xp}`);
  console.log(`  Account 2: ID="${uc.id}", Name="${uc.name}", Email="${uc.email}", Username="${uc.username}", Uni="${uc.university}", XP=${uc.profile?.xp}`);

  check('Aditya Sai and Aditya have distinct IDs', u6.id !== uc.id);
  check('Aditya Sai and Aditya have distinct Emails', u6.email !== uc.email);
  check('Aditya Sai and Aditya have distinct Usernames', u6.username !== uc.username);
  check('Aditya Sai and Aditya have distinct Universities', u6.university !== uc.university);
  check('Aditya Sai and Aditya have distinct XP values', u6.profile?.xp !== uc.profile?.xp);

  // Both should be on alltime leaderboard as distinct persons
  const hasU6 = allTime.some(r => String(r.userId) === '6');
  const hasUc = allTime.some(r => String(r.userId) === 'u-collab');
  check('Aditya Sai is on alltime leaderboard', hasU6);
  check('Aditya is on alltime leaderboard', hasUc);

  // 4. Admin Users list role-free name check
  const adminUsersRes = await request('/admin/users', { headers: adminHeaders });
  check('GET /admin/users returns 200', adminUsersRes.status === 200);
  const adminUsers = adminUsersRes.data;
  const adminNamesNoSuffix = adminUsers.every(u => !/\s*\([^)]*\)$/.test(u.name));
  check('Admin Users list names have NO role suffixes', adminNamesNoSuffix);
  const adminUsersNoAdmins = adminUsers.every(u =>
    String(u.role).toLowerCase() !== 'admin' &&
    String(u.role).toLowerCase() !== 'administrator' &&
    String(u.role).toLowerCase() !== 'superuser' &&
    String(u.role).toLowerCase() !== 'super user'
  );
  check('Admin Users list excludes portal Admins/SuperUsers', adminUsersNoAdmins);

  console.log(`\n=== SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) process.exit(1);
}

runPhase1Checks().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
