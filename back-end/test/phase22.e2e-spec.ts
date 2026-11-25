import request from 'supertest';
import { createTestApp, TestAppContext } from './helpers/test-helpers';
import { UserRole } from '../src/users/dto/create-user.dto';

describe('Phase 22 E2E: Single Reputation Ledger & Completion Anti-Farming', () => {
  let ctx: TestAppContext;
  let server: any;

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer();
  });

  beforeEach(() => {
    ctx.resetStores();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('1. Seeded user (Arjun = 87) reads exact single-source reputation across leaderboard, profile, /users/me/reputation & admin view (never 174)', async () => {
    // Re-running onModuleInit / backfill does not double Arjun's reputation
    ctx.reputationService.onModuleInit();

    const meRes = await request(server)
      .get('/users/me')
      .set('Authorization', ctx.loginAs('2'))
      .expect(200);
    expect(meRes.body.rep).toBe(87);
    expect(meRes.body.profile.rep).toBe(87);

    const repRes = await request(server)
      .get('/users/me/reputation')
      .set('Authorization', ctx.loginAs('2'))
      .expect(200);
    expect(repRes.body.reputation).toBe(87);
    expect(repRes.body.items).toHaveLength(1);
    expect(repRes.body.items[0].type).toBe('seed');
    expect(repRes.body.items[0].reason).toBe('Starting reputation');

    const lbRes = await request(server)
      .get('/leaderboard')
      .set('Authorization', ctx.loginAs('2'))
      .expect(200);
    const arjunRow = lbRes.body.find((r: any) => String(r.userId) === '2');
    expect(arjunRow).toBeDefined();
    expect(arjunRow.rep).toBe(87);

    const pubRes = await request(server)
      .get('/users/2/public-profile')
      .set('Authorization', ctx.loginAs('1'))
      .expect(200);
    expect(pubRes.body.rep).toBe(87);

    const adminUserRes = await request(server)
      .get('/admin/users/2')
      .set('Authorization', ctx.loginAs('admin'))
      .expect(200);
    expect(adminUserRes.body.rep).toBe(87);
  });

  it('2. New signup starts at 100 across all endpoints, and approved task adds +8 consistently everywhere', async () => {
    const signupRes = await request(server)
      .post('/auth/signup')
      .send({
        name: 'Phase22 Tester',
        email: 'p22tester@teamforge.io',
        password: 'Password123!',
        role: 'Collaborator',
      })
      .expect(201);

    const newUserId = String(signupRes.body.user?.id || signupRes.body.id);
    expect(newUserId).toBeTruthy();

    await request(server)
      .post('/auth/profile')
      .set('Authorization', `Bearer ${signupRes.body.accessToken}`)
      .send({ name: 'Phase22 Tester', username: 'p22tester' })
      .expect(200);

    const newToken = ctx.loginAs(newUserId);
    const meBefore = await request(server)
      .get('/users/me')
      .set('Authorization', newToken)
      .expect(200);
    expect(meBefore.body.rep).toBe(100);

    const lbBefore = await request(server)
      .get('/leaderboard')
      .set('Authorization', newToken)
      .expect(200);
    const lbRowBefore = lbBefore.body.find((r: any) => String(r.userId) === newUserId);
    expect(lbRowBefore.rep).toBe(100);

    // Owner '1' creates proj and assigns task to newUserId; advance 90m, submit & approve
    const dueDate = new Date(ctx.clockService.now().getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const proj = ctx.projectsRepository.create(
      '1',
      {
        title: 'Task Approval Rep Test',
        description: 'Valid description for task approval test.',
        maxCollaborators: 4,
        category: 'Web',
        difficulty: 'Medium',
        duration: '2 weeks',
        requiredSkills: ['React'],
        dueDate,
        createdAt: ctx.clockService.nowIso(),
      } as any,
      'Open' as any,
    );
    ctx.projectsRepository.addCollaborator(proj.id, {
      id: newUserId,
      name: 'Phase22 Tester',
      role: 'Collaborator',
    });

    const taskRes = await request(server)
      .post('/tasks')
      .set('Authorization', ctx.loginAs('1'))
      .send({
        projectId: proj.id,
        title: 'Build endpoint check',
        description: 'Build & test endpoint',
        priority: 'High',
        assigneeId: newUserId,
        dueDate,
      })
      .expect(201);
    const taskId = taskRes.body.id;

    // Advance >= 60 minutes, move to In Review & approve
    ctx.advanceTime({ hours: 2 });
    await request(server)
      .patch(`/tasks/${taskId}/status`)
      .set('Authorization', newToken)
      .send({ status: 'In Progress' })
      .expect(200);
    await request(server)
      .patch(`/tasks/${taskId}/status`)
      .set('Authorization', newToken)
      .send({ status: 'In Review', proofLink: 'https://github.com/teamforge/pr-1' })
      .expect(200);
    await request(server)
      .post(`/tasks/${taskId}/review`)
      .set('Authorization', ctx.loginAs('1'))
      .send({ decision: 'approve' })
      .expect(200);

    const meAfter = await request(server)
      .get('/users/me')
      .set('Authorization', newToken)
      .expect(200);
    expect(meAfter.body.rep).toBe(108);

    const lbAfter = await request(server)
      .get('/leaderboard')
      .set('Authorization', newToken)
      .expect(200);
    const lbRowAfter = lbAfter.body.find((r: any) => String(r.userId) === newUserId);
    expect(lbRowAfter.rep).toBe(108);

    const repLedgerAfter = await request(server)
      .get('/users/me/reputation')
      .set('Authorization', newToken)
      .expect(200);
    expect(repLedgerAfter.body.reputation).toBe(108);
    expect(repLedgerAfter.body.items.some((e: any) => e.type === 'task_approved' && e.delta === 8)).toBe(true);
  });

  it('3. Duplicate seed entries are repaired without double-seeding on startup backfill', async () => {
    ctx.reputationService.recordTaskApproved('2', 'task-snapshot-check');
    expect(ctx.reputationService.getTotal('2')).toBe(95);

    (ctx.reputationService as any).entries.push({
      id: 'rep-corrupt-dup-2',
      userId: '2',
      type: 'seed',
      delta: 87,
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    ctx.reputationService.repairReputationLedger();
    ctx.reputationService.onModuleInit();

    expect(ctx.reputationService.getTotal('2')).toBe(95);
    expect(
      ctx.auditService.findAll().some((a) => a.action === 'LEDGER_REPAIRED'),
    ).toBe(true);
  });

  it('4. Project completion anti-farming rules: enforces min 3d age, 60m review gap, non-duplicate collaborator & awards badge/+15 rep once when valid', async () => {
    const dueDate = new Date(ctx.clockService.now().getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const makeTasksAndApprove = async (projId: string, collabId: string, collabToken: string, gapMinutes: number) => {
      const taskIds: string[] = [];
      for (let i = 1; i <= 3; i++) {
        const t = await request(server)
          .post('/tasks')
          .set('Authorization', ctx.loginAs('1'))
          .send({
            projectId: projId,
            title: `Task ${i} for ${projId}`,
            description: `Description ${i}`,
            priority: 'Low',
            assigneeId: collabId,
            dueDate,
          })
          .expect(201);
        taskIds.push(t.body.id);
      }

      ctx.advanceTime({ ms: gapMinutes * 60 * 1000 });

      for (const tid of taskIds) {
        await request(server)
          .patch(`/tasks/${tid}/status`)
          .set('Authorization', collabToken)
          .send({ status: 'In Progress' })
          .expect(200);
        await request(server)
          .patch(`/tasks/${tid}/status`)
          .set('Authorization', collabToken)
          .send({ status: 'In Review', proofLink: 'https://github.com/teamforge/proof' })
          .expect(200);
        await request(server)
          .post(`/tasks/${tid}/review`)
          .set('Authorization', ctx.loginAs('1'))
          .send({ decision: 'approve' })
          .expect(200);
      }
    };

    // Case A: 3 tasks approved >= 60m after assignment, but project < 3 days old
    const youngProj = ctx.projectsRepository.create(
      '1',
      {
        title: 'Young Farming Project',
        description: 'Testing age limit',
        maxCollaborators: 5,
        category: 'Web',
        difficulty: 'Medium',
        duration: '2 weeks',
        requiredSkills: ['React'],
        dueDate,
        createdAt: ctx.clockService.nowIso(),
      } as any,
      'Open' as any,
    );
    ctx.projectsRepository.addCollaborator(youngProj.id, { id: '2', name: 'Arjun Sharma', role: 'Collaborator' });
    await makeTasksAndApprove(youngProj.id, '2', ctx.loginAs('2'), 90);

    const ownerRepBefore = ctx.reputationService.getTotal('1');
    const youngComplete = await request(server)
      .post(`/projects/${youngProj.id}/complete`)
      .set('Authorization', ctx.loginAs('1'))
      .send({ finalLink: 'https://github.com/teamforge/young' })
      .expect(201);
    expect(youngComplete.body.badgeAwarded).toBe(false);
    expect(youngComplete.body.badgeReason).toBe('No badge: project is under 3 days old');
    expect(ctx.reputationService.getTotal('1')).toBe(ownerRepBefore);

    // Case B: Project >= 3 days old, but tasks approved only 10 minutes after assignment
    const fastProj = ctx.projectsRepository.create(
      '1',
      {
        title: 'Fast Approval Farming Project',
        description: 'Testing 60m review gap',
        maxCollaborators: 5,
        category: 'Web',
        difficulty: 'Medium',
        duration: '2 weeks',
        requiredSkills: ['React'],
        dueDate,
        createdAt: ctx.clockService.nowIso(),
      } as any,
      'Open' as any,
    );
    ctx.projectsRepository.addCollaborator(fastProj.id, { id: '2', name: 'Arjun Sharma', role: 'Collaborator' });
    ctx.advanceTime({ days: 4 });
    await makeTasksAndApprove(fastProj.id, '2', ctx.loginAs('2'), 10);

    const fastComplete = await request(server)
      .post(`/projects/${fastProj.id}/complete`)
      .set('Authorization', ctx.loginAs('1'))
      .send({ finalLink: 'https://github.com/teamforge/fast' })
      .expect(201);
    expect(fastComplete.body.badgeAwarded).toBe(false);
    expect(fastComplete.body.badgeReason).toContain('60-minute review gap');
    expect(ctx.reputationService.getTotal('1')).toBe(ownerRepBefore);

    // Case C: Owner and collaborator belong to same duplicate group (shared verified phone)
    const dupOwner = ctx.usersRepository.create({
      name: 'Dup Owner',
      email: 'dupowner22@teamforge.io',
      username: 'dupowner22',
      role: UserRole.ProjectOwner,
      phone: '+919900011223',
      phoneVerified: true,
    } as any);
    ctx.reputationService.recordInitial(dupOwner.id);

    const dupCollab = ctx.usersRepository.create({
      name: 'Dup Collab',
      email: 'dupcollab22@teamforge.io',
      username: 'dupcollab22',
      role: UserRole.Collaborator,
      phone: '+919900011223',
      phoneVerified: true,
    } as any);
    ctx.reputationService.recordInitial(dupCollab.id);

    const dupProj = ctx.projectsRepository.create(
      dupOwner.id,
      {
        title: 'Duplicate Ring Project',
        description: 'Testing duplicate collusion check',
        maxCollaborators: 5,
        category: 'Web',
        difficulty: 'Medium',
        duration: '2 weeks',
        requiredSkills: ['Node.js'],
        dueDate,
        createdAt: ctx.clockService.nowIso(),
      } as any,
      'Open' as any,
    );
    ctx.projectsRepository.addCollaborator(dupProj.id, { id: dupCollab.id, name: dupCollab.name, role: 'Collaborator' });

    const dupTaskIds: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const t = await request(server)
        .post('/tasks')
        .set('Authorization', ctx.loginAs(dupOwner.id))
        .send({
          projectId: dupProj.id,
          title: `Dup Task ${i}`,
          description: 'Testing dup',
          priority: 'Low',
          assigneeId: dupCollab.id,
          dueDate,
        })
        .expect(201);
      dupTaskIds.push(t.body.id);
    }
    ctx.advanceTime({ days: 4 });
    for (const tid of dupTaskIds) {
      await request(server)
        .patch(`/tasks/${tid}/status`)
        .set('Authorization', ctx.loginAs(dupCollab.id))
        .send({ status: 'In Progress' })
        .expect(200);
      await request(server)
        .patch(`/tasks/${tid}/status`)
        .set('Authorization', ctx.loginAs(dupCollab.id))
        .send({ status: 'In Review', proofLink: 'https://github.com/teamforge/dup' })
        .expect(200);
      await request(server)
        .post(`/tasks/${tid}/review`)
        .set('Authorization', ctx.loginAs(dupOwner.id))
        .send({ decision: 'approve' })
        .expect(200);
    }
    const dupComplete = await request(server)
      .post(`/projects/${dupProj.id}/complete`)
      .set('Authorization', ctx.loginAs(dupOwner.id))
      .send({ finalLink: 'https://github.com/teamforge/dup' })
      .expect(201);
    expect(dupComplete.body.badgeAwarded).toBe(false);
    expect(dupComplete.body.badgeReason).toContain('duplicate group');
    expect(ctx.reputationService.getTotal(dupOwner.id)).toBe(100);

    // Case D: Valid project (>= 3 days old, 3 tasks >= 60m gap, distinct non-dup collab) -> awards +15 rep
    const validProj = ctx.projectsRepository.create(
      '1',
      {
        title: 'Legitimate Completed Project',
        description: 'Passes every check',
        maxCollaborators: 5,
        category: 'Web',
        difficulty: 'Hard',
        duration: '4 weeks',
        requiredSkills: ['TypeScript'],
        dueDate,
        createdAt: ctx.clockService.nowIso(),
      } as any,
      'Open' as any,
    );
    ctx.projectsRepository.addCollaborator(validProj.id, { id: '2', name: 'Arjun Sharma', role: 'Collaborator' });
    ctx.advanceTime({ days: 4 });
    await makeTasksAndApprove(validProj.id, '2', ctx.loginAs('2'), 90);

    const validComplete = await request(server)
      .post(`/projects/${validProj.id}/complete`)
      .set('Authorization', ctx.loginAs('1'))
      .send({ finalLink: 'https://github.com/teamforge/valid-complete' })
      .expect(201);
    expect(validComplete.body.badgeAwarded).toBe(true);
    expect(ctx.reputationService.getTotal('1')).toBe(ownerRepBefore + 15);
  });

  it('5. GET /admin/reputation/reconcile requires Super User (403 for admin/user) and returns { ok: true, mismatches: [] }', async () => {
    await request(server)
      .get('/admin/reputation/reconcile')
      .set('Authorization', ctx.loginAs('2'))
      .expect(403);

    await request(server)
      .get('/admin/reputation/reconcile')
      .set('Authorization', ctx.loginAs('admin'))
      .expect(403);

    const suRes = await request(server)
      .get('/admin/reputation/reconcile')
      .set('Authorization', ctx.loginAs('superuser'))
      .expect(200);

    expect(suRes.body.ok).toBe(true);
    expect(suRes.body.totalChecked).toBeGreaterThan(0);
    expect(suRes.body.mismatches).toEqual([]);
  });
});
