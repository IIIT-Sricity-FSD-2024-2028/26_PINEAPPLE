import { NotFoundException } from '@nestjs/common';
import { ProjectsService } from './projects.service';

describe('ProjectsService', () => {
  let service: ProjectsService;

  beforeEach(() => {
    service = new ProjectsService();
    service.onModuleInit();
  });

  it('should create a new project', () => {
    const projectData = {
      name: 'Test Project',
      desc: 'A test project.',
      skills: ['NestJS', 'TypeScript'],
      progress: 0,
      collaborators: 1,
      owner: 'test@teamforge.local',
      members: [{ name: 'Test User', initials: 'TU', role: 'Owner' }],
      status: 'open',
      tasks: [
        {
          title: 'Initial task',
          description: 'Task description',
          assignedTo: 'test@teamforge.local',
          status: 'pending',
          proofLink: undefined,
          due: '2026-07-01',
          priority: 'Low',
        },
      ],
      requests: [
        {
          userId: 'user-test',
          userName: 'Test User',
          message: 'Please join',
        },
      ],
      invites: ['invitee@teamforge.local'],
    };

    const created = service.create(projectData as any);

    expect(created.id).toBeDefined();
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(created.updatedAt).toBeInstanceOf(Date);
    expect(created.owner).toBe('test@teamforge.local');
    expect(created.tasks).toHaveLength(1);
    expect(created.tasks[0].id).toMatch(/^task-/);
    expect(created.requests).toHaveLength(1);
    expect(created.requests[0].status).toBe('pending');
  });

  it('should find a project by id', () => {
    const existing = service.findAll()[0];
    const result = service.findOne(existing.id);

    expect(result).toBeDefined();
    expect(result.id).toBe(existing.id);
    expect(result.name).toBe(existing.name);
  });

  it('should throw NotFoundException when finding a missing project', () => {
    expect(() => service.findOne('missing-id')).toThrow(NotFoundException);
  });

  it('should filter projects by owner', () => {
    const ownerProjects = service.findByOwner('dev.raj@teamforge.local');

    expect(ownerProjects).toHaveLength(1);
    expect(ownerProjects[0].owner).toBe('dev.raj@teamforge.local');
  });

  it('should update an existing project', () => {
    const existing = service.findAll()[0];
    const updateData = {
      name: 'Updated Project Name',
      status: 'completed',
    };

    const updated = service.update(existing.id, updateData as any);

    expect(updated.id).toBe(existing.id);
    expect(updated.name).toBe('Updated Project Name');
    expect(updated.status).toBe('completed');
    expect(updated.updatedAt).toBeInstanceOf(Date);
    expect(updated.updatedAt.getTime()).toBeGreaterThan(existing.updatedAt.getTime());
  });

  it('should delete an existing project', () => {
    const existing = service.findAll()[0];
    const initialCount = service.findAll().length;

    service.remove(existing.id);

    expect(service.findAll()).toHaveLength(initialCount - 1);
    expect(() => service.findOne(existing.id)).toThrow(NotFoundException);
  });
});
