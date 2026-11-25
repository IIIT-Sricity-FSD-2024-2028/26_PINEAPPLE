import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, TestAppContext } from './helpers/test-helpers';

describe('Phase 2 E2E API Tests: Project Duration Removal & Due Date Enforcement', () => {
  let ctx: TestAppContext;
  let app: INestApplication;
  let server: any;
  let ownerToken: string;
  let collabToken: string;

  const validDescription = 'A comprehensive project description explaining the architectural goals, key milestones, requirements, and deliverables for collaborators.';

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;
    server = app.getHttpServer();

    ownerToken = ctx.loginAs('1', [], { email: 'priya.patel@teamforge.io', role: 'Project Owner' });
    collabToken = ctx.loginAs('2', [], { email: 'arjun.sharma@teamforge.io', role: 'Collaborator' });
  });

  beforeEach(() => {
    ctx.resetStores();
    ctx.clockService.setTime('2026-11-13T10:00:00.000Z');
    ctx.usersRepository.update('1', { emailVerified: true } as any);
    ctx.usersRepository.update('2', { emailVerified: true } as any);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Project Creation (POST /projects)', () => {
    it('returns 400 when creating a project without a due date', async () => {
      const res = await request(server)
        .post('/projects')
        .set('Authorization', ownerToken)
        .send({
          title: 'Project Without Due Date',
          description: validDescription,
          requiredSkills: ['React', 'Node.js'],
        });

      expect(res.status).toBe(400);
      const msg = Array.isArray(res.body.message) ? res.body.message.join(' ') : res.body.message;
      expect(msg).toMatch(/due\s*date/i);
    });

    it('returns 400 when creating a project with an empty due date', async () => {
      const res = await request(server)
        .post('/projects')
        .set('Authorization', ownerToken)
        .send({
          title: 'Project With Empty Due Date',
          description: validDescription,
          requiredSkills: ['React', 'Node.js'],
          dueDate: '',
        });

      expect(res.status).toBe(400);
      const msg = Array.isArray(res.body.message) ? res.body.message.join(' ') : res.body.message;
      expect(msg).toMatch(/due\s*date/i);
    });

    it('returns 400 when creating a project with a past due date', async () => {
      const res = await request(server)
        .post('/projects')
        .set('Authorization', ownerToken)
        .send({
          title: 'Project With Past Due Date',
          description: validDescription,
          requiredSkills: ['React', 'Node.js'],
          dueDate: '2026-11-10T00:00:00.000Z',
        });

      expect(res.status).toBe(400);
      const msg = Array.isArray(res.body.message) ? res.body.message.join(' ') : res.body.message;
      expect(msg).toMatch(/cannot be in the past|at least tomorrow/i);
    });

    it('returns 400 when creating a project with today as due date', async () => {
      const res = await request(server)
        .post('/projects')
        .set('Authorization', ownerToken)
        .send({
          title: 'Project With Today Due Date',
          description: validDescription,
          requiredSkills: ['React', 'Node.js'],
          dueDate: '2026-11-13T23:59:59.000Z',
        });

      expect(res.status).toBe(400);
      const msg = Array.isArray(res.body.message) ? res.body.message.join(' ') : res.body.message;
      expect(msg).toMatch(/cannot be in the past or today|at least tomorrow/i);
    });

    it('succeeds with a valid future due date, and response body has NO duration field', async () => {
      const res = await request(server)
        .post('/projects')
        .set('Authorization', ownerToken)
        .send({
          title: 'Clean Project With Due Date',
          description: validDescription,
          requiredSkills: ['TypeScript', 'NestJS'],
          dueDate: '2026-12-25T00:00:00.000Z',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.dueDate).toBe('2026-12-25T00:00:00.000Z');
      expect(res.body).not.toHaveProperty('duration');
      expect(res.body.duration).toBeUndefined();
    });

    it('strips/ignores duration if sent in request per DTO whitelist policy and returns no duration field', async () => {
      const res = await request(server)
        .post('/projects')
        .set('Authorization', ownerToken)
        .send({
          title: 'Legacy Payload Project',
          description: validDescription,
          requiredSkills: ['React'],
          duration: '3 Months',
          dueDate: '2027-01-15T00:00:00.000Z',
        });

      expect(res.status).toBe(201);
      expect(res.body).not.toHaveProperty('duration');
      expect(res.body.duration).toBeUndefined();

      // Verify the persisted entity in repository also does not have duration
      const persisted = ctx.projectsRepository.findById(res.body.id);
      expect(persisted).toBeDefined();
      expect((persisted as any).duration).toBeUndefined();
    });
  });

  describe('Project Update (PATCH /projects/:id)', () => {
    it('returns 400 when editing a project without a due date', async () => {
      const res = await request(server)
        .patch('/projects/proj-1')
        .set('Authorization', ownerToken)
        .send({
          title: 'Updated AI Study Planner Without Due Date',
        });

      expect(res.status).toBe(400);
      const msg = Array.isArray(res.body.message) ? res.body.message.join(' ') : res.body.message;
      expect(msg).toMatch(/due\s*date/i);
    });

    it('returns 400 when editing a project with a past due date', async () => {
      const res = await request(server)
        .patch('/projects/proj-1')
        .set('Authorization', ownerToken)
        .send({
          title: 'Updated AI Study Planner With Past Due Date',
          dueDate: '2026-11-01T00:00:00.000Z',
        });

      expect(res.status).toBe(400);
      const msg = Array.isArray(res.body.message) ? res.body.message.join(' ') : res.body.message;
      expect(msg).toMatch(/cannot be in the past|at least tomorrow/i);
    });

    it('succeeds when editing a project with a future due date, response contains NO duration', async () => {
      const res = await request(server)
        .patch('/projects/proj-1')
        .set('Authorization', ownerToken)
        .send({
          title: 'Updated AI Study Planner Future',
          dueDate: '2027-03-31T00:00:00.000Z',
        });

      expect(res.status).toBe(200);
      expect(res.body.dueDate).toBe('2027-03-31T00:00:00.000Z');
      expect(res.body).not.toHaveProperty('duration');
      expect(res.body.duration).toBeUndefined();
    });

    it('strips/ignores duration if sent in update payload per DTO whitelist policy', async () => {
      const res = await request(server)
        .patch('/projects/proj-1')
        .set('Authorization', ownerToken)
        .send({
          title: 'Updated AI Study Planner Legacy Duration',
          dueDate: '2027-04-30T00:00:00.000Z',
          duration: '6 Months',
        });

      expect(res.status).toBe(200);
      expect(res.body).not.toHaveProperty('duration');
      expect(res.body.duration).toBeUndefined();

      const persisted = ctx.projectsRepository.findById('proj-1');
      expect((persisted as any).duration).toBeUndefined();
    });
  });

  describe('Project Responses & Seed Data Hygiene (GET /projects & GET /projects/:id)', () => {
    it('seed projects have valid future dueDates and NO duration in GET /projects response', async () => {
      const res = await request(server)
        .get('/projects')
        .set('Authorization', collabToken);

      expect(res.status).toBe(200);
      const projects = Array.isArray(res.body) ? res.body : res.body.items;
      expect(projects.length).toBeGreaterThan(0);

      for (const p of projects) {
        expect(p.dueDate).toBeDefined();
        expect(p).not.toHaveProperty('duration');
        expect(p.duration).toBeUndefined();
      }
    });

    it('GET /projects/:id response contains valid dueDate and NO duration', async () => {
      const res = await request(server)
        .get('/projects/proj-1')
        .set('Authorization', ownerToken);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('proj-1');
      expect(res.body.dueDate).toBe('2027-02-28T00:00:00.000Z');
      expect(res.body).not.toHaveProperty('duration');
      expect(res.body.duration).toBeUndefined();
    });

    it('Markdown export (GET /projects/:id/export.md) returns 404 (route removed)', async () => {
      const res = await request(server)
        .get('/projects/proj-1/export.md')
        .set('Authorization', ownerToken);

      expect(res.status).toBe(404);
    });
  });
});
