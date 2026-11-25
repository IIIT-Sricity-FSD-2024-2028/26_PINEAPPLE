import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, TestAppContext } from './helpers/test-helpers';

describe('Phase 14 E2E API Tests: Mentor Lifecycle', () => {
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
    ctx.clockService.setTime('2026-06-01T12:00:00.000Z');
  });

  afterAll(async () => {
    await app.close();
  });

  async function bookPayAccept(projectId: string, mentorId = 'mentor-profile-1', mentorToken = ctx.loginAs('mentor'), offsetDays = 3) {
    const ownerToken = ctx.loginAs('1');
    const scheduledAt = new Date(ctx.clockService.now().getTime() + offsetDays * 24 * 60 * 60 * 1000).toISOString();
    const bookRes = await request(server)
      .post('/mentor-marketplace/sessions/book')
      .set('Authorization', ownerToken)
      .send({
        mentorId,
        projectId,
        projectDescription: `Mentorship booking for ${projectId}`,
        scheduledAt,
      });
    expect(bookRes.status).toBe(201);
    const sessionId = bookRes.body?.session?.id || bookRes.body?.id;

    const payRes = await request(server)
      .post(`/mentor-marketplace/sessions/${sessionId}/confirm-payment`)
      .set('Authorization', ownerToken)
      .set('idempotency-key', `idem-${sessionId}`);
    expect([200, 201]).toContain(payRes.status);

    const accRes = await request(server)
      .post(`/mentor-marketplace/sessions/${sessionId}/accept`)
      .set('Authorization', mentorToken);
    expect(accRes.status).toBe(200);
    return accRes.body;
  }

  it('1. Abandonment review RBAC (collaborator 403), chat activity clock reset, confirm active, admin cancel, and 48h auto-release + escrow reconcile', async () => {
    const proj = ctx.projectsService.create('1', {
      title: 'Lifecycle E2E Project',
      description: 'Testing mentor abandonment review and activity tracking via REST endpoints to keep mentorship accountable.',
      teamSize: 4,
      dueDate: '2026-09-01T00:00:00.000Z',
    });
    ctx.projectsService.addCollaborator(proj.id, { id: '2', name: 'Arjun Sharma', role: 'Collaborator' });

    const session = await bookPayAccept(proj.id, 'mentor-profile-1', ctx.loginAs('mentor'), 15);

    // Collaborator receives 403 on both GET and POST abandonment-review
    const collabGet = await request(server)
      .get(`/projects/${proj.id}/mentor/abandonment-review`)
      .set('Authorization', ctx.loginAs('collaborator'));
    expect(collabGet.status).toBe(403);

    const collabOpen = await request(server)
      .post(`/projects/${proj.id}/mentor/abandonment-review`)
      .set('Authorization', ctx.loginAs('collaborator'))
      .send({ reason: 'Should be forbidden' });
    expect(collabOpen.status).toBe(403);

    // Mentor sends chat message on day 4 -> records project activity
    ctx.clockService.advanceDays(4);
    const chatRes = await request(server)
      .post('/communication/messages')
      .set('Authorization', ctx.loginAs('mentor'))
      .set('x-user-id', '7')
      .send({ projectId: proj.id, senderId: '7', content: 'Checking in on architecture tasks.' });
    expect([200, 201]).toContain(chatRes.status);

    // At day 8 (only 4 days after chat activity), opening review fails with 409 MENTOR_STILL_ACTIVE
    ctx.clockService.advanceDays(4);
    const earlyOpen = await request(server)
      .post(`/projects/${proj.id}/mentor/abandonment-review`)
      .set('Authorization', ctx.loginAs('1'))
      .send({});
    expect(earlyOpen.status).toBe(409);
    expect(earlyOpen.body.code).toBe('MENTOR_STILL_ACTIVE');

    // Advance 3 more days (7 days since chat) -> owner opens abandonment review (201)
    ctx.clockService.advanceDays(3);
    const openRes = await request(server)
      .post(`/projects/${proj.id}/mentor/abandonment-review`)
      .set('Authorization', ctx.loginAs('1'))
      .send({ reason: 'One week without response.' });
    expect(openRes.status).toBe(201);
    expect(openRes.body.status).toBe('open');

    // Mentor fetches open review list & confirms still active -> 200
    const mineRes = await request(server)
      .get('/mentor/abandonment-reviews/mine')
      .set('Authorization', ctx.loginAs('mentor'));
    expect(mineRes.status).toBe(200);
    expect(mineRes.body.some((r: any) => r.id === openRes.body.id)).toBe(true);

    const confirmRes = await request(server)
      .post(`/mentor/abandonment-reviews/${openRes.body.id}/confirm`)
      .set('Authorization', ctx.loginAs('mentor'));
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.status).toBe('confirmed');

    // After 14d cooldown + 7d inactivity, owner opens second review and lets 48h expire
    ctx.clockService.advanceDays(14);
    const openRes2 = await request(server)
      .post(`/projects/${proj.id}/mentor/abandonment-review`)
      .set('Authorization', ctx.loginAs('1'))
      .send({ reason: 'Again unresponsive for 14 days.' });
    expect(openRes2.status).toBe(201);

    // Advance 49 hours and trigger hourly tick as Super User
    ctx.clockService.advanceHours(49);
    const tickRes = await request(server)
      .post('/admin/jobs/tick')
      .set('Authorization', ctx.loginAs('superuser'));
    expect([200, 202]).toContain(tickRes.status);

    // Verify mentor released, non-completed session refunded, escrow reconciled, and another mentor can book on the freed project
    const getReviewAfter = await request(server)
      .get(`/projects/${proj.id}/mentor/abandonment-review`)
      .set('Authorization', ctx.loginAs('1'));
    expect(getReviewAfter.status).toBe(200);
    expect(getReviewAfter.body.review.status).toBe('released');

    const reconcileRes = await request(server)
      .get('/admin/escrow/reconcile')
      .set('Authorization', ctx.loginAs('admin'));
    expect(reconcileRes.status).toBe(200);
    expect(reconcileRes.body.ok).toBe(true);
    expect(reconcileRes.body.mismatches).toEqual([]);

    // Another mentor (Sneha Iyer, userId '5', mentor-profile-4) can now be booked on the freed project
    const snehaToken = ctx.loginAs('5', undefined, { role: 'mentor' });
    const rebook = await bookPayAccept(proj.id, 'mentor-profile-4', snehaToken, 20);
    expect(rebook.status).toBe('active');

    // Clean up project/session completion so test order independence is preserved
    await request(server)
      .post(`/mentor-marketplace/sessions/${rebook.id}/complete`)
      .set('Authorization', ctx.loginAs('1'));
    ctx.projectsRepository.update(proj.id, { isCompleted: true, status: 'Completed' });
  });

  it('2. Admin can cancel an open abandonment review with reason (400 REASON_REQUIRED without reason)', async () => {
    const proj = ctx.projectsService.create('1', {
      title: 'Admin Cancel Project',
      description: 'Testing admin cancellation of open abandonment review with mandatory written reason and status transitions.',
      teamSize: 3,
      dueDate: '2026-09-15T00:00:00.000Z',
    });
    await bookPayAccept(proj.id, 'mentor-profile-1', ctx.loginAs('mentor'), 12);

    ctx.clockService.advanceDays(7);
    const openRes = await request(server)
      .post(`/projects/${proj.id}/mentor/abandonment-review`)
      .set('Authorization', ctx.loginAs('1'))
      .send({ reason: 'Delayed activity' });
    expect(openRes.status).toBe(201);

    const noReasonRes = await request(server)
      .post(`/admin/abandonment-reviews/${openRes.body.id}/cancel`)
      .set('Authorization', ctx.loginAs('admin'))
      .send({});
    expect(noReasonRes.status).toBe(400);
    expect(noReasonRes.body.code).toBe('REASON_REQUIRED');

    const cancelRes = await request(server)
      .post(`/admin/abandonment-reviews/${openRes.body.id}/cancel`)
      .set('Authorization', ctx.loginAs('admin'))
      .send({ reason: 'Mentor submitted verified travel itinerary.' });
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.status).toBe('cancelled');
  });

  it('3. Re-application cooldown enforces 14-day wait with availableAt and allows on day 15', async () => {
    const freshUser = ctx.usersRepository.create(
      {
        name: 'Meera Nair',
        username: 'meera_nair_p14',
        email: 'meera.p14@teamforge.io',
        password: 'Password1!',
        role: 'Collaborator' as any,
      },
      'u-reapply-p14',
    );
    const userToken = ctx.loginAs(freshUser.id, undefined, { role: 'collaborator' });
    const appPayload = {
      userId: freshUser.id,
      email: 'meera.p14@teamforge.io',
      name: 'Meera Nair',
      years: 6,
      bio: 'Senior full-stack developer applying to mentor university engineering teams.',
      skills: ['TypeScript', 'NestJS', 'React'],
      cvFileName: 'meera-e2e-cv.pdf',
      certificates: [
        {
          title: 'AWS Developer Associate',
          issuer: 'Amazon',
          holderName: 'Meera Nair',
          documentNumber: 'AWS-555',
        },
      ],
    };

    const submitRes = await request(server)
      .post('/mentor-applications')
      .set('Authorization', userToken)
      .send(appPayload);
    expect(submitRes.status).toBe(201);

    const rejectRes = await request(server)
      .put(`/mentor-applications/${submitRes.body.id}/reject`)
      .set('Authorization', ctx.loginAs('admin'))
      .send({ reason: 'Add more production open-source examples.' });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.rejectedAt).toBeDefined();

    // Check /mentor-applications/me returns cooldown metadata
    ctx.clockService.advanceDays(13);
    const statusRes = await request(server)
      .get('/mentor-applications/me')
      .set('Authorization', userToken);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.inCooldown).toBe(true);
    expect(statusRes.body.cooldownAvailableAt).toBeDefined();

    // Re-apply on day 13 -> 409 REAPPLY_COOLDOWN
    const day13Res = await request(server)
      .post('/mentor-applications')
      .set('Authorization', userToken)
      .send(appPayload);
    expect(day13Res.status).toBe(409);
    expect(day13Res.body.code).toBe('REAPPLY_COOLDOWN');
    expect(day13Res.body.availableAt).toBeDefined();

    // Advance 2 more days (day 15) -> 201 Created
    ctx.clockService.advanceDays(2);
    const day15Res = await request(server)
      .post('/mentor-applications')
      .set('Authorization', userToken)
      .send(appPayload);
    expect(day15Res.status).toBe(201);
  });

  it('4. Active mentee cap blocks 4th booking (409 MENTOR_AT_CAPACITY) and post-session feedback respects privacy & role boundaries', async () => {
    const snehaToken = ctx.loginAs('5', undefined, { role: 'mentor' });
    // Ensure cap = 3 for Sneha (mentor-profile-4, userId '5')
    const capRes = await request(server)
      .patch('/mentor-marketplace/mentors/profile')
      .set('Authorization', snehaToken)
      .set('x-user-id', '5')
      .send({ maxActiveMentees: 3 });
    expect(capRes.status).toBe(200);

    const projects = [1, 2, 3, 4].map((idx) =>
      idx <= 3
        ? ctx.projectsService.create('1', {
            title: `Cap Project ${idx}`,
            description: `Testing mentee capacity project ${idx} to validate active mentor session limits and conflict reporting properly.`,
            teamSize: 3,
            dueDate: '2026-09-20T00:00:00.000Z',
          })
        : ctx.projectsRepository.create('1', {
            title: `Cap Project ${idx}`,
            description: `Testing mentee capacity project ${idx} to validate active mentor session limits and conflict reporting properly.`,
            teamSize: 3,
            dueDate: '2026-09-20T00:00:00.000Z',
            createdAt: ctx.clockService.nowIso(),
          } as any, 'Open' as any),
    );

    const s1 = await bookPayAccept(projects[0].id, 'mentor-profile-4', snehaToken, 2);
    await bookPayAccept(projects[1].id, 'mentor-profile-4', snehaToken, 3);
    await bookPayAccept(projects[2].id, 'mentor-profile-4', snehaToken, 4);

    // 4th booking must fail with 409 MENTOR_AT_CAPACITY
    const scheduled4 = new Date(ctx.clockService.now().getTime() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const book4 = await request(server)
      .post('/mentor-marketplace/sessions/book')
      .set('Authorization', ctx.loginAs('1'))
      .send({
        mentorId: 'mentor-profile-4',
        projectId: projects[3].id,
        projectDescription: 'Over capacity session',
        scheduledAt: scheduled4,
      });
    expect(book4.status).toBe(409);
    expect(book4.body.code).toBe('MENTOR_AT_CAPACITY');

    // Save session note and complete s1, then submit 1-5 private feedback
    await request(server)
      .post(`/mentor-sessions/${s1.id}/notes`)
      .set('Authorization', snehaToken)
      .send({ note: 'Verified milestone sprint backlog.' });

    const completeRes = await request(server)
      .post(`/mentor-marketplace/sessions/${s1.id}/complete`)
      .set('Authorization', ctx.loginAs('1'));
    expect([200, 201]).toContain(completeRes.status);

    const badFeedback = await request(server)
      .post(`/mentor-sessions/${s1.id}/feedback`)
      .set('Authorization', ctx.loginAs('1'))
      .send({ rating: 6, comment: 'Too high' });
    expect(badFeedback.status).toBe(400);
    expect(badFeedback.body.code).toBe('INVALID_RATING');

    const okFeedback = await request(server)
      .post(`/mentor-sessions/${s1.id}/feedback`)
      .set('Authorization', ctx.loginAs('1'))
      .send({ rating: 5, comment: 'Extremely helpful feedback during architecture review.' });
    expect(okFeedback.status).toBe(200);

    const dupFeedback = await request(server)
      .post(`/mentor-sessions/${s1.id}/feedback`)
      .set('Authorization', ctx.loginAs('1'))
      .send({ rating: 4 });
    expect(dupFeedback.status).toBe(409);
    expect(dupFeedback.body.code).toBe('ALREADY_RATED');

    // Collaborator querying public mentor profile NEVER sees single feedback comment or owner name
    const collabProfileRes = await request(server)
      .get('/mentor-marketplace/mentors/mentor-profile-4')
      .set('Authorization', ctx.loginAs('collaborator'));
    expect(collabProfileRes.status).toBe(200);
    expect(collabProfileRes.body.reviews).toEqual([]);
    expect(JSON.stringify(collabProfileRes.body)).not.toContain('Extremely helpful feedback');

    // Mentor sees aggregate average only on /mentor-marketplace/mentors/me/stats
    const mentorStatsRes = await request(server)
      .get('/mentor-marketplace/mentors/me/stats')
      .set('Authorization', snehaToken);
    expect(mentorStatsRes.status).toBe(200);
    expect(mentorStatsRes.body.averageRating).toBe(5);
    expect(mentorStatsRes.body.totalFeedbackCount).toBe(1);
    expect(JSON.stringify(mentorStatsRes.body)).not.toContain('Extremely helpful feedback');

    // Collaborator cannot access admin feedback endpoint -> 403
    const collabAdminRes = await request(server)
      .get('/admin/mentors/5/feedback')
      .set('Authorization', ctx.loginAs('collaborator'));
    expect(collabAdminRes.status).toBe(403);

    // Admin sees full feedback + comment + ownerName on GET /admin/mentors/:id/feedback
    const adminFeedbackRes = await request(server)
      .get('/admin/mentors/5/feedback')
      .set('Authorization', ctx.loginAs('admin'));
    expect(adminFeedbackRes.status).toBe(200);
    expect(adminFeedbackRes.body.averageRating).toBe(5);
    expect(adminFeedbackRes.body.feedback).toHaveLength(1);
    expect(adminFeedbackRes.body.feedback[0].comment).toContain('Extremely helpful feedback');
  });
});
