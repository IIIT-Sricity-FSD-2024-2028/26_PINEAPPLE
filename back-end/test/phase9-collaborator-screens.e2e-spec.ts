import request from 'supertest';
import { createTestApp, TestAppContext } from './helpers/test-helpers';

describe('Phase 9 Part C: Deadline Change Reason & History E2E', () => {
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

  const validDescription =
    'This is a comprehensive open-source engineering initiative aimed at designing, testing, and deploying scalable distributed systems for collaborative scientific computing across diverse universities.';

  it('records deadlineHistory on deadline change; exposes history to member and hides it from outsiders', async () => {
    const ownerToken = ctx.loginAs('1');
    const memberToken = ctx.loginAs('2');
    const strangerToken = ctx.loginAs('4');

    const initialDue = new Date(Date.now() + 15 * 86400000).toISOString();
    const extendedDue = new Date(Date.now() + 30 * 86400000).toISOString();

    // 1. Owner creates project
    const projRes = await request(server)
      .post('/projects')
      .set('Authorization', ownerToken)
      .send({
        title: 'Distributed Compute Mesh',
        description: validDescription,
        requiredSkills: ['Distributed Systems', 'Go'],
        dueDate: initialDue,
      })
      .expect(201);
    const projectId = projRes.body.id;

    // 2. Add user 2 as collaborator (via join request and owner approval)
    const appRes = await request(server)
      .post('/join-requests')
      .set('Authorization', memberToken)
      .send({
        projectId,
        role: 'Collaborator',
        message: 'Interested in consensus algorithms.',
      })
      .expect(201);

    await request(server)
      .patch(`/join-requests/${appRes.body.id}`)
      .set('Authorization', ownerToken)
      .send({ status: 'Approved' })
      .expect(200);

    // 3. Owner changes deadline
    const reasonText = 'Extending deadline to complete end-to-end consensus benchmarks and security review.';
    const patchRes = await request(server)
      .patch(`/projects/${projectId}/deadline`)
      .set('Authorization', ownerToken)
      .send({
        dueDate: extendedDue,
        reason: reasonText,
      })
      .expect(200);

    expect(patchRes.body.dueDate).toBe(extendedDue);
    expect(patchRes.body.deadlineHistory).toHaveLength(1);
    expect(patchRes.body.deadlineHistory[0].reason).toBe(reasonText);
    expect(patchRes.body.deadlineHistory[0].newDueDate).toBe(extendedDue);

    // 4. Member views project detail: CAN see deadlineHistory
    const memberViewRes = await request(server)
      .get(`/projects/${projectId}`)
      .set('Authorization', memberToken)
      .expect(200);

    expect(memberViewRes.body.deadlineHistory).toBeDefined();
    expect(memberViewRes.body.deadlineHistory).toHaveLength(1);
    expect(memberViewRes.body.deadlineHistory[0].reason).toBe(reasonText);

    // 5. Stranger views project detail: CANNOT see deadlineHistory
    const strangerViewRes = await request(server)
      .get(`/projects/${projectId}`)
      .set('Authorization', strangerToken)
      .expect(200);

    expect(strangerViewRes.body.deadlineHistory).toBeUndefined();

    // 6. Member notifications include the reason
    const notifsRes = await request(server)
      .get('/notifications')
      .set('Authorization', memberToken)
      .expect(200);

    const deadlineNotif = notifsRes.body.find((n: any) => n.type === 'PROJECT_DEADLINE_CHANGED');
    expect(deadlineNotif).toBeDefined();
    expect(deadlineNotif.message).toContain(reasonText);
  });
});
