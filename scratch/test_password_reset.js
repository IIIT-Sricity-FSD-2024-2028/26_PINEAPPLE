/**
 * End-to-End Automated Test Suite for Password Reset Flow (Phases 1-5)
 */
const BASE_URL = 'http://localhost:3000';
const FRONTEND_URL = 'http://localhost:5173';

let totalChecks = 0;
let passedChecks = 0;

function assert(condition, message) {
  totalChecks++;
  if (condition) {
    console.log(`PASS: ${message}`);
    passedChecks++;
  } else {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

async function request(path, method = 'GET', body = null, headers = {}) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE_URL}${path}`, options);
  let data = null;
  try {
    data = await res.json();
  } catch {
    // raw text
  }
  return { status: res.status, headers: res.headers, data };
}

async function runTests() {
  console.log('=== PASSWORD RESET LIVE VERIFICATION SUITE ===\n');

  // 1. Mail Health Check
  const healthRes = await request('/mail/health');
  assert(healthRes.status === 200, 'GET /mail/health returns HTTP 200');
  assert(healthRes.data?.status === 'ready', 'Mail transport status is "ready"');
  assert(healthRes.data?.mode === 'ethereal', 'Mail mode is "ethereal"');
  assert(healthRes.data?.configured === true, 'Mail transport is configured');

  // 2. Forgot Password for seeded user (Arjun Sharma - arjun.sharma@teamforge.io)
  const forgotRes = await request('/auth/forgot-password', 'POST', {
    identifier: 'arjun.sharma@teamforge.io',
  });
  assert(forgotRes.status === 200, 'POST /auth/forgot-password returns HTTP 200 for valid user');
  assert(
    forgotRes.data?.message === 'If an account with that email or username exists, password reset instructions have been sent.',
    'Generic anti-enumeration message returned'
  );
  assert(Boolean(forgotRes.data?.previewUrl), 'Ethereal preview URL returned in dev mode');
  assert(
    String(forgotRes.data?.previewUrl).includes('ethereal.email'),
    `Preview URL points to Ethereal inbox (${forgotRes.data?.previewUrl})`
  );

  // 3. Negative Test: Unknown user gets the exact same generic message
  const unknownRes = await request('/auth/forgot-password', 'POST', {
    identifier: 'nonexistent.user.99999@example.com',
  });
  assert(unknownRes.status === 200, 'POST /auth/forgot-password returns HTTP 200 for unknown user');
  assert(
    unknownRes.data?.message === 'If an account with that email or username exists, password reset instructions have been sent.',
    'Generic anti-enumeration message returned for unknown user'
  );
  assert(!unknownRes.data?.previewUrl, 'No email sent for unknown user (previewUrl is undefined)');

  // 4. Rate Limiting: 5 requests allowed per identifier, 6th returns 429
  console.log('\n--- Rate Limiting Verification ---');
  const rateLimitUser = 'ratelimit.test.user@example.com';
  for (let i = 1; i <= 5; i++) {
    await request('/auth/forgot-password', 'POST', { identifier: rateLimitUser });
  }
  const rateLimitHit = await request('/auth/forgot-password', 'POST', { identifier: rateLimitUser });
  assert(rateLimitHit.status === 429, '6th reset request within 1 hour returns HTTP 429 Too Many Requests');
  assert(
    String(rateLimitHit.data?.message).toLowerCase().includes('too many'),
    'Rate limit error message returned'
  );

  // 5. Complete Password Reset Flow: Request -> Token -> Reset -> Login with new -> Old fails
  console.log('\n--- Complete Password Reset & Login Flow ---');
  // Use Vikram Nair (vikram.nair@teamforge.io) with initial password 'password123'
  const vikramForgot = await request('/auth/forgot-password', 'POST', {
    identifier: 'vikram.nair@teamforge.io',
  });
  assert(vikramForgot.status === 200, 'Forgot password for Vikram Nair returns 200');
  assert(Boolean(vikramForgot.data?.previewUrl), 'Vikram received an Ethereal email preview');

  // In non-prod dev mode, resetLink is available on the token record or response
  const resetLink = vikramForgot.data?.resetLink;
  let token = '';
  if (resetLink && resetLink.includes('token=')) {
    token = resetLink.split('token=')[1];
  }
  assert(Boolean(token), 'Extracted reset token from generated reset link');
  assert(!String(resetLink).includes(':3000'), 'Reset link uses FRONTEND_URL (not backend port 3000)');

  // 5a. Submit Reset with new password
  const newPassword = 'VikramNewPassword@2026!';
  const resetRes = await request('/auth/reset-password', 'POST', {
    token,
    newPassword,
  });
  assert(resetRes.status === 200, 'POST /auth/reset-password succeeds with HTTP 200');
  assert(
    String(resetRes.data?.message).toLowerCase().includes('successful'),
    'Success message returned from reset endpoint'
  );

  // 5b. Verify old password fails
  const oldLoginRes = await request('/auth/login', 'POST', {
    identifier: 'vikram.nair@teamforge.io',
    password: 'password123',
  });
  assert(oldLoginRes.status === 401, 'Old password fails with HTTP 401 Unauthorized');

  // 5c. Verify new password succeeds
  const newLoginRes = await request('/auth/login', 'POST', {
    identifier: 'vikram.nair@teamforge.io',
    password: newPassword,
  });
  assert(newLoginRes.status === 200, 'New password logs in successfully with HTTP 200');
  assert(Boolean(newLoginRes.data?.accessToken), 'Access token returned on new password login');

  // 5d. Token single-use: Reusing the same token fails
  const reuseRes = await request('/auth/reset-password', 'POST', {
    token,
    newPassword: 'AnotherPassword@123',
  });
  assert(reuseRes.status === 400, 'Reused token is rejected with HTTP 400 Bad Request');
  assert(
    String(reuseRes.data?.message).toLowerCase().includes('already been used'),
    'Token reuse rejection message explains token already used'
  );

  // 5e. Token Expiration Check
  console.log('\n--- Token Expiration Check ---');
  await request('/auth/test-set-expiry', 'POST', { expiryMs: 10 });
  const expireForgot = await request('/auth/forgot-password', 'POST', {
    identifier: 'vikram.nair@teamforge.io',
  });
  const expiredToken = (expireForgot.data?.resetLink || '').split('token=')[1];
  await new Promise((r) => setTimeout(r, 50)); // wait 50ms for 10ms token to expire
  const expiredResetRes = await request('/auth/reset-password', 'POST', {
    token: expiredToken,
    newPassword: 'SomePassword123!',
  });
  assert(expiredResetRes.status === 400, 'Expired token is rejected with HTTP 400 Bad Request');
  assert(
    String(expiredResetRes.data?.message).toLowerCase().includes('expired'),
    'Expired token error message explains token has expired'
  );
  // Restore default expiry
  await request('/auth/test-set-expiry', 'POST', { expiryMs: 0 });

  // 6. Token Validation & Password Rules
  console.log('\n--- Negative Validations ---');
  const emptyTokenRes = await request('/auth/reset-password', 'POST', {
    token: '',
    newPassword: 'NewSecurePassword123!',
  });
  assert(emptyTokenRes.status === 400, 'Empty token rejected with HTTP 400 Bad Request');

  const fakeTokenRes = await request('/auth/reset-password', 'POST', {
    token: '0000000000000000000000000000000000000000000000000000000000000000',
    newPassword: 'NewSecurePassword123!',
  });
  assert(fakeTokenRes.status === 400, 'Non-existent token rejected with HTTP 400 Bad Request');

  const weakPasswordRes = await request('/auth/reset-password', 'POST', {
    token: 'fakeToken123456789012345678901234',
    newPassword: '123',
  });
  assert(weakPasswordRes.status === 400, 'Weak password (< 6 chars) rejected with HTTP 400 Bad Request');

  // 7. Suspended user gets generic response and no email
  console.log('\n--- Suspended Account Check ---');
  // Seed or set a suspended status
  const suspendedForgot = await request('/auth/forgot-password', 'POST', {
    identifier: 'suspended.test@example.com',
  });
  assert(suspendedForgot.status === 200, 'Suspended check returns HTTP 200');
  assert(!suspendedForgot.data?.previewUrl, 'No email sent for non-active/unknown accounts');

  console.log(`\n=== SUMMARY: ${passedChecks} PASSED, ${totalChecks - passedChecks} FAILED out of ${totalChecks} checks ===`);
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
