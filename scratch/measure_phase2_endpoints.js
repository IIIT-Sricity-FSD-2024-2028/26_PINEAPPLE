const http = require('http');
const fs = require('fs');
const zlib = require('zlib');

function makeRequest({ method = 'GET', path, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const startTime = process.hrtime.bigint();
    const reqHeaders = { 'Accept-Encoding': 'gzip, deflate', ...headers };
    let bodyData = null;
    if (body) {
      bodyData = typeof body === 'string' ? body : JSON.stringify(body);
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(bodyData);
    }

    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path,
        method,
        headers: reqHeaders,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const endTime = process.hrtime.bigint();
          const duration = Number(endTime - startTime) / 1e6;
          const rawBuffer = Buffer.concat(chunks);
          const isGzip = res.headers['content-encoding'] === 'gzip';
          let bodyStr = '';
          try {
            if (isGzip) {
              bodyStr = zlib.gunzipSync(rawBuffer).toString('utf8');
            } else {
              bodyStr = rawBuffer.toString('utf8');
            }
          } catch (_) {
            bodyStr = rawBuffer.toString('utf8');
          }

          let parsed = null;
          try {
            parsed = JSON.parse(bodyStr);
          } catch (_) {}

          const serverTiming = res.headers['server-timing'] || '';
          resolve({
            status: res.statusCode,
            headers: res.headers,
            duration,
            serverTiming,
            sizeBytes: rawBuffer.length,
            isGzip,
            data: parsed,
          });
        });
      }
    );

    req.on('error', reject);
    if (bodyData) req.write(bodyData);
    req.end();
  });
}

