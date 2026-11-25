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
    body: { identifier: 'aditya.sai@teamforge.io', password: 'password123' },
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

async function runPhase2Checks() {
  console.log('=== PHASE 2 LIVE VERIFICATION ===\n');
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

  // 1. Check existing university value
  const initialRes = await request('/users/6', { headers: userHeaders });
  check('GET /users/6 returns 200', initialRes.status === 200);
  check('User 6 has initial university "VIT Vellore"', initialRes.data.university === 'VIT Vellore');
  check('User 6 profile has university "VIT Vellore"', initialRes.data.profile?.university === 'VIT Vellore');
  check('User 6 profile has uni alias "VIT Vellore"', initialRes.data.profile?.uni === 'VIT Vellore');

  // 2. Update university with valid name
  const updateRes1 = await request('/users/6', {
    method: 'PATCH',
    headers: userHeaders,
    body: { university: 'Indian Institute of Science, Bangalore' },
  });
  check('Update university returns 200', updateRes1.status === 200);
  check('Updated response contains new university', updateRes1.data.university === 'Indian Institute of Science, Bangalore');
  check('Updated response profile contains new university', updateRes1.data.profile?.university === 'Indian Institute of Science, Bangalore');
  check('Updated response profile contains uni alias', updateRes1.data.profile?.uni === 'Indian Institute of Science, Bangalore');

  // 3. Confirm persistence via subsequent GET
  const verifyRes = await request('/users/6', { headers: userHeaders });
  check('GET /users/6 reflects updated university', verifyRes.data.university === 'Indian Institute of Science, Bangalore');

  // 4. Confirm public-profile returns updated university
  const pubProfileRes = await request('/users/6/public-profile', { headers: userHeaders });
  check('GET /users/6/public-profile returns 200', pubProfileRes.status === 200);
  check('Public profile returns updated university', pubProfileRes.data.university === 'Indian Institute of Science, Bangalore');

  // 5. Validation: Length constraints (< 2 chars)
  const tooShortRes = await request('/users/6', {
    method: 'PATCH',
    headers: userHeaders,
    body: { university: 'A' },
  });
  check('Reject university with length < 2 (400 Bad Request)', tooShortRes.status === 400);

  // 6. Validation: Length constraints (> 100 chars)
  const tooLongRes = await request('/users/6', {
    method: 'PATCH',
    headers: userHeaders,
    body: { university: 'X'.repeat(101) },
  });
  check('Reject university with length > 100 (400 Bad Request)', tooLongRes.status === 400);

  // 7. Validation: Disallowed characters (<script>, HTML tags, symbols)
  const xssRes = await request('/users/6', {
    method: 'PATCH',
    headers: userHeaders,
    body: { university: 'Stanford <University>' },
  });
  check('Reject university with HTML tags/brackets (400 Bad Request)', xssRes.status === 400);

  const specialCharRes = await request('/users/6', {
    method: 'PATCH',
    headers: userHeaders,
    body: { university: 'Harvard University #1*!' },
  });
  check('Reject university with disallowed symbols (400 Bad Request)', specialCharRes.status === 400);

  // 8. Validation: Allowed punctuation (. , & - ' ( ))
  const allowedPunctRes = await request('/users/6', {
    method: 'PATCH',
    headers: userHeaders,
    body: { university: "St. Xavier's College (Autonomous), Dept. of Arts & Science - Mumbai" },
  });
  check('Accept university with allowed punctuation . , & - \' ( ) (200 OK)', allowedPunctRes.status === 200);
  check('Allowed punctuation university persisted', allowedPunctRes.data.university === "St. Xavier's College (Autonomous), Dept. of Arts & Science - Mumbai");

  // 9. Validation: Trimming whitespace
  const trimRes = await request('/users/6', {
    method: 'PATCH',
    headers: userHeaders,
    body: { university: '   BITS Pilani   ' },
  });
  check('Whitespace is trimmed on save', trimRes.data.university === 'BITS Pilani');

  // 10. Optional: Clearing university allows empty string
  const clearRes = await request('/users/6', {
    method: 'PATCH',
    headers: userHeaders,
    body: { university: '' },
  });
  check('Clearing university returns 200', clearRes.status === 200);
  check('University is cleared to empty string', clearRes.data.university === '');

  // Restore to original for clean state
  await request('/users/6', {
    method: 'PATCH',
    headers: userHeaders,
    body: { university: 'VIT Vellore' },
  });

  console.log(`\n=== SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) process.exit(1);
}

runPhase2Checks().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
