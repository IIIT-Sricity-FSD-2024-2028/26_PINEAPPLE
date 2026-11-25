import request from 'supertest';
import { TaskStatus } from '../src/tasks/dto/create-task.dto';
import { createTestApp, TestAppContext } from './helpers/test-helpers';

describe('FIX 5 E2E: Projects Pages & Collaborator My Work', () => {
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

  it('1. Collaborator approved through request and one who accepted invite both appear in Ongoing while active', async () => {
    const ownerToken = ctx.loginAs('1');
    const userAToken = ctx.loginAs('2'); // Arjun Sharma (Collaborator)
    const userBToken = ctx.loginAs('6'); // Aditya Sai (Collaborator, username 'adityasai')

    // 1. Owner creates active project
    const projRes = await request(server)
      .post('/projects')
      .set('Authorization', ownerToken)
      .send({
        title: 'Distributed Compute Grid',
        description: validDescription,
        skills: ['Rust', 'Node.js'],
        duration: '3 Months',
        dueDate: '2028-12-31T00:00:00.000Z',
        teamSize: 5,
        status: 'Open',
      })
      .expect(201);

    const projectId = projRes.body.id;

    // 2. User A applies via join request -> Owner approves
    const req: any = (ctx.joinRequestsService as any).create(
      {
        projectId,
        message: 'Excited to contribute to compute grid!',
        skills: ['Rust'],
      },
      '2',
    );
    (ctx.joinRequestsService as any).approveRequest(req.id, '1');

    // 3. Owner invites User B ('adityasai') -> User B accepts
    const invite = ctx.projectInvitesService.sendInvite(
      projectId,
      'adityasai',
      '1',
      'Join our team!'
    );
    await request(server)
      .post(`/invites/${invite.id}/accept`)
      .set('Authorization', userBToken)
      .expect(200);

    // 4. Verify User A's My Work
    const resA = await request(server)
      .get('/projects/collaborator/2')
      .set('Authorization', userAToken)
      .expect(200);

    expect(resA.body.ongoing.some((p: any) => p.id === projectId)).toBe(true);
    expect(resA.body.completed.some((p: any) => p.id === projectId)).toBe(false);
    expect(resA.body.ongoingCount).toBe(resA.body.ongoing.length);
    expect(resA.body.completedCount).toBe(resA.body.completed.length);

    // 5. Verify User B's My Work
    const resB = await request(server)
      .get('/projects/collaborator/6')
      .set('Authorization', userBToken)
      .expect(200);

    expect(resB.body.ongoing.some((p: any) => p.id === projectId)).toBe(true);
    expect(resB.body.completed.some((p: any) => p.id === projectId)).toBe(false);
    expect(resB.body.ongoingCount).toBe(resB.body.ongoing.length);
    expect(resB.body.completedCount).toBe(resB.body.completed.length);
  });

  it('2. After owner completes project, it moves to Completed for both collaborators', async () => {
    const ownerToken = ctx.loginAs('1');
    const userAToken = ctx.loginAs('2');
    const userBToken = ctx.loginAs('6');

    // 1. Create project
    const projRes = await request(server)
      .post('/projects')
      .set('Authorization', ownerToken)
      .send({
        title: 'Campus Mesh Protocol',
        description: validDescription,
        skills: ['Go', 'TypeScript'],
        duration: '2 Months',
        dueDate: '2028-11-30T00:00:00.000Z',
        teamSize: 5,
        status: 'In Progress',
      })
      .expect(201);
    const projectId = projRes.body.id;

    // 2. Add both collaborators
    ctx.projectsService.addCollaborator(projectId, { id: '2', name: 'Arjun Sharma', role: 'Collaborator' });
    ctx.projectsService.addCollaborator(projectId, { id: '6', name: 'Aditya Sai', role: 'Collaborator' });

    // 3. Add approved task so completion guard passes
    const task = ctx.tasksService.create(
      {
        projectId,
        title: 'Core Peer Discovery',
        description: 'Implement distributed hash table routing algorithm.',
        priority: 'High',
        dueDate: '2028-10-30T00:00:00.000Z',
        assigneeId: '2',
      },
      '1'
    );
    ctx.tasksService.update(task.id, { status: TaskStatus.Completed });

    // 4. Complete the project
    const completeRes = await request(server)
      .post(`/projects/${projectId}/complete`)
      .set('Authorization', ownerToken)
      .send({ finalLink: 'https://github.com/teamforge/mesh-protocol' });

    expect([200, 201]).toContain(completeRes.status);

    // 5. Verify User A sees it in Completed
    const resA = await request(server)
      .get('/projects/collaborator/2')
      .set('Authorization', userAToken)
      .expect(200);

    expect(resA.body.ongoing.some((p: any) => p.id === projectId)).toBe(false);
    expect(resA.body.completed.some((p: any) => p.id === projectId)).toBe(true);
    expect(resA.body.ongoingCount).toBe(resA.body.ongoing.length);
    expect(resA.body.completedCount).toBe(resA.body.completed.length);

    // 6. Verify User B sees it in Completed
    const resB = await request(server)
      .get('/projects/collaborator/6')
      .set('Authorization', userBToken)
      .expect(200);

    expect(resB.body.ongoing.some((p: any) => p.id === projectId)).toBe(false);
    expect(resB.body.completed.some((p: any) => p.id === projectId)).toBe(true);
  });

  it('3. After project is Closed, it appears in Completed with its closure reason', async () => {
    const ownerToken = ctx.loginAs('1');
    const userAToken = ctx.loginAs('2');

    // 1. Create project
    const projRes = await request(server)
      .post('/projects')
      .set('Authorization', ownerToken)
      .send({
        title: 'Solar Microgrid Telemetry',
        description: validDescription,
        skills: ['Python', 'IoT'],
        duration: '4 Months',
        dueDate: '2028-09-30T00:00:00.000Z',
        teamSize: 5,
        status: 'Open',
      })
      .expect(201);
    const projectId = projRes.body.id;

    ctx.projectsService.addCollaborator(projectId, { id: '2', name: 'Arjun Sharma', role: 'Collaborator' });

    // 2. Admin closes project using seeded admin identity
    const adminToken = ctx.loginAs('admin');
    await request(server)
      .post(`/projects/${projectId}/close`)
      .set('Authorization', adminToken)
      .send({ reason: 'Owner suspended for policy violation', feedback: { reasons: ['OTHER'], explanation: 'Owner suspended for policy violation' } })
      .expect(200);

    // 3. Verify collaborator sees it in Completed with closure reason
    const res = await request(server)
      .get('/projects/collaborator/2')
      .set('Authorization', userAToken)
      .expect(200);

    const closedProj = res.body.completed.find((p: any) => p.id === projectId);
    expect(closedProj).toBeDefined();
    expect(closedProj.status.toLowerCase()).toBe('closed');
    expect(closedProj.closureReason).toBe('Owner suspended for policy violation');
    expect(res.body.ongoing.some((p: any) => p.id === projectId)).toBe(false);
  });

  it('4. Soft-deleted project does not appear in ongoing or completed', async () => {
    const ownerToken = ctx.loginAs('1');
    const userAToken = ctx.loginAs('2');

    const projRes = await request(server)
      .post('/projects')
      .set('Authorization', ownerToken)
      .send({
        title: 'Cancelled Blockchain Experiment',
        description: validDescription,
        skills: ['Solidity'],
        duration: '1 Month',
        dueDate: '2028-08-31T00:00:00.000Z',
        teamSize: 3,
        status: 'Open',
      })
      .expect(201);
    const projectId = projRes.body.id;

    ctx.projectsService.addCollaborator(projectId, { id: '2', name: 'Arjun Sharma', role: 'Collaborator' });

    // Soft delete with canonical reason
    await request(server)
      .delete(`/projects/${projectId}`)
      .set('Authorization', ownerToken)
      .send({ reasons: ['PROJECT_NO_LONGER_REQUIRED'], explanation: 'Experiment cancelled' })
      .expect(200);

    const res = await request(server)
      .get('/projects/collaborator/2')
      .set('Authorization', userAToken)
      .expect(200);

    expect(res.body.ongoing.some((p: any) => p.id === projectId)).toBe(false);
    expect(res.body.completed.some((p: any) => p.id === projectId)).toBe(false);
  });

  it('5. A member who left but had an approved task still sees the project', async () => {
    const ownerToken = ctx.loginAs('1');
    const userCToken = ctx.loginAs('6'); // Aditya Sai (pure Collaborator)

    // 1. Create active project
    const projRes = await request(server)
      .post('/projects')
      .set('Authorization', ownerToken)
      .send({
        title: 'Open Robotics Framework',
        description: validDescription,
        skills: ['C++', 'ROS'],
        duration: '6 Months',
        dueDate: '2029-01-01T00:00:00.000Z',
        teamSize: 5,
        status: 'In Progress',
      })
      .expect(201);
    const projectId = projRes.body.id;

    ctx.projectsService.addCollaborator(projectId, { id: '6', name: 'Aditya Sai', role: 'Collaborator' });

    // 2. Assign and complete a task for User C
    const task = ctx.tasksService.create(
      {
        projectId,
        title: 'Kinematics Solver Engine',
        description: 'Inverse kinematics calculation using Jacobian matrices.',
        priority: 'High',
        dueDate: '2028-11-01T00:00:00.000Z',
        assigneeId: '6',
      },
      '1'
    );
    ctx.tasksService.update(task.id, { status: TaskStatus.Completed });

    // 3. User C leaves the project with valid category and reason
    const leaveRes = await request(server)
      .post(`/projects/${projectId}/leave`)
      .set('Authorization', userCToken)
      .send({
        category: 'Personal reasons',
        reason: 'Leaving due to unexpected academic coursework load.',
        reasons: ['PERSONAL_COMMITMENTS'],
        explanation: 'Leaving due to unexpected academic coursework load.',
      });

    expect([200, 201]).toContain(leaveRes.status);

    // 4. Verify User C still sees the project in ongoing (since project is still active)
    const res = await request(server)
      .get('/projects/collaborator/6')
      .set('Authorization', userCToken)
      .expect(200);

    expect(res.body.ongoing.some((p: any) => p.id === projectId)).toBe(true);

    // 5. When project completes, it moves to completed for User C as well
    const completeRes = await request(server)
      .post(`/projects/${projectId}/complete`)
      .set('Authorization', ownerToken)
      .send({ finalLink: 'https://github.com/teamforge/robotics-framework' });

    expect([200, 201]).toContain(completeRes.status);

    const resCompleted = await request(server)
      .get('/projects/collaborator/6')
      .set('Authorization', userCToken)
      .expect(200);

    expect(resCompleted.body.ongoing.some((p: any) => p.id === projectId)).toBe(false);
    expect(resCompleted.body.completed.some((p: any) => p.id === projectId)).toBe(true);
  });

  it('6. User with no relation to the project does not see it', async () => {
    const ownerToken = ctx.loginAs('1');
    const unrelatedToken = ctx.loginAs('8'); // Vikram Nair (no relation)

    const projRes = await request(server)
      .post('/projects')
      .set('Authorization', ownerToken)
      .send({
        title: 'Private AI Research',
        description: validDescription,
        skills: ['PyTorch'],
        duration: '3 Months',
        dueDate: '2028-12-31T00:00:00.000Z',
        teamSize: 3,
        status: 'Open',
      })
      .expect(201);
    const projectId = projRes.body.id;

    const res = await request(server)
      .get('/projects/collaborator/8')
      .set('Authorization', unrelatedToken)
      .expect(200);

    expect(res.body.ongoing.some((p: any) => p.id === projectId)).toBe(false);
    expect(res.body.completed.some((p: any) => p.id === projectId)).toBe(false);
  });

  it('7. Counts equal the list lengths', async () => {
    const userAToken = ctx.loginAs('2');
    const res = await request(server)
      .get('/projects/collaborator/2')
      .set('Authorization', userAToken)
      .expect(200);

    expect(res.body.ongoingCount).toBe(res.body.ongoing.length);
    expect(res.body.completedCount).toBe(res.body.completed.length);
  });
});
