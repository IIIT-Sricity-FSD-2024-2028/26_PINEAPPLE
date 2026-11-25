const http = require('http');
const zlib = require('zlib');
const fs = require('fs');

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
  console.log('--- PHASE 2: BENCHMARKING OPTIMIZED BACKEND ENDPOINTS ---');

  // 1. Login with seeded test user (Priya Patel, student)
  console.log('Logging in as student...');
  const loginRes = await makeRequest({
    method: 'POST',
    path: '/auth/login',
    body: { email: 'priya@example.com', password: 'Password@123' },
  });

  const studentToken = loginRes.data?.data?.accessToken || loginRes.data?.accessToken;
  const studentRefreshToken = loginRes.data?.data?.refreshToken || loginRes.data?.refreshToken;

  // 2. Login as admin
  console.log('Logging in as admin...');
  const adminLoginRes = await makeRequest({
    method: 'POST',
    path: '/auth/login',
    body: { email: 'admin@pinnacle.edu', password: 'Password@123' },
  });
  const adminToken = adminLoginRes.data?.data?.accessToken || adminLoginRes.data?.accessToken;

  // 3. Login as mentor
  console.log('Logging in as mentor...');
  const mentorLoginRes = await makeRequest({
    method: 'POST',
    path: '/auth/login',
    body: { email: 'rajesh@example.com', password: 'Password@123' },
  });
  const mentorToken = mentorLoginRes.data?.data?.accessToken || mentorLoginRes.data?.accessToken;

  console.log('Tokens acquired. Testing endpoints (1 cold run + 2 warm runs)...');

  const studentAuth = { Authorization: `Bearer ${studentToken}` };
  const adminAuth = { Authorization: `Bearer ${adminToken}` };
  const mentorAuth = { Authorization: `Bearer ${mentorToken}` };

  const endpoints = [
    { name: 'POST /auth/login (Student)', method: 'POST', path: '/auth/login', body: { email: 'priya@example.com', password: 'Password@123' } },
    { name: 'POST /auth/refresh', method: 'POST', path: '/auth/refresh', body: { refreshToken: studentRefreshToken } },
    { name: 'GET /auth/me', method: 'GET', path: '/auth/me', headers: studentAuth },
    { name: 'GET /projects (Marketplace)', method: 'GET', path: '/projects', headers: studentAuth },
    { name: 'GET /projects/1 (Detail)', method: 'GET', path: '/projects/1', headers: studentAuth },
    { name: 'GET /projects/my/projects', method: 'GET', path: '/projects/my/projects', headers: studentAuth },
    { name: 'GET /tasks/project/1', method: 'GET', path: '/tasks/project/1', headers: studentAuth },
    { name: 'GET /projects/1/join-requests', method: 'GET', path: '/projects/1/join-requests', headers: studentAuth },
    { name: 'GET /projects/1/members', method: 'GET', path: '/projects/1/members', headers: studentAuth },
    { name: 'GET /communication/projects/1/messages', method: 'GET', path: '/communication/projects/1/messages', headers: studentAuth },
    { name: 'GET /notifications', method: 'GET', path: '/notifications', headers: studentAuth },
    { name: 'GET /notifications/unread-count', method: 'GET', path: '/notifications/unread-count', headers: studentAuth },
    { name: 'GET /leaderboard', method: 'GET', path: '/leaderboard', headers: studentAuth },
    { name: 'GET /users/me/profile', method: 'GET', path: '/users/me/profile', headers: studentAuth },
    { name: 'GET /users/1/public-profile', method: 'GET', path: '/users/1/public-profile', headers: studentAuth },
    { name: 'GET /users/dashboard-stats', method: 'GET', path: '/users/dashboard-stats', headers: studentAuth },
    { name: 'GET /users/recent-activity', method: 'GET', path: '/users/recent-activity', headers: studentAuth },
    { name: 'GET /marketplace/mentors', method: 'GET', path: '/marketplace/mentors', headers: studentAuth },
    { name: 'GET /mentors/sessions/my', method: 'GET', path: '/mentors/sessions/my', headers: mentorAuth },
    { name: 'GET /mentors/earnings', method: 'GET', path: '/mentors/earnings', headers: mentorAuth },
    { name: 'GET /admin/users', method: 'GET', path: '/admin/users', headers: adminAuth },
    { name: 'GET /admin/projects', method: 'GET', path: '/admin/projects', headers: adminAuth },
    { name: 'GET /admin/mentor-applications', method: 'GET', path: '/admin/mentor-applications', headers: adminAuth },
    { name: 'GET /admin/escrow', method: 'GET', path: '/admin/escrow', headers: adminAuth },
    { name: 'GET /admin/stats', method: 'GET', path: '/admin/stats', headers: adminAuth },
    { name: 'GET /admin/audit', method: 'GET', path: '/admin/audit', headers: adminAuth },
    { name: 'GET /admin/config/public', method: 'GET', path: '/admin/config/public' },
    { name: 'GET /health', method: 'GET', path: '/health' },
  ];

  const results = [];

  for (const ep of endpoints) {
    const times = [];
    let coldTime = 0;
    let worstTime = 0;
    let lastResult = null;

    for (let runIdx = 0; runIdx < 3; runIdx++) {
      const res = await makeRequest({
        method: ep.method,
        path: ep.path,
        headers: ep.headers,
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
      cold: coldTime.toFixed(2),
      median: med.toFixed(2),
      worst: worstTime.toFixed(2),
      serverTiming: lastResult.serverTiming,
    });
  }

  // Sort by median duration descending
  results.sort((a, b) => parseFloat(b.median) - parseFloat(a.median));

  console.log('\n--- MEASUREMENT RESULTS (SORTED BY SLOWEST MEDIAN) ---');
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