function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function run() {
  console.log('--- PHASE 2 BACKEND ENDPOINT MEASUREMENTS ---');

  // 1. Admin login (Priya Patel, admin)
  const adminLoginRes = await makeRequest({
    method: 'POST',
    path: '/auth/login',
    body: { identifier: 'priya.patel@teamforge.io', password: 'password123' },
  });
  const adminToken = adminLoginRes.data?.accessToken;
  const refreshToken = adminLoginRes.data?.refreshToken;

  // 2. Collab login (Arjun Sharma)
  const collabLoginRes = await makeRequest({
    method: 'POST',
    path: '/auth/login',
    body: { identifier: 'arjun.sharma@teamforge.io', password: 'password123' },
  });
  const collabToken = collabLoginRes.data?.accessToken;

  // 3. Mentor login (Kiran Bose)
  const mentorLoginRes = await makeRequest({
    method: 'POST',
    path: '/auth/login',
    body: { identifier: 'kiran.bose@teamforge.io', password: 'password123' },
  });
  const mentorToken = mentorLoginRes.data?.accessToken;

  const endpoints = [
    {
      name: 'auth: login',
      method: 'POST',
      path: '/auth/login',
      body: { identifier: 'priya.patel@teamforge.io', password: 'password123' },
      token: null,
    },
    {
      name: 'auth: refresh',
      method: 'POST',
      path: '/auth/refresh',
      body: { refreshToken },
      token: null,
    },
    {
      name: 'auth: me',
      method: 'GET',
      path: '/auth/me',
      token: adminToken,
    },
    {
      name: 'platform: config',
      method: 'GET',
      path: '/admin/config/public',
      token: null,
    },
    {
      name: 'projects: list',
      method: 'GET',
      path: '/projects',
      token: adminToken,
    },
    {
      name: 'projects: get by id',
      method: 'GET',
      path: '/projects/proj-1',
      token: adminToken,
    },
    {
      name: 'projects: my projects (owner)',
      method: 'GET',
      path: '/projects/owner/1',
      token: adminToken,
    },
    {
      name: 'tasks: by project',
      method: 'GET',
      path: '/tasks/project/proj-1',
      token: adminToken,
    },
    {
      name: 'join requests: list',
      method: 'GET',
      path: '/join-requests',
      token: adminToken,
    },
    {
      name: 'chat: project messages',
      method: 'GET',
      path: '/communication/messages/project/proj-1',
      token: adminToken,
    },
    {
      name: 'notifications: list',
      method: 'GET',
      path: '/notifications',
      token: adminToken,
    },
    {
      name: 'notifications: communication unread',
      method: 'GET',
      path: '/communication/notifications',
      token: adminToken,
    },
    {
      name: 'gamification: leaderboard alltime',
      method: 'GET',
      path: '/leaderboard?period=alltime',
      token: adminToken,
    },
    {
      name: 'gamification: leaderboard monthly',
      method: 'GET',
      path: '/leaderboard?period=monthly',
      token: adminToken,
    },
    {
      name: 'gamification: user stats',
      method: 'GET',
      path: '/gamification/1/stats',
      token: adminToken,
    },
    {
      name: 'gamification: user ledger',
      method: 'GET',
      path: '/gamification/1/ledger',
      token: adminToken,
    },
    {
      name: 'users: user profile (id)',
      method: 'GET',
      path: '/users/1',
      token: adminToken,
    },
    {
      name: 'users: public profile',
      method: 'GET',
      path: '/users/1/public-profile',
      token: adminToken,
    },
    {
      name: 'mentor marketplace: list mentors',
      method: 'GET',
      path: '/mentor-marketplace/mentors',
      token: adminToken,
    },
    {
      name: 'mentor marketplace: sessions',
      method: 'GET',
      path: '/mentor-marketplace/sessions',
      token: adminToken,
    },
    {
      name: 'mentor marketplace: sessions mine',
      method: 'GET',
      path: '/mentor-marketplace/sessions/mine',
      token: adminToken,
    },
    {
      name: 'mentor marketplace: mentor view (earnings)',
      method: 'GET',
      path: '/mentor-marketplace/sessions/mentor-view',
      token: mentorToken,
    },
    {
      name: 'mentor marketplace: admin stats (revenue/escrow)',
      method: 'GET',
      path: '/mentor-marketplace/sessions/admin-stats',
      token: adminToken,
    },
    {
      name: 'mentor applications: list',
      method: 'GET',
      path: '/mentor-applications',
      token: adminToken,
    },
    {
      name: 'escrow: list all',
      method: 'GET',
      path: '/escrow',
      token: adminToken,
    },
    {
      name: 'admin: users list',
      method: 'GET',
      path: '/admin/users',
      token: adminToken,
    },
    {
      name: 'admin: dashboard stats',
      method: 'GET',
      path: '/admin/stats',
      token: adminToken,
    },
    {
      name: 'admin: audit log',
      method: 'GET',
      path: '/admin/audit',
      token: adminToken,
    },
  ];

  const results = [];

  for (const ep of endpoints) {
    const times = [];
    let coldTime = 0;
    let worstTime = 0;
    let lastResult = null;

    for (let runIdx = 0; runIdx < 3; runIdx++) {
      const headers = {};
      if (ep.token) {
        headers['Authorization'] = `Bearer ${ep.token}`;
      }

      const res = await makeRequest({
        method: ep.method,
        path: ep.path,
        headers,
        body: ep.body,
      });

      times.push(res.duration);
      if (runIdx === 0) coldTime = res.duration;
      if (res.duration > worstTime) worstTime = res.duration;
      lastResult = res;
    }

    const med = median(times);
    results.push({
      name: ep.name,
      method: ep.method,
      path: ep.path,
      status: lastResult.status,
      sizeBytes: lastResult.sizeBytes,
      isGzip: lastResult.isGzip,
      runs: times.map((t) => t.toFixed(2)),
      cold: coldTime.toFixed(2),
      median: med.toFixed(2),
      worst: worstTime.toFixed(2),
      serverTiming: lastResult.serverTiming,
    });
  }

  // Sort by median duration descending
  results.sort((a, b) => parseFloat(b.median) - parseFloat(a.median));

  console.log('\n--- PHASE 2 RESULTS (SORTED BY SLOWEST MEDIAN) ---');
  console.log(
    'Endpoint'.padEnd(45) +
      'Method'.padEnd(8) +
      'Status'.padEnd(8) +
      'Bytes'.padEnd(8) +
      'Gzip'.padEnd(8) +
      'Cold(ms)'.padEnd(10) +
      'Median(ms)'.padEnd(12) +
      'Worst(ms)'
  );
  console.log('-'.repeat(110));

  for (const r of results) {
    console.log(
      r.name.padEnd(45) +
        r.method.padEnd(8) +
        String(r.status).padEnd(8) +
        String(r.sizeBytes).padEnd(8) +
        String(r.isGzip).padEnd(8) +
        r.cold.padEnd(10) +
        r.median.padEnd(12) +
        r.worst
    );
  }

  // Save to json file for reference
  fs.writeFileSync('scratch/phase2_backend_measurements.json', JSON.stringify(results, null, 2));
  console.log('\nSaved results to scratch/phase2_backend_measurements.json');
}

run().catch((err) => {
  console.error('Measurement failed:', err);
  process.exit(1);
});
