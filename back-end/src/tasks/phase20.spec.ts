import { jest } from '@jest/globals';
import { ProjectAccessService } from '../projects/project-access.service';
import { TasksService } from './tasks.service';
import { TaskStatus } from './dto/create-task.dto';
import { ContentFilterService } from '../common/services/content-filter.service';
import {
  detectMagicFileType,
  validateMagicBytesBuffer,
  getUploadServeMetadata,
} from '../uploads/file-validation.util';

describe('Phase 20: Resource Authorization, Content Filter & Magic Bytes (Unit)', () => {
  describe('ProjectAccessService', () => {
    const sampleProject = {
      id: 'proj-a',
      ownerId: 'owner-1',
      owner: 'Owner One',
      collaborators: [{ id: 'collab-1', userId: 'collab-1', name: 'Collab One' }],
      mentorId: 'mentor-1',
      removedUsers: [{ userId: 'removed-1', removedAt: '2026-01-01T00:00:00.000Z' }],
    };

    const mockProjectsRepo: any = {
      findById: jest.fn((id: string) => (id === 'proj-a' ? sampleProject : undefined)),
    };

    const mockAudit: any = {
      log: jest.fn(),
    };

    let accessService: ProjectAccessService;

    beforeEach(() => {
      mockAudit.log.mockClear();
      accessService = new ProjectAccessService(mockProjectsRepo, mockAudit);
    });

    it('identifies project owner and active members accurately', () => {
      expect(accessService.isOwner({ uid: 'owner-1' }, 'proj-a')).toBe(true);
      expect(accessService.isOwner({ uid: 'collab-1' }, 'proj-a')).toBe(false);

      expect(accessService.isMember({ uid: 'owner-1' }, 'proj-a')).toBe(true);
      expect(accessService.isMember({ uid: 'collab-1' }, 'proj-a')).toBe(true);
      expect(accessService.isMember({ uid: 'mentor-1' }, 'proj-a')).toBe(true);
      expect(accessService.isMember({ uid: 'outsider-9' }, 'proj-a')).toBe(false);
    });

    it('rejects outsiders on assertMemberOrOwner with 403 NOT_A_PROJECT_MEMBER and logs ACCESS_DENIED_TASK', () => {
      try {
        accessService.assertMemberOrOwner(
          { uid: 'outsider-9', role: 'Collaborator' },
          'proj-a',
          { taskId: 'task-1', action: 'comment_task' },
        );
        fail('Expected ForbiddenException');
      } catch (err: any) {
        const resp = err.getResponse();
        expect(resp.code).toBe('NOT_A_PROJECT_MEMBER');
        expect(err.getStatus()).toBe(403);
      }

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ACCESS_DENIED_TASK',
          details: expect.objectContaining({
            userId: 'outsider-9',
            projectId: 'proj-a',
            taskId: 'task-1',
          }),
        }),
      );
    });

    it('allows project owner, admin, and superuser through assertOwnerOrAdmin while blocking non-owner collaborator', () => {
      expect(accessService.assertOwnerOrAdmin({ uid: 'owner-1', role: 'Project Owner' }, 'proj-a')).toBe(sampleProject);
      expect(accessService.assertOwnerOrAdmin({ uid: 'adm-1', role: 'admin' }, 'proj-a')).toBe(sampleProject);
      expect(accessService.assertOwnerOrAdmin({ uid: 'su-1', role: 'superuser' }, 'proj-a')).toBe(sampleProject);

      try {
        accessService.assertOwnerOrAdmin({ uid: 'collab-1', role: 'Collaborator' }, 'proj-a', {
          taskId: 'task-9',
          action: 'delete_task',
        });
        fail('Expected ForbiddenException');
      } catch (err: any) {
        expect(err.getStatus()).toBe(403);
        expect(mockAudit.log).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'ACCESS_DENIED_TASK',
            details: expect.objectContaining({
              userId: 'collab-1',
              taskId: 'task-9',
              projectId: 'proj-a',
            }),
          }),
        );
      }
    });
  });

  describe('Magic-bytes & upload file verification', () => {
    const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    const validJpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const validWebp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP')]);
    const validPdf = Buffer.from('%PDF-1.4\n%test');

    it('accepts authentic PNG, JPG, WEBP, and PDF buffers', () => {
      expect(detectMagicFileType(validPng)).toBe('png');
      expect(detectMagicFileType(validJpg)).toBe('jpeg');
      expect(detectMagicFileType(validWebp)).toBe('webp');
      expect(detectMagicFileType(validPdf)).toBe('pdf');

      expect(
        validateMagicBytesBuffer(validPng, { originalName: 'avatar.png', mimetype: 'image/png' }).valid,
      ).toBe(true);
      expect(
        validateMagicBytesBuffer(validJpg, { originalName: 'photo.jpg', mimetype: 'image/jpeg' }).valid,
      ).toBe(true);
      expect(
        validateMagicBytesBuffer(validWebp, { originalName: 'pic.webp', mimetype: 'image/webp' }).valid,
      ).toBe(true);
      expect(
        validateMagicBytesBuffer(validPdf, { originalName: 'proof.pdf', mimetype: 'application/pdf' }).valid,
      ).toBe(true);
    });

    it('rejects text disguised as .png, SVG files, renamed SVG, and empty files', () => {
      const fakeTextPng = validateMagicBytesBuffer(Buffer.from('hello plain text disguised as image'), {
        originalName: 'evil.png',
        mimetype: 'image/png',
      });
      expect(fakeTextPng.valid).toBe(false);

      const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
      expect(
        validateMagicBytesBuffer(svgBuffer, { originalName: 'icon.svg', mimetype: 'image/svg+xml' }).valid,
      ).toBe(false);
      expect(
        validateMagicBytesBuffer(svgBuffer, { originalName: 'disguised.png', mimetype: 'image/png' }).valid,
      ).toBe(false);

      const emptyFile = validateMagicBytesBuffer(Buffer.alloc(0), {
        originalName: 'empty.png',
        mimetype: 'image/png',
      });
      expect(emptyFile.valid).toBe(false);
    });

    it('blocks SVG serving and enforces attachment disposition on PDFs and non-images', () => {
      expect(getUploadServeMetadata('legacy-avatar.svg').allowed).toBe(false);
      const pdfMeta = getUploadServeMetadata('proof.pdf');
      expect(pdfMeta.allowed).toBe(true);
      expect(pdfMeta.asAttachment).toBe(true);
      expect(pdfMeta.contentType).toBe('application/pdf');

      const pngMeta = getUploadServeMetadata('avatar.png');
      expect(pngMeta.allowed).toBe(true);
      expect(pngMeta.asAttachment).toBe(false);
      expect(pngMeta.contentType).toBe('image/png');
    });
  });

  describe('TasksService initial-status rule & ContentFilter', () => {
    const contentFilter = new ContentFilterService();
    const mockRepo: any = {
      create: jest.fn((data: any) => ({ id: 'task-unit-1', ...(data || {}) })),
      findById: jest.fn(() => ({
        id: 'task-unit-1',
        projectId: 'proj-a',
        title: 'Clean title',
        status: TaskStatus.ToDo,
      })),
      update: jest.fn((_id: any, data: any) => ({
        id: 'task-unit-1',
        projectId: 'proj-a',
        title: 'Clean title',
        ...(data || {}),
      })),
    };
    const mockProjectsService: any = {
      isLocked: () => false,
      findById: () => ({ id: 'proj-a', ownerId: 'owner-1', collaborators: [], dueDate: '2029-12-31' }),
      findRawById: () => ({ id: 'proj-a', ownerId: 'owner-1', collaborators: [], dueDate: '2029-12-31' }),
      recalculateAndPersistProgress: jest.fn(),
    };
    const mockUsersService: any = {
      findUserSafe: () => ({ id: 'owner-1', name: 'Owner One' }),
      findAll: () => [],
    };
    const mockPlatformConfig: any = {
      getConfig: () => ({}),
    };
    const mockAudit: any = { log: jest.fn() };
    const mockNotifications: any = { create: jest.fn() };
    const mockGamification: any = { hasEntryForTask: () => false };

    let tasksService: TasksService;

    beforeEach(() => {
      tasksService = new TasksService(
        mockRepo,
        mockGamification,
        mockProjectsService,
        mockUsersService,
        mockAudit,
        mockPlatformConfig,
        mockNotifications,
        undefined,
        undefined,
        contentFilter,
      );
    });

    it('rejects non-Open initial statuses when enforceInitialStatus is true with 400 INVALID_INITIAL_STATUS', () => {
      try {
        tasksService.create(
          {
            projectId: 'proj-a',
            title: 'Auto approved hack',
            dueDate: '2029-05-01',
            status: 'In Review',
          },
          'owner-1',
          'Project Owner',
          { enforceInitialStatus: true },
        );
        fail('Expected BadRequestException');
      } catch (err: any) {
        expect(err.getStatus()).toBe(400);
        expect(err.getResponse().code).toBe('INVALID_INITIAL_STATUS');
      }
    });

    it('accepts Open/To Do initial statuses and filters profanity without echoing banned word', () => {
      const created = tasksService.create(
        {
          projectId: 'proj-a',
          title: 'Build unit test coverage',
          description: 'Clean requirement',
          dueDate: '2029-05-01',
          status: 'Open',
        },
        'owner-1',
        'Project Owner',
        { enforceInitialStatus: true },
      );
      expect(created.status).toBe(TaskStatus.ToDo);

      try {
        tasksService.create(
          {
            projectId: 'proj-a',
            title: 'Total fuckery task',
            dueDate: '2029-05-01',
          },
          'owner-1',
          'Project Owner',
          { enforceInitialStatus: true },
        );
        fail('Expected Content Filter rejection');
      } catch (err: any) {
        expect(err.getStatus()).toBe(400);
        const body = err.getResponse();
        expect(body.code).toBe('CONTENT_NOT_ALLOWED');
        expect(JSON.stringify(body).toLowerCase()).not.toContain('fuck');
      }

      try {
        tasksService.addComment('task-unit-1', 'You are a fuckface', 'owner-1');
        fail('Expected Content Filter rejection on comment');
      } catch (err: any) {
        expect(err.getStatus()).toBe(400);
        const body = err.getResponse();
        expect(body.code).toBe('CONTENT_NOT_ALLOWED');
        expect(JSON.stringify(body).toLowerCase()).not.toContain('fuck');
      }
    });
  });
});
