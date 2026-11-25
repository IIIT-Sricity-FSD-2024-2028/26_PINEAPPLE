import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { AppModule } from '../app.module';
import { MailService } from '../mail/mail.service';
import { ClockService } from '../common/services/clock.service';
import { TemplatesService } from './templates.service';
import { ProjectsService } from './projects.service';
import { ProjectsRepository } from './projects.repository';
import { TasksService } from '../tasks/tasks.service';
import { TasksRepository } from '../tasks/tasks.repository';
import { TaskStatus } from '../tasks/dto/create-task.dto';
import { UsersRepository } from '../users/users.repository';
import { AuditService } from '../audit/audit.service';
import {
  PROJECT_CATEGORIES,
  STARTER_TASK_CONSTRAINTS,
  STARTER_TASK_TEMPLATES,
} from './config/starter-task-templates.config';

describe('Phase 28 Unit Tests: Starter Task Templates, Limits & Content Filter', () => {
  let templatesService: TemplatesService;
  let projectsService: ProjectsService;
  let projectsRepo: ProjectsRepository;
  let tasksService: TasksService;
  let tasksRepo: TasksRepository;
  let usersRepo: UsersRepository;
  let auditService: AuditService;
  let clockService: ClockService;
  let appRef: { close: () => Promise<void> };

  const mailMock = {
    onModuleInit: async () => {},
    initializeTransport: async () => {},
    sendPasswordResetEmail: async () => ({ success: true, mode: 'console' as const }),
    sendMail: async () => ({ success: true, mode: 'console' as const }),
    sendWarningEmail: async () => ({ success: true, mode: 'console' as const }),
    sendSuspensionEmail: async () => ({ success: true, mode: 'console' as const }),
  };

  beforeAll(async () => {
    process.env.SCHEDULER_ENABLED = 'false';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useValue(mailMock)
      .compile();

    const app = moduleRef.createNestApplication();
    await app.init();
    appRef = app;

    templatesService = app.get(TemplatesService);
    projectsService = app.get(ProjectsService);
    projectsRepo = app.get(ProjectsRepository);
    tasksService = app.get(TasksService);
    tasksRepo = app.get(TasksRepository);
    usersRepo = app.get(UsersRepository);
    auditService = app.get(AuditService);
    clockService = app.get(ClockService);
  });

  beforeEach(() => {
    usersRepo.reset();
    projectsRepo.reset();
    tasksRepo.reset();
    clockService.setTime('2026-11-12T10:00:00.000Z');
  });

  afterAll(async () => {
    await appRef?.close();
  });

  it('1. Config defines 3 to 6 valid starter tasks per category and General fallback works', () => {
    expect(PROJECT_CATEGORIES).toContain('General');
    for (const category of PROJECT_CATEGORIES) {
      const items = STARTER_TASK_TEMPLATES[category];
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThanOrEqual(STARTER_TASK_CONSTRAINTS.minTemplatesPerCategory);
      expect(items.length).toBeLessThanOrEqual(STARTER_TASK_CONSTRAINTS.maxTemplatesPerCategory);

      for (const item of items) {
        expect(item.key.length).toBeGreaterThanOrEqual(3);
        expect(item.title.length).toBeGreaterThanOrEqual(STARTER_TASK_CONSTRAINTS.minTitleLength);
        expect(item.title.length).toBeLessThanOrEqual(STARTER_TASK_CONSTRAINTS.maxTitleLength);
        expect(item.description.length).toBeGreaterThanOrEqual(STARTER_TASK_CONSTRAINTS.minDescriptionLength);
        expect(item.description.length).toBeLessThanOrEqual(STARTER_TASK_CONSTRAINTS.maxDescriptionLength);
        expect(['small', 'medium', 'large']).toContain(item.effort);
      }
    }

    const webRes = templatesService.getForCategory('web app');
    expect(webRes.category).toBe('Web App');
    expect(webRes.items.length).toBeGreaterThanOrEqual(3);

    const aiAlias = templatesService.getForCategory('Data and AI');
    expect(aiAlias.category).toBe('Data & AI');

    const fallbackUnknown = templatesService.getForCategory('Astrophysics Rocketry');
    expect(fallbackUnknown.category).toBe('General');
    expect(fallbackUnknown.items.length).toBeGreaterThanOrEqual(3);
  });

  it('2. Apply creates chosen tasks as Open and unassigned and skips duplicate titles', async () => {
    const proj = projectsService.create('1', {
      title: 'Starter Task App Workspace',
      description: 'Building a modern collaborative web application with React and NestJS modules to verify starter task template workflows cleanly.',
      category: 'Web App',
      dueDate: '2027-06-01T00:00:00.000Z',
    });

    const { items } = templatesService.getForCategory('Web App');
    const selectedKeys = [items[0].key, items[1].key];

    const firstApply = await templatesService.applyTemplatesForProject(
      proj.id,
      { uid: '1', id: '1', role: 'Project Owner' },
      'Project Owner',
      { keys: selectedKeys },
    );

    expect(firstApply.created).toHaveLength(2);
    expect(firstApply.skipped).toHaveLength(0);
    for (const task of firstApply.created) {
      expect(task.projectId).toBe(proj.id);
      expect(task.status).toBe(TaskStatus.ToDo);
      expect(task.assigneeId).toBeUndefined();
      expect(task.assigneeName).toBe('Unassigned');
    }

    // Re-applying item 0 + new item 2 skips item 0 with TEMPLATE_TASK_EXISTS while still adding item 2
    const secondApply = await templatesService.applyTemplatesForProject(
      proj.id,
      { uid: '1', id: '1', role: 'Project Owner' },
      'Project Owner',
      { keys: [items[0].key, items[2].key] },
    );

    expect(secondApply.created).toHaveLength(1);
    expect(secondApply.created[0].title).toBe(items[2].title);
    expect(secondApply.skipped).toHaveLength(1);
    expect(secondApply.skipped[0].key).toBe(items[0].key);
    expect(secondApply.skipped[0].code).toBe('TEMPLATE_TASK_EXISTS');

    const auditEntry = auditService.findAll().find((a) => a.action === 'TEMPLATE_TASKS_ADDED');
    expect(auditEntry).toBeDefined();
    expect(auditEntry?.details?.addedCount).toBe(1);
  });

  it('3. Enforces 30-task cap per project (409 TASK_LIMIT_REACHED) on direct and starter task creation', async () => {
    const proj = projectsService.create('1', {
      title: 'Task Cap Verification Project',
      description: 'Project configured specifically to test the thirty-task limit across normal creation and starter templates.',
      category: 'Web App',
      dueDate: '2027-06-01T00:00:00.000Z',
    });

    // Create 28 tasks directly
    for (let i = 1; i <= 28; i++) {
      tasksService.create({
        projectId: proj.id,
        title: `Existing Milestone Task ${i}`,
        description: `Pre-existing project task number ${i} with full details.`,
        status: TaskStatus.ToDo,
        dueDate: '2027-05-01T00:00:00.000Z',
        priority: 'Medium',
      });
    }

    // Applying 4 Web App starter tasks creates 2 (total = 30) and skips the remaining 2 with TASK_LIMIT_REACHED
    const { items } = templatesService.getForCategory('Web App');
    const applyRes = await templatesService.applyTemplatesForProject(
      proj.id,
      { uid: '1', id: '1', role: 'Project Owner' },
      'Project Owner',
      { keys: items.slice(0, 4).map((x) => x.key) },
    );

    expect(applyRes.created).toHaveLength(2);
    expect(applyRes.skipped).toHaveLength(2);
    expect(applyRes.skipped.every((s) => s.code === 'TASK_LIMIT_REACHED')).toBe(true);
    expect(tasksService.findAllByProjectId(proj.id)).toHaveLength(30);

    // Direct 31st task via TasksService throws 409 TASK_LIMIT_REACHED
    try {
      tasksService.create({
        projectId: proj.id,
        title: 'Task Thirty One Overflow',
        description: 'Should fail cleanly with TASK_LIMIT_REACHED.',
        status: TaskStatus.ToDo,
        dueDate: '2027-05-01T00:00:00.000Z',
      });
      fail('Expected ConflictException TASK_LIMIT_REACHED');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getResponse().code).toBe('TASK_LIMIT_REACHED');
    }
  });

  it('4. Overrides run through content filter and one bad item does not block valid siblings', async () => {
    const proj = projectsService.create('1', {
      title: 'Override Content Filter Test',
      description: 'Ensure inline edited starter task overrides run through content filter without aborting clean siblings.',
      category: 'General',
      dueDate: '2027-06-01T00:00:00.000Z',
    });

    const { items } = templatesService.getForCategory('General');
    const res = await templatesService.applyTemplatesForProject(
      proj.id,
      { uid: '1', id: '1', role: 'Project Owner' },
      'Project Owner',
      {
        keys: [items[0].key, items[1].key, 'missing-key-99'],
        overrides: {
          [items[0].key]: {
            title: 'Set up clean fuck repository',
            description: 'This custom description tries sneaking a blocked word.',
          },
          [items[1].key]: {
            title: 'Plan first two sprint milestones',
            description: 'Clean edited description explaining milestone plan cleanly.',
          },
        },
      },
    );

    expect(res.created).toHaveLength(1);
    expect(res.created[0].title).toBe('Plan first two sprint milestones');
    expect(res.skipped).toHaveLength(2);

    const blockedSkip = res.skipped.find((s) => s.key === items[0].key);
    expect(blockedSkip?.code).toBe('CONTENT_NOT_ALLOWED');
    expect(blockedSkip?.reason.toLowerCase()).not.toContain('fuck');

    const unknownSkip = res.skipped.find((s) => s.key === 'missing-key-99');
    expect(unknownSkip?.code).toBe('UNKNOWN_TEMPLATE_KEY');
  });
});
