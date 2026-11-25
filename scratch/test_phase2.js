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

async function runTests() {
  console.log('=== PHASE 2 INTEGRATION VERIFICATION ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`PASS: ${message}`);
      passed++;
    } else {
      console.error(`FAIL: ${message}`);
      failed++;
    }
  }

  const userToken = await getUserToken();
  const authHeaders = { Authorization: `Bearer ${userToken}` };

  // 1. All-time Leaderboard
  const allTimeRes = await request('/leaderboard?period=alltime', { headers: authHeaders });
  assert(allTimeRes.status === 200, 'GET /leaderboard?period=alltime returns 200');
  const allTimeEntries = allTimeRes.data;
  assert(Array.isArray(allTimeEntries), 'All-time leaderboard is an array');

  // Check no admins/superusers in alltime
  const hasAdminAllTime = allTimeEntries.some(e => 
    String(e.user).toLowerCase().includes('admin') || 
    String(e.user).toLowerCase().includes('superuser') ||
    String(e.user).toLowerCase().includes('super user') ||
    String(e.user).toLowerCase().includes('priya patel') ||
    e.userId === 'u-admin' || e.userId === 'u-superuser' || e.userId === '1'
  );
  assert(!hasAdminAllTime, 'All-time tab contains NO Admin, Super User, or Administrator accounts');

  // Check no role suffix in names
  const hasRoleSuffixAllTime = allTimeEntries.some(e => 
    /\s*\([^)]*\)$/.test(e.user) ||
    e.user.includes('(Mentor)') ||
    e.user.includes('(Project Owner)') ||
    e.user.includes('(Collaborator)')
  );
  assert(!hasRoleSuffixAllTime, 'All-time tab contributor names contain NO role suffixes');

  // Check unique users (one row per person)
  const allTimeUserIds = allTimeEntries.map(e => String(e.userId));
  const uniqueUserIds = new Set(allTimeUserIds);
  assert(allTimeUserIds.length === uniqueUserIds.size, 'Each contributor appears exactly once (no duplicates by user ID)');

  const allTimeNames = allTimeEntries.map(e => e.user.toLowerCase());
  const uniqueNames = new Set(allTimeNames);
  assert(allTimeNames.length === uniqueNames.size, 'Each contributor appears exactly once (no duplicate names like Rohan Mehta)');

  // Check dense ranking (1..n without gaps, ties share rank)
  let ranksValid = true;
  for (let i = 0; i < allTimeEntries.length; i++) {
    const entry = allTimeEntries[i];
    if (i === 0) {
      if (entry.rank !== 1) ranksValid = false;
    } else {
      const prev = allTimeEntries[i - 1];
      if (entry.xp === prev.xp) {
        if (entry.rank !== prev.rank) ranksValid = false;
      } else {
        if (entry.rank !== prev.rank + 1) ranksValid = false;
      }
    }
  }
  assert(ranksValid, 'All-time ranking is dense (1..n without gaps, ties get same rank)');

  // 2. Monthly Leaderboard
  const monthlyRes = await request('/leaderboard?period=monthly', { headers: authHeaders });
  assert(monthlyRes.status === 200, 'GET /leaderboard?period=monthly returns 200');
  const monthlyEntries = monthlyRes.data;
  const hasAdminMonthly = monthlyEntries.some(e => 
    String(e.user).toLowerCase().includes('admin') || 
    String(e.user).toLowerCase().includes('superuser') ||
    e.userId === 'u-admin' || e.userId === 'u-superuser' || e.userId === '1'
  );
  assert(!hasAdminMonthly, 'Monthly tab contains NO Admin, Super User, or Administrator accounts');
  const hasRoleSuffixMonthly = monthlyEntries.some(e => /\s*\([^)]*\)$/.test(e.user));
  assert(!hasRoleSuffixMonthly, 'Monthly tab contributor names contain NO role suffixes');

  // 3. Weekly Leaderboard
  const weeklyRes = await request('/leaderboard?period=weekly', { headers: authHeaders });
  assert(weeklyRes.status === 200, 'GET /leaderboard?period=weekly returns 200');
  const weeklyEntries = weeklyRes.data;
  const hasAdminWeekly = weeklyEntries.some(e => 
    String(e.user).toLowerCase().includes('admin') || 
    String(e.user).toLowerCase().includes('superuser') ||
    e.userId === 'u-admin' || e.userId === 'u-superuser' || e.userId === '1'
  );
  assert(!hasAdminWeekly, 'Weekly tab contains NO Admin, Super User, or Administrator accounts');
  const hasRoleSuffixWeekly = weeklyEntries.some(e => /\s*\([^)]*\)$/.test(e.user));
  assert(!hasRoleSuffixWeekly, 'Weekly tab contributor names contain NO role suffixes');

  // 4. Compare numbers with Profile page (via GET /users/:id) for at least 3 users
  // User 2: Arjun Sharma
  const u2Res = await request('/users/2', { headers: authHeaders });
  assert(u2Res.status === 200, 'GET /users/2 returns 200');
  const u2Leaderboard = allTimeEntries.find(e => String(e.userId) === '2');
  assert(Boolean(u2Leaderboard), 'User 2 (Arjun Sharma) found on leaderboard');
  if (u2Leaderboard) {
    const matchXp = u2Leaderboard.xp === u2Res.data.xp;
    const matchRep = u2Leaderboard.rep === u2Res.data.rep;
    const userTasks = u2Res.data.profile?.tasksCount ?? u2Res.data.tasksCompleted ?? 0;
    const matchTasks = u2Leaderboard.tasks === userTasks;
    assert(matchXp, `User 2 (Arjun Sharma) XP matches Profile: ${u2Leaderboard.xp} === ${u2Res.data.xp}`);
    assert(matchRep, `User 2 (Arjun Sharma) Rep matches Profile: ${u2Leaderboard.rep} === ${u2Res.data.rep}`);
    assert(matchTasks, `User 2 (Arjun Sharma) Tasks match Profile: ${u2Leaderboard.tasks} === ${userTasks}`);
  }

  // User 4: Rohan Mehta
  const u4Res = await request('/users/4', { headers: authHeaders });
  assert(u4Res.status === 200, 'GET /users/4 returns 200');
  const u4Leaderboard = allTimeEntries.find(e => String(e.userId) === '4');
  assert(Boolean(u4Leaderboard), 'User 4 (Rohan Mehta) found on leaderboard');
  if (u4Leaderboard) {
    const userTasks = u4Res.data.profile?.tasksCount ?? u4Res.data.tasksCompleted ?? 0;
    const matchXp = u4Leaderboard.xp === u4Res.data.xp;
    const matchRep = u4Leaderboard.rep === u4Res.data.rep;
    const matchTasks = u4Leaderboard.tasks === userTasks;
    assert(matchXp, `User 4 (Rohan Mehta) XP matches Profile: ${u4Leaderboard.xp} === ${u4Res.data.xp}`);
    assert(matchRep, `User 4 (Rohan Mehta) Rep matches Profile: ${u4Leaderboard.rep} === ${u4Res.data.rep}`);
    assert(matchTasks, `User 4 (Rohan Mehta) Tasks match Profile: ${u4Leaderboard.tasks} === ${userTasks}`);
  }

  // User 5: Sneha Iyer
  const u5Res = await request('/users/5', { headers: authHeaders });
  assert(u5Res.status === 200, 'GET /users/5 returns 200');
  const u5Leaderboard = allTimeEntries.find(e => String(e.userId) === '5');
  assert(Boolean(u5Leaderboard), 'User 5 (Sneha Iyer) found on leaderboard');
  if (u5Leaderboard) {
    const userTasks = u5Res.data.profile?.tasksCount ?? u5Res.data.tasksCompleted ?? 0;
    const matchXp = u5Leaderboard.xp === u5Res.data.xp;
    const matchRep = u5Leaderboard.rep === u5Res.data.rep;
    const matchTasks = u5Leaderboard.tasks === userTasks;
    assert(matchXp, `User 5 (Sneha Iyer) XP matches Profile: ${u5Leaderboard.xp} === ${u5Res.data.xp}`);
    assert(matchRep, `User 5 (Sneha Iyer) Rep matches Profile: ${u5Leaderboard.rep} === ${u5Res.data.rep}`);
    assert(matchTasks, `User 5 (Sneha Iyer) Tasks match Profile: ${u5Leaderboard.tasks} === ${userTasks}`);
  }

  // User 7: Neha Gupta
  const u7Res = await request('/users/7', { headers: authHeaders });
  assert(u7Res.status === 200, 'GET /users/7 returns 200');
  const u7Leaderboard = allTimeEntries.find(e => String(e.userId) === '7');
  assert(Boolean(u7Leaderboard), 'User 7 (Neha Gupta) found on leaderboard');
  if (u7Leaderboard) {
    const matchXp = u7Leaderboard.xp === u7Res.data.xp;
    const matchRep = u7Leaderboard.rep === u7Res.data.rep;
    assert(matchXp, `User 7 (Neha Gupta) XP matches Profile: ${u7Leaderboard.xp} === ${u7Res.data.xp}`);
    assert(matchRep, `User 7 (Neha Gupta) Rep matches Profile: ${u7Leaderboard.rep} === ${u7Res.data.rep}`);
  }

  // 5. Admin Users List Verification
  const adminToken = await getAdminToken();
  const adminUsersRes = await request('/admin/users', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(adminUsersRes.status === 200, 'GET /admin/users returns 200');
  const adminUsers = adminUsersRes.data;
  const adminUsersHasAdmin = adminUsers.some(u => 
    String(u.role).toLowerCase() === 'admin' ||
    String(u.role).toLowerCase() === 'administrator' ||
    String(u.role).toLowerCase() === 'superuser' ||
    String(u.role).toLowerCase() === 'super user' ||
    u.id === 'u-admin' || u.id === 'u-superuser'
  );
  assert(!adminUsersHasAdmin, 'Admin Users list excludes portal Admins and Super Users');
  const adminUsersHasDuplicate = adminUsers.some(u => u.id === 'u-mentor');
  assert(!adminUsersHasDuplicate, 'Admin Users list excludes duplicate seed account u-mentor');
  const adminUsersHasRoleSuffix = adminUsers.some(u => /\s*\([^)]*\)$/.test(u.name));
  assert(!adminUsersHasRoleSuffix, 'Admin Users list names have NO role suffixes');

  // 6. User Rank Endpoint Verification
  const userRankRes = await request('/leaderboard/2', { headers: authHeaders });
  assert(userRankRes.status === 200, 'GET /leaderboard/2 returns 200');
  assert(typeof userRankRes.data.rank === 'number' && userRankRes.data.rank > 0, `User 2 rank is valid: ${userRankRes.data.rank}`);

  console.log(`\n=== SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
