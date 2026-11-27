import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from './notifications.service';
import { JobsService } from '../jobs/jobs.service';
import { JobRunsService } from '../jobs/job-runs.service';
import { DataExportService } from '../users/data-export.service';
import { UsersRepository } from '../users/users.repository';
import { UsersService } from '../users/users.service';
import { ProjectsService } from '../projects/projects.service';
import { TasksService } from '../tasks/tasks.service';
import { TaskStatus } from '../tasks/dto/create-task.dto';
import { serializeSafeUser } from '../users/user-serializer';
import * as fs from 'fs';

describe('Notification Digest Removal Unit Tests', () => {
  let appRef: any;
  let notificationsService: NotificationsService;
  let jobsService: JobsService;
  let jobRunsService: JobRunsService;
  let dataExportService: DataExportService;
  let usersRepository: UsersRepository;
  let usersService: UsersService;
  let projectsService: ProjectsService;
  let tasksService: TasksService;

  const FORMER_DIGEST_TYPES = [
    'PROJECT_LIKE',
    'NEW_APPLICANT',
    'TASK_COMMENT',
    'TASK_ASSIGNED',
    'TASK_SUBMITTED',
    'TASK_APPROVED',
    'TASK_REJECTED',
    'TASKS_RELEASED',
    'TASK_RELEASED',
    'BADGE_AWARDED',
    'LEADERBOARD_RANK',
    'PROJECT_UPDATE',
    'PROJECT_PAUSED',
    'APPLICATION_APPROVED',
    'APPLICATION_REJECTED',
    'PROJECT_INVITE',
    'MENTOR_RECOMMENDATION',
    'NEW_MESSAGE',
    'PROJECT_COMPLETED',
    'PROJECT_MEMBERSHIP_ENDED',
    'TASK_REVIEW_REMINDER',
    'TASK_AUTO_APPROVED',
    'TASK_UNASSIGNED',
    'OWNER_INACTIVE',
    'OWNER_INACTIVE_30D',
    'MEMBER_INACTIVE',
    'REQUEST_TIMEOUT',
  ];

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.ALLOW_STORE_RESET = 'true';
    process.env.SCHEDULER_ENABLED = 'false';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useValue({
        sendMail: async () => ({ success: true, mode: 'console' }),
      })
      .compile();

    appRef = moduleRef.createNestApplication();
    await appRef.init();

    notificationsService = moduleRef.get(NotificationsService);
    jobsService = moduleRef.get(JobsService);
    jobRunsService = moduleRef.get(JobRunsService);
    dataExportService = moduleRef.get(DataExportService);
    usersRepository = moduleRef.get(UsersRepository);
    usersService = moduleRef.get(UsersService);
    projectsService = moduleRef.get(ProjectsService);
    tasksService = moduleRef.get(TasksService);
  });

  afterAll(async () => {
    if (appRef) await appRef.close();
  });

  it('delivers every former digest notification type immediately without buffering', () => {
    notificationsService.reset();

    for (const type of FORMER_DIGEST_TYPES) {
      const created: any = notificationsService.create({
        userId: '2',
        type,
        message: `Immediate delivery test for ${type}`,
        referenceId: 'proj-1',
      });
      expect(created.bufferedForDigest).toBeUndefined();
      expect(created.priority).toBeUndefined();
    }

    const userNotices = notificationsService.findByUser('2');
    for (const type of FORMER_DIGEST_TYPES) {
      expect(userNotices.some((n) => n.type === type && n.message === `Immediate delivery test for ${type}`)).toBe(true);
    }
    expect(userNotices.some((n) => n.type === 'DAILY_DIGEST')).toBe(false);
  });

  it('hourly job tick excludes flushNotificationDigests and still records job runs cleanly', async () => {
    const run = await jobsService.runTick('manual');
    const names = run.jobs.map((j) => j.name);
    expect(names).not.toContain('flushNotificationDigests');
    expect(run.jobs.length).toBeGreaterThan(10);
    expect(jobRunsService.list().length).toBeGreaterThanOrEqual(1);
  });

  it('grouped notifications (8 released tasks) still produce ONE immediate notification with count 8', () => {
    const project = projectsService.create('1', {
      title: 'Grouped Check Project',
      description: 'Collaborative engineering workspace created specifically to verify grouped TASK_RELEASED immediate notices after digest removal.',
      teamSize: 4,
      dueDate: '2027-06-01T00:00:00.000Z',
    });
    projectsService.addCollaborator(project.id, { id: '2', name: 'Arjun Sharma', role: 'Collaborator' });

    for (let i = 1; i <= 8; i++) {
      tasksService.create({
        projectId: project.id,
        title: `Task ${i}`,
        assigneeId: '2',
        assigneeName: 'Arjun Sharma',
        priority: 'Medium',
        status: TaskStatus.ToDo,
        dueDate: '2027-05-01T00:00:00.000Z',
      });
    }

    notificationsService.reset();
    projectsService.executeMemberDeparture(
      project.id,
      '2',
      ['Too busy'],
      'Need to focus on university exams this semester.',
      'system',
    );

    const released = notificationsService
      .findByUser('1')
      .filter((n) => n.type === 'TASK_RELEASED' && n.referenceId === project.id);
    expect(released).toHaveLength(1);
    expect(released[0].count).toBe(8);
    expect(released[0].items).toHaveLength(8);
  });

  it('user serializer and data export contain no digest fields', () => {
    const raw = usersRepository.findById('2')!;
    const serialized = serializeSafeUser(raw);
    expect(serialized.digestEnabled).toBeUndefined();
    expect(serialized.digestHour).toBeUndefined();
    expect(serialized.utcOffsetMinutes).toBeUndefined();

    const safeUser = usersService.findById('2');
    expect(safeUser.digestEnabled).toBeUndefined();
    expect(safeUser.digestHour).toBeUndefined();
    expect(safeUser.utcOffsetMinutes).toBeUndefined();

    const exp = (dataExportService as any).buildUserArchive('2', raw, new Date().toISOString());
    expect((exp.profile as any).digestEnabled).toBeUndefined();
    expect((exp.profile as any).digestHour).toBeUndefined();
    expect((exp.profile as any).utcOffsetMinutes).toBeUndefined();
  });

  it('removed DigestService and notification-priority config files no longer exist', () => {
    const srcRoot = `${process.cwd()}/src/notifications`;
    expect(fs.existsSync(`${srcRoot}/digest.service.ts`)).toBe(false);
    expect(fs.existsSync(`${srcRoot}/notification-priority.config.ts`)).toBe(false);
  });
});
