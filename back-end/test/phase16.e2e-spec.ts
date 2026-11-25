import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, TestAppContext } from './helpers/test-helpers';

const VALID_DESC =
  'A comprehensive collaborative software platform project designed with automated testing, clear deliverables, and mentorship support.';

describe('Phase 16 E2E API Tests: Trust and Safety', () => {
  let ctx: TestAppContext;
  let app: INestApplication;
  let server: any;

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;
    server = app.getHttpServer();
  });

  beforeEach(() => {
    ctx.resetStores();
    ctx.clockService.setTime('2026-12-01T12:00:00.000Z');
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Chat message report: RBAC, 20-message snapshot survives message delete, duplicate 409, and 10/day -> 429 TOO_MANY_REPORTS', async () => {
    const ownerToken = ctx.loginAs('1');
    const collabToken = ctx.loginAs('2'); // Arjun (member of proj-1)
    const outsiderToken = ctx.loginAs('6'); // Aditya (not a member of proj-1)
    const adminToken = ctx.loginAs('admin');

    // Create 25 messages in proj-1 so snapshot windowing (>20) is tested
    const sentIds: string[] = [];
    for (let i = 1; i <= 25; i++) {
      const mRes = await request(server)
        .post('/communication/messages')
        .set('Authorization', ownerToken)
        .send({ projectId: 'proj-1', content: `Message number ${i} in proj-1 stream` });
      expect(mRes.status).toBe(201);
      sentIds.push(mRes.body.id);
    }

    const targetMessageId = sentIds[12]; // Middle message (#13)

    // Non-member cannot report -> 403 CHAT_MEMBERSHIP_REQUIRED
    const outsiderRes = await request(server)
      .post(`/communication/messages/${targetMessageId}/report`)
      .set('Authorization', outsiderToken)
      .send({ reason: 'Outsider trying to report private chat message' });
    expect(outsiderRes.status).toBe(403);
    expect(outsiderRes.body.code).toBe('CHAT_MEMBERSHIP_REQUIRED');

    // Author cannot report their own message -> 400 CANNOT_REPORT_SELF
    const selfRes = await request(server)
      .post(`/communication/messages/${targetMessageId}/report`)
      .set('Authorization', ownerToken)
      .send({ reason: 'Trying to report my own message' });
    expect(selfRes.status).toBe(400);
    expect(selfRes.body.code).toBe('CANNOT_REPORT_SELF');

    // Short reason -> 400 REASON_REQUIRED
    const shortReasonRes = await request(server)
      .post(`/communication/messages/${targetMessageId}/report`)
      .set('Authorization', collabToken)
      .send({ reason: 'Too short' });
    expect(shortReasonRes.status).toBe(400);
    expect(shortReasonRes.body.code).toBe('REASON_REQUIRED');

    // Valid report -> 201 Created with 20-message snapshot
    const reportRes = await request(server)
      .post(`/communication/messages/${targetMessageId}/report`)
      .set('Authorization', collabToken)
      .send({ reason: 'Message contains repeated abusive harassment toward team members.' });
    expect(reportRes.status).toBe(201);
    expect(reportRes.body.type).toBe('chat_message');
    expect(reportRes.body.projectId).toBe('proj-1');
    expect(reportRes.body.messageId).toBe(targetMessageId);
    expect(reportRes.body.messageSnapshot).toHaveLength(20);
    expect(reportRes.body.reportedMessage.id).toBe(targetMessageId);

    const reportId = reportRes.body.id;

    // Duplicate report of same message by same user BEFORE deletion -> 409 ALREADY_REPORTED
    const dupRes = await request(server)
      .post(`/communication/messages/${targetMessageId}/report`)
      .set('Authorization', collabToken)
      .send({ reason: 'Trying to report the exact same message a second time.' });
    expect(dupRes.status).toBe(409);
    expect(dupRes.body.code).toBe('ALREADY_REPORTED');

    // Deleting the original message leaves the preserved snapshot untouched
    expect(ctx.communicationRepository.deleteMessage(targetMessageId)).toBe(true);
    expect(ctx.communicationRepository.findMessageById(targetMessageId)).toBeUndefined();

    const adminDetailRes = await request(server)
      .get(`/admin/reports/${reportId}`)
      .set('Authorization', adminToken);
    expect(adminDetailRes.status).toBe(200);
    expect(adminDetailRes.body.type).toBe('chat_message');
    expect(adminDetailRes.body.reportedMessage.content).toContain('Message number 13');
    expect(adminDetailRes.body.messageSnapshot).toHaveLength(20);
    expect(adminDetailRes.body.messageSnapshot.some((m: any) => m.id === targetMessageId)).toBe(true);

    // Phase 1 reason & Phase 8 finality apply on admin review
    const badAction = await request(server)
      .post(`/admin/reports/${reportId}/action`)
      .set('Authorization', adminToken)
      .send({ action: 'warn', reason: 'short' });
    expect(badAction.status).toBe(400);

    const firstAction = await request(server)
      .post(`/admin/reports/${reportId}/action`)
      .set('Authorization', adminToken)
      .send({ action: 'dismiss', reason: 'Reviewed context snapshot and confirmed false alarm.' });
    expect([200, 201]).toContain(firstAction.status);

    const secondAction = await request(server)
      .post(`/admin/reports/${reportId}/action`)
      .set('Authorization', adminToken)
      .send({ action: 'warn', reason: 'Trying a second action after dismissal must be blocked.' });
    expect(secondAction.status).toBe(409);
    expect(secondAction.body.code).toBe('REPORT_ALREADY_ACTIONED');

    // Remaining 9 chat reports succeed (total 10 in 24h), 11th hits 429 TOO_MANY_REPORTS
    for (let i = 0; i < 9; i++) {
      const r = await request(server)
        .post(`/communication/messages/${sentIds[i]}/report`)
        .set('Authorization', collabToken)
        .send({ reason: `Daily limit check report number ${i + 2} with valid length.` });
      expect(r.status).toBe(201);
    }

    const limitRes = await request(server)
      .post(`/communication/messages/${sentIds[9]}/report`)
      .set('Authorization', collabToken)
      .send({ reason: 'Eleventh report within twenty-four hours should trigger limit.' });
    expect(limitRes.status).toBe(429);
    expect(limitRes.body.code).toBe('TOO_MANY_REPORTS');

    // Advance 24h + 1h -> allowed again
    ctx.advanceTime({ hours: 25 });
    const afterWaitRes = await request(server)
      .post(`/communication/messages/${sentIds[9]}/report`)
      .set('Authorization', collabToken)
      .send({ reason: 'Report filed next day after rolling twenty-four hour window resets.' });
    expect(afterWaitRes.status).toBe(201);
  });

  it('2. Duplicate accounts: gmail normalization flags users without blocking, respects admin "users" permission, and enforces unique phone across non-deleted accounts', async () => {
    const s1 = await request(server)
      .post('/auth/signup')
      .send({
        name: 'Vikram Dev',
        email: 'vikram.dev@gmail.com',
        password: 'Password123!',
      });
    expect(s1.status).toBe(201);
    await request(server)
      .post('/auth/profile')
      .set('Authorization', `Bearer ${s1.body.accessToken}`)
      .send({ name: 'Vikram Dev', username: 'vikram_dup1' })
      .expect(200);

    const s2 = await request(server)
      .post('/auth/signup')
      .send({
        name: 'Vikram Alt',
        email: 'vikramdev+alt@googlemail.com',
        password: 'Password123!',
      });
    expect(s2.status).toBe(201);
    expect(s2.body.user.status).toBe('Active');
    expect(s2.body.user.duplicateFlag).toBe(true);
    await request(server)
      .post('/auth/profile')
      .set('Authorization', `Bearer ${s2.body.accessToken}`)
      .send({ name: 'Vikram Alt', username: 'vikram_dup2' })
      .expect(200);

    // Collaborator and admin lacking 'users' permission receive 403
    await request(server).get('/admin/users/duplicates').set('Authorization', ctx.loginAs('2')).expect(403);
    await request(server).get('/admin/users/duplicates').set('Authorization', ctx.loginAs('admin-reports')).expect(403);

    // Admin with 'users' permission (admin-no-reports has ['users', 'projects']) gets 200
    const dupRes = await request(server)
      .get('/admin/users/duplicates')
      .set('Authorization', ctx.loginAs('admin-no-reports'));
    expect(dupRes.status).toBe(200);
    const emailGroup = dupRes.body.groups.find(
      (g: any) => g.type === 'email' && g.normalizedValue === 'vikramdev@gmail.com',
    );
    expect(emailGroup).toBeDefined();
    expect(emailGroup.users).toHaveLength(2);

    // Verified phone uniqueness check (cannot reuse active verified phone, can reuse deleted account phone)
    ctx.usersService.setOtpChallengeForTest(s1.body.user.id, '+919111122223', '246810');
    await request(server)
      .post('/users/me/phone/verify-otp')
      .set('Authorization', `Bearer ${s1.body.accessToken}`)
      .send({ code: '246810', phone: '+919111122223' })
      .expect(200);

    const conflictPhoneRes = await request(server)
      .post('/users/me/phone/request-otp')
      .set('Authorization', `Bearer ${s2.body.accessToken}`)
      .send({ phone: '+919111122223' });
    expect(conflictPhoneRes.status).toBe(409);
    expect(conflictPhoneRes.body.code).toBe('PHONE_ALREADY_USED');

    // Soft-delete s1 -> phone becomes available for s2
    const rawS1 = ctx.usersRepository.findById(s1.body.user.id)!;
    rawS1.isDeleted = true;
    rawS1.deletedAt = ctx.clockService.nowIso();

    const okAfterDelete = await request(server)
      .post('/users/me/phone/request-otp')
      .set('Authorization', `Bearer ${s2.body.accessToken}`)
      .send({ phone: '+919111122223' });
    expect(okAfterDelete.status).toBe(200);
  });

  it('3. Project spam caps: 5+ title, 100+ desc, max 3/24h (429 PROJECT_DAILY_LIMIT), max 10 open (409 OPEN_PROJECT_LIMIT)', async () => {
    // Use fresh verified owner so seeded projects don't affect exact boundary counts
    const owner = ctx.usersRepository.create({
      name: 'Fresh Owner',
      username: 'fresh_owner_p16',
      email: 'fresh.owner.p16@teamforge.io',
      role: 'Project Owner' as any,
      emailVerified: true,
    }, 'u-spam-owner');
    const ownerToken = ctx.loginAs(owner.id, undefined, { role: 'project-owner' });
    const DUE = '2027-06-01T00:00:00.000Z';

    // Title < 5 -> 400 TITLE_TOO_SHORT
    const shortTitle = await request(server)
      .post('/projects')
      .set('Authorization', ownerToken)
      .send({ title: 'Abcd', description: VALID_DESC, dueDate: DUE });
    expect(shortTitle.status).toBe(400);
    expect(shortTitle.body.code).toBe('TITLE_TOO_SHORT');

    // Description < 100 -> 400 DESCRIPTION_TOO_SHORT
    const shortDesc = await request(server)
      .post('/projects')
      .set('Authorization', ownerToken)
      .send({ title: 'Valid Title', description: 'Short description under one hundred characters.', dueDate: DUE });
    expect(shortDesc.status).toBe(400);
    expect(shortDesc.body.code).toBe('DESCRIPTION_TOO_SHORT');

    // Create 3 projects on day 1 -> all 201
    for (let i = 1; i <= 3; i++) {
      await request(server)
        .post('/projects')
        .set('Authorization', ownerToken)
        .send({ title: `Spam Cap Project ${i}`, description: VALID_DESC, dueDate: DUE })
        .expect(201);
    }

    // 4th on same day -> 429 PROJECT_DAILY_LIMIT
    const fourthToday = await request(server)
      .post('/projects')
      .set('Authorization', ownerToken)
      .send({ title: 'Spam Cap Project 4', description: VALID_DESC, dueDate: DUE });
    expect(fourthToday.status).toBe(429);
    expect(fourthToday.body.code).toBe('PROJECT_DAILY_LIMIT');

    // Advance across multiple days to reach 10 open projects total (3 + 3 + 3 + 1 = 10)
    ctx.advanceTime({ hours: 25 });
    for (let i = 4; i <= 6; i++) {
      await request(server).post('/projects').set('Authorization', ownerToken).send({ title: `Open Cap ${i}`, description: VALID_DESC, dueDate: DUE }).expect(201);
    }
    ctx.advanceTime({ hours: 25 });
    for (let i = 7; i <= 9; i++) {
      await request(server).post('/projects').set('Authorization', ownerToken).send({ title: `Open Cap ${i}`, description: VALID_DESC, dueDate: DUE }).expect(201);
    }
    ctx.advanceTime({ hours: 25 });
    await request(server).post('/projects').set('Authorization', ownerToken).send({ title: 'Open Cap 10', description: VALID_DESC, dueDate: DUE }).expect(201);

    // 11th open project -> 409 OPEN_PROJECT_LIMIT
    const eleventh = await request(server)
      .post('/projects')
      .set('Authorization', ownerToken)
      .send({ title: 'Open Cap 11', description: VALID_DESC, dueDate: DUE });
    expect(eleventh.status).toBe(409);
    expect(eleventh.body.code).toBe('OPEN_PROJECT_LIMIT');
  });

  it('4. Email verification: signup starts unverified, blocks 4 write routes (403 EMAIL_NOT_VERIFIED) while allowing browsing, resend has 2m cooldown, token single-use & 24h expiry', async () => {
    const signupRes = await request(server)
      .post('/auth/signup')
      .send({
        name: 'New Student',
        username: 'unverified_student',
        email: 'unverified.student@university.edu',
        password: 'Password123!',
        role: 'Collaborator',
      });
    expect(signupRes.status).toBe(201);
    expect(signupRes.body.user.emailVerified).toBe(false);

    const token1 = ctx.mailServiceMock.getSentMails().find((m) => m.type === 'email-verification')?.token;
    expect(token1).toBeDefined();

    // Unverified user CAN log in by email, complete step 2 username, check /auth/me, and browse GET routes
    const loginRes = await request(server)
      .post('/auth/login')
      .send({ identifier: 'unverified.student@university.edu', password: 'Password123!' });
    expect(loginRes.status).toBe(200);
    const unverifiedToken = `Bearer ${loginRes.body.accessToken}`;

    await request(server)
      .post('/auth/profile')
      .set('Authorization', unverifiedToken)
      .send({ name: 'New Student', username: 'unverified_student' })
      .expect(200);

    const meRes = await request(server).get('/auth/me').set('Authorization', unverifiedToken);
    expect(meRes.status).toBe(200);
    expect(meRes.body.emailVerified).toBe(false);

    await request(server).get('/projects').set('Authorization', unverifiedToken).expect(200);
    await request(server).get('/mentor-marketplace/mentors').set('Authorization', unverifiedToken).expect(200);

    // Unverified user CANNOT perform the 4 write actions -> 403 EMAIL_NOT_VERIFIED
    // Also verify Project Owner role hits EmailVerifiedGuard (not RolesGuard) for create project & book mentor
    const unverifiedOwnerSignup = await request(server)
      .post('/auth/signup')
      .send({
        name: 'Unverified Owner',
        email: 'unverified.owner@university.edu',
        password: 'Password123!',
        role: 'Project Owner',
      });
    expect(unverifiedOwnerSignup.status).toBe(201);
    const unverifiedOwnerToken = `Bearer ${unverifiedOwnerSignup.body.accessToken}`;
    await request(server)
      .post('/auth/profile')
      .set('Authorization', unverifiedOwnerToken)
      .send({ name: 'Unverified Owner', username: 'unverified_owner' })
      .expect(200);

    const createProjBlocked = await request(server)
      .post('/projects')
      .set('Authorization', unverifiedOwnerToken)
      .send({ title: 'Blocked Project', description: VALID_DESC, dueDate: '2027-06-01T00:00:00.000Z' });
    expect(createProjBlocked.status).toBe(403);
    expect(createProjBlocked.body.code).toBe('EMAIL_NOT_VERIFIED');

    const applyBlocked = await request(server)
      .post('/join-requests')
      .set('Authorization', unverifiedToken)
      .send({ projectId: 'proj-1', message: 'Please let me join' });
    expect(applyBlocked.status).toBe(403);
    expect(applyBlocked.body.code).toBe('EMAIL_NOT_VERIFIED');

    const chatBlocked = await request(server)
      .post('/communication/messages')
      .set('Authorization', unverifiedToken)
      .send({ projectId: 'proj-1', content: 'Hello chat!' });
    expect(chatBlocked.status).toBe(403);
    expect(chatBlocked.body.code).toBe('EMAIL_NOT_VERIFIED');

    const bookBlocked = await request(server)
      .post('/mentor-marketplace/sessions/book')
      .set('Authorization', unverifiedOwnerToken)
      .send({ mentorId: 'mentor-profile-1', projectId: 'proj-1', scheduledAt: '2027-03-01T10:00:00.000Z' });
    expect(bookBlocked.status).toBe(403);
    expect(bookBlocked.body.code).toBe('EMAIL_NOT_VERIFIED');

    // Resend within 2m -> 429 RESEND_COOLDOWN
    const earlyResend = await request(server).post('/auth/resend-verification').set('Authorization', unverifiedToken);
    expect(earlyResend.status).toBe(429);
    expect(earlyResend.body.code).toBe('RESEND_COOLDOWN');

    // Advance 2m 5s -> resend succeeds & invalidates token1
    ctx.advanceTime({ ms: 125 * 1000 });
    const okResend = await request(server).post('/auth/resend-verification').set('Authorization', unverifiedToken);
    expect(okResend.status).toBe(200);
    const verifyMails = ctx.mailServiceMock.getSentMails().filter((m) => m.type === 'email-verification');
    expect(verifyMails.length).toBeGreaterThanOrEqual(2);
    const token2 = verifyMails[verifyMails.length - 1].token!;
    expect(token2).not.toBe(token1);

    // Old token1 was invalidated -> 400 TOKEN_ALREADY_USED
    await request(server).post('/auth/verify-email').send({ token: token1 }).expect(400);

    // Expired check: advance 25h in a fresh test or verify token2 first:
    const verifyOk = await request(server).post('/auth/verify-email').send({ token: token2 });
    expect(verifyOk.status).toBe(200);
    expect(verifyOk.body.verified).toBe(true);

    // Replay token2 -> 400 TOKEN_ALREADY_USED
    const replay = await request(server).post('/auth/verify-email').send({ token: token2 });
    expect(replay.status).toBe(400);
    expect(replay.body.code).toBe('TOKEN_ALREADY_USED');

    // Verified user can now submit join request (201)
    const afterVerifyApply = await request(server)
      .post('/join-requests')
      .set('Authorization', unverifiedToken)
      .send({ projectId: 'proj-1', message: 'Excited to contribute cleanly!' });
    expect(afterVerifyApply.status).toBe(201);

    // Verify 24h token expiry on a second signup
    await request(server).post('/auth/signup').send({
      name: 'Expire Test',
      username: 'expire_student',
      email: 'expire.student@university.edu',
      password: 'Password123!',
    }).expect(201);
    const allMails = ctx.mailServiceMock.getSentMails().filter((m) => m.type === 'email-verification');
    const expireToken = allMails[allMails.length - 1].token!;
    ctx.advanceTime({ hours: 24, ms: 5000 });
    const expiredRes = await request(server).post('/auth/verify-email').send({ token: expireToken });
    expect(expiredRes.status).toBe(400);
    expect(expiredRes.body.code).toBe('TOKEN_EXPIRED');
  });

  it('5. Content filter: blocks projects/signup/profile without echoing blocked words, passes innocent words, and flags chat without blocking', async () => {
    const ownerToken = ctx.loginAs('1');

    // Blocked word in project title with spacing obfuscation
    const badProj = await request(server)
      .post('/projects')
      .set('Authorization', ownerToken)
      .send({
        title: 'F u c k Spam App',
        description: VALID_DESC,
        dueDate: '2027-06-01T00:00:00.000Z',
      });
    expect(badProj.status).toBe(400);
    expect(badProj.body.code).toBe('CONTENT_NOT_ALLOWED');
    expect(badProj.body.field).toBe('title');
    expect(JSON.stringify(badProj.body).toLowerCase()).not.toContain('fuck');

    // Blocked word in completion-step username (step 2 enforces username content filter)
    const cleanSignup = await request(server)
      .post('/auth/signup')
      .send({
        email: 'bad.signup@university.edu',
        password: 'Password123!',
      })
      .expect(201);
    const badProfileUsername = await request(server)
      .post('/auth/profile')
      .set('Authorization', `Bearer ${cleanSignup.body.accessToken}`)
      .send({
        name: 'Normal User',
        username: 'sh1thead99',
      });
    expect(badProfileUsername.status).toBe(400);
    expect(badProfileUsername.body.code).toBe('CONTENT_NOT_ALLOWED');
    expect(badProfileUsername.body.field).toBe('username');

    // Blocked word in profile update bio
    const badProfile = await request(server)
      .patch('/users/2')
      .set('Authorization', ctx.loginAs('2'))
      .send({ profile: { bio: 'Free crypto deals in bio' } });
    expect(badProfile.status).toBe(400);
    expect(badProfile.body.code).toBe('CONTENT_NOT_ALLOWED');
    expect(badProfile.body.field).toBe('bio');

    // Innocent dev words succeed
    const goodProj = await request(server)
      .post('/projects')
      .set('Authorization', ownerToken)
      .send({
        title: 'Class Assistant Scrum Analysis App',
        description:
          'Hello team, pass this python and react skill assignment platform for university computer science teams and mentors.',
        dueDate: '2027-06-01T00:00:00.000Z',
      });
    expect(goodProj.status).toBe(201);

    // Chat message with blocked content is NOT blocked, just flagged for admin and logged without offensive text
    const flaggedMsg = await request(server)
      .post('/communication/messages')
      .set('Authorization', ownerToken)
      .send({ projectId: 'proj-1', content: 'This bu11sh1t should flag only' });
    expect(flaggedMsg.status).toBe(201);
    expect(flaggedMsg.body.flaggedForAdmin).toBe(true);

    const flagAudit = ctx.auditService.findAll().find((a) => a.action === 'chat-message-flagged');
    expect(flagAudit).toBeDefined();
    expect(JSON.stringify(flagAudit)).not.toContain('bu11sh1t');
  });

  it('6. OTP attempt limit via HTTP: 5 wrong codes lock for 15m (OTP_LOCKED), clock advance lifts lock', async () => {
    const collabToken = ctx.loginAs('2');
    ctx.usersService.setOtpChallengeForTest('2', '+919876500001', '777888');

    for (let i = 1; i <= 4; i++) {
      const r = await request(server)
        .post('/users/me/phone/verify-otp')
        .set('Authorization', collabToken)
        .send({ code: '111111' });
      expect(r.status).toBe(400);
      expect(r.body.code).toBe('INVALID_OTP');
      expect(r.body.attemptsRemaining).toBe(5 - i);
    }

    const fifth = await request(server)
      .post('/users/me/phone/verify-otp')
      .set('Authorization', collabToken)
      .send({ code: '111111' });
    expect(fifth.status).toBe(429);
    expect(fifth.body.code).toBe('OTP_LOCKED');
    expect(fifth.body.retryAt).toBeDefined();

    // Request new OTP inside 15m -> 429 OTP_LOCKED
    const lockedReq = await request(server)
      .post('/users/me/phone/request-otp')
      .set('Authorization', collabToken)
      .send({ phone: '+919876500001' });
    expect(lockedReq.status).toBe(429);
    expect(lockedReq.body.code).toBe('OTP_LOCKED');

    // Advance 15m + 5s -> lock expires, request + verify succeed
    ctx.advanceTime({ ms: 15 * 60 * 1000 + 5000 });
    await request(server)
      .post('/users/me/phone/request-otp')
      .set('Authorization', collabToken)
      .send({ phone: '+919876500001' })
      .expect(200);

    ctx.usersService.setOtpChallengeForTest('2', '+919876500001', '999000');
    const verifyOk = await request(server)
      .post('/users/me/phone/verify-otp')
      .set('Authorization', collabToken)
      .send({ code: '999000', phone: '+919876500001' });
    expect(verifyOk.status).toBe(200);
    expect(verifyOk.body.phoneVerified).toBe(true);
  });
});
