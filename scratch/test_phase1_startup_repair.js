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

async function verifyStartupRepair() {
  console.log('=== VERIFYING STARTUP DATA REPAIR ===');
  // Admin stats / audit logs inspection
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: { identifier: 'superuser@teamforge.io', password: 'Super@123' },
  });
  assert.strictEqual(adminLogin.status, 200);
  const token = adminLogin.data.accessToken || adminLogin.data.token;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'x-user-role': 'superuser',
    'x-user-id': 'super-1',
  };

  const auditRes = await request('/admin/audit', { headers });
  assert.strictEqual(auditRes.status, 200);
  const logs = Array.isArray(auditRes.data) ? auditRes.data : auditRes.data.logs;
  const statusChangedLogs = logs.filter(l => l.action === 'mentor-status-changed');
  assert(statusChangedLogs.length > 0, 'Found mentor-status-changed audit entries');
  console.log(`✓ Verified ${statusChangedLogs.length} mentor-status-changed audit log entries recorded`);

  const appsRes = await request('/mentor-applications', { headers });
  assert.strictEqual(appsRes.status, 200);
  console.log(`✓ Total applications tracked: ${appsRes.data.length}`);

  console.log('=== STARTUP DATA REPAIR VERIFICATION PASSED ===');
}

verifyStartupRepair().catch(err => {
  console.error(err);
  process.exit(1);
});
