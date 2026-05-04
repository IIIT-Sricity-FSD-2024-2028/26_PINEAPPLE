import { NotFoundException } from '@nestjs/common';
import { TasksService } from './tasks.service';

describe('TasksService', () => {
  let service: TasksService;

  beforeEach(() => {
    service = new TasksService();
    service.onModuleInit();
  });

  it('should create a new task', () => {
    const taskData = {
      title: 'Test Task',
      description: 'A test task.',
      assignedTo: 'test@teamforge.local',
      status: 'pending',
      proofLink: undefined,
      due: '2026-07-01',
      priority: 'Low',
      projectId: 'project-1',
      points: 5,
    };

    const created = service.create(taskData as any);

    expect(created.id).toBeDefined();
    expect(created.title).toBe('Test Task');
    expect(created.assignee).toBe('test@teamforge.local');
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(created.updatedAt).toBeInstanceOf(Date);
  });

  it('should find a task by id', () => {
    const existing = service.findAll()[0];
    const result = service.findOne(existing.id);

    expect(result).toBeDefined();
    expect(result.id).toBe(existing.id);
    expect(result.title).toBe(existing.title);
  });

  it('should throw NotFoundException when finding a missing task', () => {
    expect(() => service.findOne('missing-task-id')).toThrow(NotFoundException);
  });

  it('should filter tasks by projectId', () => {
    const projectTasks = service.findByProject('project-1');

    expect(projectTasks).toHaveLength(1);
    expect(projectTasks[0].projectId).toBe('project-1');
  });

  it('should update an existing task', () => {
    const existing = service.findAll()[0];
    const updateData = {
      title: 'Updated Task Title',
      assignedTo: 'new.assignee@teamforge.local',
    };

    const updated = service.update(existing.id, updateData as any);

    expect(updated.id).toBe(existing.id);
    expect(updated.title).toBe('Updated Task Title');
    expect(updated.assignedTo).toBe('new.assignee@teamforge.local');
    expect(updated.assignee).toBe('new.assignee@teamforge.local');
    expect(updated.updatedAt).toBeInstanceOf(Date);
    expect(updated.updatedAt.getTime()).toBeGreaterThan(existing.updatedAt.getTime());
  });

  it('should delete an existing task', () => {
    const existing = service.findAll()[0];
    const initialCount = service.findAll().length;

    service.remove(existing.id);

    expect(service.findAll()).toHaveLength(initialCount - 1);
    expect(() => service.findOne(existing.id)).toThrow(NotFoundException);
  });
});
