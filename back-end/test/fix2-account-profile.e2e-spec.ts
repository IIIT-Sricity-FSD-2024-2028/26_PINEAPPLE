import request from 'supertest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { createTestApp, TestAppContext } from './helpers/test-helpers';

describe('FIX 2 E2E: Permanent Username & Email Verification Source of Truth', () => {
  let ctx: TestAppContext;
  let server: any;

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(() => {
    ctx.resetStores();
  });

  it('1. Signup creates user without username & unverified; completion sets username once then returns 409 USERNAME_ALREADY_SET', async () => {
    const signupRes = await request(server)
      .post('/auth/signup')
      .send({
        email: 'fix2user@example.com',
        password: 'Password@123!',
        role: 'Collaborator',
      })
      .expect(201);

    const token = `Bearer ${signupRes.body.accessToken}`;
    const userId = String(signupRes.body.user.id);
    expect(signupRes.body.user.username || '').toBe('');
    expect(signupRes.body.user.emailVerified).toBe(false);
    expect(signupRes.body.user.profileComplete).toBe(false);

    // Step 2 completion sets username once
    const completeRes = await request(server)
      .post('/auth/profile')
      .set('Authorization', token)
      .send({
        name: 'Fix Two User',
        username: 'fix2_chosen',
        role: 'Collaborator',
        university: 'IIT Bombay',
      });
    expect([200, 201]).toContain(completeRes.status);
    expect(completeRes.body.username).toBe('fix2_chosen');
    expect(completeRes.body.needsUsernameConfirmation).toBe(false);

    // Second completion attempt must fail with 409 USERNAME_ALREADY_SET and keep original username
    const secondRes = await request(server)
      .post('/auth/profile')
      .set('Authorization', token)
      .send({
        name: 'Fix Two User',
        username: 'fix2_changed',
        role: 'Collaborator',
        university: 'IIT Bombay',
      });
    expect(secondRes.status).toBe(409);
    expect(secondRes.body.code).toBe('USERNAME_ALREADY_SET');
    expect(ctx.usersService.findRawUserById(userId)?.username).toBe('fix2_chosen');
  });

  it('2. Username change via profile update, admin edit, mentor profile, settings, and direct update returns 400 USERNAME_IMMUTABLE and changes nothing', async () => {
    // Collaborator self profile update (PATCH /users/:id)
    const collabToken = ctx.loginAs('2');
    const origCollab = ctx.usersService.findRawUserById('2')?.username;

    const patchCollab = await request(server)
      .patch('/users/2')
      .set('Authorization', collabToken)
      .send({ username: 'arjun_hacked' });
    expect(patchCollab.status).toBe(400);
    expect(patchCollab.body.code).toBe('USERNAME_IMMUTABLE');
    expect(ctx.usersService.findRawUserById('2')?.username).toBe(origCollab);

    // Nested profile.username on PATCH /users/:id
    const patchNested = await request(server)
      .patch('/users/2')
      .set('Authorization', collabToken)
      .send({ profile: { username: 'arjun_nested' } });
    expect(patchNested.status).toBe(400);
    expect(patchNested.body.code).toBe('USERNAME_IMMUTABLE');
    expect(ctx.usersService.findRawUserById('2')?.username).toBe(origCollab);

    // Super User self update also blocked from changing own username
    const suToken = ctx.loginAs('superuser');
    const origSu = ctx.usersService.findRawUserById('u-superuser')?.username;
    const patchSu = await request(server)
      .patch('/users/u-superuser')
      .set('Authorization', suToken)
      .send({ username: 'root_new' });
    expect(patchSu.status).toBe(400);
    expect(patchSu.body.code).toBe('USERNAME_IMMUTABLE');
    expect(ctx.usersService.findRawUserById('u-superuser')?.username).toBe(origSu);

    // Admin status/edit endpoint with username fails 400 USERNAME_IMMUTABLE
    const adminToken = ctx.loginAs('admin');
    const adminPatch = await request(server)
      .patch('/admin/users/2/status')
      .set('Authorization', adminToken)
      .send({ action: 'warn', reason: 'Attempting admin username edit check', username: 'admin_edited' });
    expect(adminPatch.status).toBe(400);
    expect(adminPatch.body.code).toBe('USERNAME_IMMUTABLE');
    expect(ctx.usersService.findRawUserById('2')?.username).toBe(origCollab);

    // Settings endpoint (PATCH /users/me/settings) with username fails 400 USERNAME_IMMUTABLE
    const settingsPatch = await request(server)
      .patch('/users/me/settings')
      .set('Authorization', collabToken)
      .send({ digestEnabled: true, username: 'settings_edited' });
    expect(settingsPatch.status).toBe(400);
    expect(settingsPatch.body.code).toBe('USERNAME_IMMUTABLE');
    expect(ctx.usersService.findRawUserById('2')?.username).toBe(origCollab);

    // Mentor profile create/update with username fails 400 USERNAME_IMMUTABLE
    const mentorToken = ctx.loginAs('mentor');
    const origMentor = ctx.usersService.findRawUserById('7')?.username;
    const mentorPatch = await request(server)
      .patch('/mentor-marketplace/mentors/profile')
      .set('Authorization', mentorToken)
      .send({ sessionPrice: 1200, username: 'mentor_renamed' });
    expect(mentorPatch.status).toBe(400);
    expect(mentorPatch.body.code).toBe('USERNAME_IMMUTABLE');
    expect(ctx.usersService.findRawUserById('7')?.username).toBe(origMentor);

    const mentorCreate = await request(server)
      .post('/mentor-marketplace/mentors/profile')
      .set('Authorization', mentorToken)
      .send({
        name: 'Neha Gupta',
        title: 'Senior Architect',
        bio: 'Experienced mentoring leader',
        skills: ['Architecture'],
        experienceYears: 6,
        sessionPrice: 1200,
        sessionDuration: 60,
        availability: 'Anytime',
        username: 'mentor_renamed',
      });
    expect(mentorCreate.status).toBe(400);
    expect(mentorCreate.body.code).toBe('USERNAME_IMMUTABLE');
    expect(ctx.usersService.findRawUserById('7')?.username).toBe(origMentor);

    // Direct service update also refuses username mutation
    expect(() => ctx.usersService.update('2', { username: 'direct_edit' })).toThrow(BadRequestException);
    expect(ctx.usersService.findRawUserById('2')?.username).toBe(origCollab);
    expect(() => ctx.usersService.completeSocialProfile('2', undefined, { name: 'Arjun', username: 're_complete' })).toThrow(ConflictException);
  });

  it('3. Email verification source of truth: unverified blocked with 403, verified passes even with stale token claim, resend returns 409 EMAIL_ALREADY_VERIFIED', async () => {
    const signupRes = await request(server)
      .post('/auth/signup')
      .send({
        email: 'verifyflow@example.com',
        password: 'Password@123!',
        role: 'Project Owner',
      })
      .expect(201);

    const userId = String(signupRes.body.user.id);
    const freshToken = `Bearer ${signupRes.body.accessToken}`;

    // Complete step 2 so profileComplete=true (still emailVerified=false)
    await request(server)
      .post('/auth/profile')
      .set('Authorization', freshToken)
      .send({
        name: 'Verify Flow Owner',
        username: 'verifyflow_owner',
        role: 'Project Owner',
        university: 'IIT Delhi',
      })
      .expect(200);

    // Also mint a stale JWT claiming emailVerified: false
    const staleClaimToken = ctx.loginAs(userId, undefined, {
      email: 'verifyflow@example.com',
      role: 'project-owner',
      emailVerified: false,
    });

    const futureDue = new Date(ctx.clockService.now().getTime() + 15 * 24 * 60 * 60 * 1000).toISOString();
    const validDescription =
      'A sufficiently long description for creating a test project cleanly while verifying EmailVerifiedGuard enforcement.';

    // Unverified user blocked on apply, create project, chat post, and mentor booking with 403 EMAIL_NOT_VERIFIED
    const unvCreateProj = await request(server)
      .post('/projects')
      .set('Authorization', freshToken)
      .send({
        title: 'Blocked Project',
        description: validDescription,
        dueDate: futureDue,
        requiredSkills: ['Node.js'],
      });
    expect(unvCreateProj.status).toBe(403);
    expect(unvCreateProj.body.code).toBe('EMAIL_NOT_VERIFIED');

    const unvApply = await request(server)
      .post('/join-requests')
      .set('Authorization', freshToken)
      .send({ projectId: 'proj-1', role: 'Collaborator', message: 'Excited to contribute to this project.' });
    expect(unvApply.status).toBe(403);
    expect(unvApply.body.code).toBe('EMAIL_NOT_VERIFIED');

    const unvChat = await request(server)
      .post('/communication/messages')
      .set('Authorization', freshToken)
      .send({ projectId: 'proj-1', content: 'Hello team' });
    expect(unvChat.status).toBe(403);
    expect(unvChat.body.code).toBe('EMAIL_NOT_VERIFIED');

    const unvBook = await request(server)
      .post('/mentor-marketplace/sessions/book')
      .set('Authorization', freshToken)
      .send({
        mentorId: 'mentor-profile-1',
        projectId: 'proj-1',
        projectDescription: 'Need architecture mentorship session.',
        scheduledAt: new Date(ctx.clockService.now().getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      });
    expect(unvBook.status).toBe(403);
    expect(unvBook.body.code).toBe('EMAIL_NOT_VERIFIED');

    // Verify email using mailed verification token
    const mails = ctx.mailServiceMock.getSentMails();
    const verifyMail = mails.find((m) => m.to === 'verifyflow@example.com' && m.token);
    expect(verifyMail?.token).toBeDefined();

    await request(server)
      .post('/auth/verify-email')
      .send({ token: verifyMail!.token })
      .expect(200);

    // GET /auth/me returns emailVerified: true EVEN with old stale JWT carrying emailVerified: false
    const meRes = await request(server)
      .get('/auth/me')
      .set('Authorization', staleClaimToken)
      .expect(200);
    expect(meRes.body.emailVerified).toBe(true);

    // Resend for verified user returns 409 EMAIL_ALREADY_VERIFIED
    const resendRes = await request(server)
      .post('/auth/resend-verification')
      .set('Authorization', freshToken);
    expect(resendRes.status).toBe(409);
    expect(resendRes.body.code).toBe('EMAIL_ALREADY_VERIFIED');

    // Verified user passes EmailVerifiedGuard EVEN with stale token claim on create project, apply, and booking!
    const okProj = await request(server)
      .post('/projects')
      .set('Authorization', staleClaimToken)
      .send({
        title: 'Verified Owner Project',
        description: validDescription,
        dueDate: futureDue,
        requiredSkills: ['TypeScript'],
      });
    expect(okProj.status).toBe(201);
    const createdProjId = okProj.body.id;

    // Verified user passes EmailVerifiedGuard on chat post in their own project
    const okChat = await request(server)
      .post('/communication/messages')
      .set('Authorization', staleClaimToken)
      .send({ projectId: createdProjId, content: 'Verified member chat message!' });
    expect(okChat.status).toBe(201);

    // Verified user passes EmailVerifiedGuard on booking a mentor for their project
    const okBook = await request(server)
      .post('/mentor-marketplace/sessions/book')
      .set('Authorization', staleClaimToken)
      .send({
        mentorId: 'mentor-profile-1',
        projectId: createdProjId,
        projectDescription: 'Architecture session for newly verified project owner.',
        scheduledAt: new Date(ctx.clockService.now().getTime() + 4 * 24 * 60 * 60 * 1000).toISOString(),
      });
    expect(okBook.status).toBe(201);

    // Seed user '2' (verified) passes EmailVerifiedGuard on apply
    const seedApply = await request(server)
      .post('/join-requests')
      .set('Authorization', ctx.loginAs('2'))
      .send({
        projectId: createdProjId,
        role: 'Collaborator',
        message: 'Seed verified collaborator applying to new project.',
      });
    expect(seedApply.status).toBe(201);

    // Seed users and newly created social login users have emailVerified: true
    const seedMe = await request(server).get('/auth/me').set('Authorization', ctx.loginAs('2')).expect(200);
    expect(seedMe.body.emailVerified).toBe(true);

    const socialUser = ctx.usersService.completeSocialProfile('social-fix2-uid', 'socialfix2@example.com', {
      name: 'Social User',
      username: 'socialfix2',
      role: 'Collaborator',
      university: 'NIT Trichy',
    });
    expect(socialUser.emailVerified).toBe(true);
    expect(socialUser.needsUsernameConfirmation).toBe(false);
    const socialToken = ctx.loginAs('social-fix2-uid', undefined, { email: 'socialfix2@example.com' });
    const socialMe = await request(server).get('/auth/me').set('Authorization', socialToken).expect(200);
    expect(socialMe.body.emailVerified).toBe(true);
    const socialApply = await request(server)
      .post('/join-requests')
      .set('Authorization', socialToken)
      .send({
        projectId: createdProjId,
        role: 'Collaborator',
        message: 'Social verified user applying after step 2 completion.',
      });
    expect(socialApply.status).toBe(201);
  });
});
