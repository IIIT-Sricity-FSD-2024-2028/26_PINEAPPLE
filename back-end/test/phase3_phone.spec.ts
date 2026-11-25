import { UsersRepository } from '../src/users/users.repository';
import { UsersService } from '../src/users/users.service';
import { AuditService } from '../src/audit/audit.service';
import { NotificationsService } from '../src/notifications/notifications.service';

let pass = 0;
let fail = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`PASS: ${msg}`);
    pass++;
  } else {
    console.error(`FAIL: ${msg}`);
    fail++;
  }
}

async function run() {
  console.log('=== USERS SERVICE PHONE VERIFICATION UNIT/INTEGRATION SUITE ===\n');

  const usersRepo = new UsersRepository();
  const auditService = new AuditService();
  const notificationsService = new NotificationsService();

  let isConfiguredMock = true;
  let mockTokenResult: any = {
    firebase: { sign_in_provider: 'phone' },
    phone_number: '+919876543210',
  };
  let verifyError: any = null;

  const mockFirebaseService: any = {
    isConfigured: () => isConfiguredMock,
    verifyIdToken: async (token: string) => {
      if (verifyError) throw verifyError;
      return mockTokenResult;
    },
  };

  const usersService = new UsersService(
    usersRepo,
    null as any,
    null as any,
    mockFirebaseService,
    auditService,
    notificationsService,
  );

  // Test 1: Empty token throws 400
  try {
    await usersService.verifyPhone('6', '');
    assert(false, 'Empty token should throw 400');
  } catch (err: any) {
    assert(err.status === 400, 'Empty token throws 400 Bad Request');
  }

  // Test 2: Unconfigured firebase-admin throws 503
  isConfiguredMock = false;
  try {
    await usersService.verifyPhone('6', 'valid-token');
    assert(false, 'Unconfigured firebase should throw 503');
  } catch (err: any) {
    assert(err.status === 503, 'Unconfigured firebase-admin throws 503 Service Unavailable');
    assert(err.message === 'Phone verification is not configured', 'Clear 503 message returned');
  }
  isConfiguredMock = true;

  // Test 3: Token not issued by phone sign-in provider throws 400
  mockTokenResult = {
    firebase: { sign_in_provider: 'google.com' },
    phone_number: '+919876543210',
  };
  try {
    await usersService.verifyPhone('6', 'google-token');
    assert(false, 'Google token should throw 400');
  } catch (err: any) {
    assert(err.status === 400, 'Non-phone token throws 400 Bad Request');
    assert(err.message.includes('phone sign-in provider'), 'Message specifies phone provider requirement');
  }

  // Test 4: Token missing phone_number claim throws 400
  mockTokenResult = {
    firebase: { sign_in_provider: 'phone' },
  };
  try {
    await usersService.verifyPhone('6', 'no-phone-token');
    assert(false, 'Missing phone claim should throw 400');
  } catch (err: any) {
    assert(err.status === 400, 'Missing phone_number claim throws 400 Bad Request');
  }

  // Test 5: Valid phone token verifies and links phone number
  mockTokenResult = {
    firebase: { sign_in_provider: 'phone' },
    phone_number: '+919876543210',
  };
  const verifiedUser = await usersService.verifyPhone('6', 'valid-phone-token');
  assert(verifiedUser.phone === '+919876543210', 'User 6 phone set to +919876543210');
  assert(verifiedUser.phoneVerified === true, 'User 6 phoneVerified set to true');
  assert(Boolean(verifiedUser.phoneVerifiedAt), 'User 6 phoneVerifiedAt timestamp set');
  assert(verifiedUser.profile.phoneVerified === true, 'User 6 profile.phoneVerified synchronized');

  // Check audit log
  const auditLogs = auditService.findAll();
  const phoneAudit = auditLogs.find((a: any) => a.action === 'phone-verified' && a.entityId === '6');
  assert(Boolean(phoneAudit), 'Audit log recorded phone-verified event');

  // Check notification
  const userNotifications = notificationsService.findByUser('6');
  const phoneNotif = userNotifications.find((n: any) => n.type === 'PHONE_VERIFIED');
  assert(Boolean(phoneNotif), 'Notification dispatched to user for phone verification');

  // Test 6: Another user verifying the same phone throws 409 Conflict
  try {
    await usersService.verifyPhone('2', 'token-for-same-phone');
    assert(false, 'Duplicate phone verification should throw 409 Conflict');
  } catch (err: any) {
    assert(err.status === 409, 'Duplicate phone verification throws 409 Conflict');
    assert(
      err.message === 'This phone number is already linked to another account',
      'Clear conflict message: This phone number is already linked to another account',
    );
  }

  // Test 7: Rate limiting: at most 5 verify attempts per user per hour (429)
  usersService.resetPhoneVerifyRateLimitForTesting();
  mockTokenResult = {
    firebase: { sign_in_provider: 'phone' },
    phone_number: '+919999000001',
  };
  // Attempt 1 (success)
  await usersService.verifyPhone('3', 'tok-1');
  // Attempts 2, 3, 4, 5 with failing tokens (count towards rate limit)
  for (let i = 2; i <= 5; i++) {
    mockTokenResult.phone_number = `+91999900000${i}`;
    await usersService.verifyPhone('3', `tok-${i}`);
  }

  // Attempt 6: should be rejected with 429
  try {
    await usersService.verifyPhone('3', 'tok-6');
    assert(false, '6th attempt should throw 429');
  } catch (err: any) {
    assert(err.status === 429, '6th attempt throws 429 Too Many Requests');
    assert(err.message.includes('Too many verification attempts'), 'Rate limit message returned');
  }

  // Test 8: DELETE /users/me/phone removes number and verified flag
  const userAfterDelete = usersService.deletePhone('6');
  assert(userAfterDelete.phone === undefined, 'deletePhone removed phone from root entity');
  assert(userAfterDelete.phoneVerified === false, 'deletePhone reset phoneVerified to false');
  assert(userAfterDelete.profile.phone === undefined, 'deletePhone removed phone from profile');
  assert(userAfterDelete.profile.phoneVerified === false, 'deletePhone reset profile.phoneVerified to false');

  const delAudit = auditService.findAll().find((a: any) => a.action === 'phone-removed' && a.entityId === '6');
  assert(Boolean(delAudit), 'Audit log recorded phone-removed event');

  console.log(`\n=== SUITE COMPLETE: ${pass} PASSED, ${fail} FAILED ===`);
  process.exit(fail > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
