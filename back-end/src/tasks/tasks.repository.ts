import { Injectable } from '@nestjs/common';
import { CreateTaskDto, TaskStatus } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  xpReward?: number;
  status: TaskStatus | string;
  assigneeId?: string;
  assigneeName?: string;
  assignee?: string;
  assignedTo?: string;
  difficulty?: string;
  priority?: string;
  effort?: string;
  starterTemplateKey?: string;
  proofLink?: string;
  proofUrl?: string;
  notes?: string;
  xpAwarded?: boolean;
  awardedXp?: number;
  awardedRep?: number;
  dueDate?: string;
  isOverdue?: boolean;
  assigneeRole?: string;
  penaltyAppliedAt?: string;
  rejectionReason?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionHistory?: Array<{ reason: string; at: string; by: string }>;
  autoApproved?: boolean;
  reviewReminderSentAt?: string;
  inReviewSince?: string;
  assignedAt?: string;
  approvedAt?: string;
  submittedAt?: string;
  dueDateHistory?: Array<{
    previousDueDate: string;
    newDueDate: string;
    creditMs?: number;
    reason: string;
    at: string;
    extendedProject?: boolean;
  }>;
  lastCreditedSubmissionAt?: string;
  cumulativeReviewCreditMs?: number;
  dueSoonNotifiedAt?: string;
  overdueNotifiedAt?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

@Injectable()
export class TasksRepository {
  private tasks: Task[] = [];
  private tasksById = new Map<string, Task>();
  private tasksByProjectId = new Map<string, Task[]>();

  private indexTask(t: Task): void {
    if (!t) return;
    this.tasksById.set(String(t.id), t);
    const pid = String(t.projectId);
    if (!this.tasksByProjectId.has(pid)) {
      this.tasksByProjectId.set(pid, []);
    }
    const list = this.tasksByProjectId.get(pid)!;
    const existingIdx = list.findIndex((item) => String(item.id) === String(t.id));
    if (existingIdx !== -1) {
      list[existingIdx] = t;
    } else {
      list.push(t);
    }
  }

  private rebuildIndexes(): void {
    this.tasksById.clear();
    this.tasksByProjectId.clear();
    for (const t of this.tasks) {
      this.indexTask(t);
    }
  }

  constructor() {
    this.initSeeds();
  }

  private initSeeds(): void {
    // Seed test data explicitly linked to 'proj-1' from Phase 4
    this.tasks.push({
      id: 'task-1',
      projectId: 'proj-1',
      title: 'Design Database Schema',
      description: 'Create the ERD and define the initial data structures.',
      xpReward: 50,
      status: TaskStatus.Completed,
      assigneeId: '2',
      assigneeName: 'Arjun Sharma',
      assignee: 'Arjun Sharma',
      assignedTo: 'Arjun Sharma',
      dueDate: '2026-03-01T00:00:00.000Z',
      assignedAt: '2025-01-02T00:00:00.000Z',
      approvedAt: '2025-01-03T00:00:00.000Z',
      xpAwarded: true,
      awardedXp: 50,
      awardedRep: 8,
    });

    this.tasks.push({
      id: 'task-2',
      projectId: 'proj-1',
      title: 'Implement Authentication',
      description: 'Setup JWT and Role Guards for security.',
      xpReward: 100,
      status: TaskStatus.InProgress,
      assigneeId: '2',
      assigneeName: 'Arjun Sharma',
      assignee: 'Arjun Sharma',
      assignedTo: 'Arjun Sharma',
      assignedAt: '2025-01-02T00:00:00.000Z',
      dueDate: '2027-01-20T00:00:00.000Z',
    });

    this.tasks.push({
      id: 'task-3',
      projectId: 'proj-1',
      title: 'Create Dashboard UI',
      description: 'Build the React components for the user dashboard.',
      xpReward: 75,
      status: TaskStatus.ToDo,
      dueDate: '2026-10-01T00:00:00.000Z',
      assigneeName: 'Unassigned',
      assignee: 'Unassigned',
    });

    this.tasks.push({
      id: 'task-4',
      projectId: 'proj-6',
      title: 'Write Smart Contracts',
      description: 'Implement secure voting logic in Solidity.',
      xpReward: 200,
      status: TaskStatus.InProgress,
      assigneeId: '8', // Vikram Nair
      assigneeName: 'Vikram Nair',
      assignee: 'Vikram Nair',
      assignedTo: 'Vikram Nair',
      assignedAt: '2025-01-02T00:00:00.000Z',
      dueDate: '2027-02-15T00:00:00.000Z',
    });

    this.tasks.push({
      id: 'task-5',
      projectId: 'proj-6',
      title: 'Frontend Vue Integration',
      description: 'Connect Vue frontend with Web3.js.',
      xpReward: 150,
      status: TaskStatus.ToDo,
      assigneeId: '6', // Aditya Sai
      assigneeName: 'Aditya Sai',
      assignee: 'Aditya Sai',
      assignedTo: 'Aditya Sai',
      assignedAt: '2025-01-02T00:00:00.000Z',
      dueDate: '2026-03-01T00:00:00.000Z',
      xpAwarded: true,
      awardedXp: 100,
      awardedRep: 8,
    });

    this.tasks.push({
      id: 'task-6',
      projectId: 'proj-7',
      title: 'Data Collection & Cleaning',
      description: 'Scrape and clean climate data from public APIs.',
      xpReward: 100,
      status: TaskStatus.Completed,
      assigneeId: '6', // Aditya Sai
      assigneeName: 'Aditya Sai',
      assignee: 'Aditya Sai',
      assignedTo: 'Aditya Sai',
      assignedAt: '2025-01-02T00:00:00.000Z',
      approvedAt: '2025-01-03T00:00:00.000Z',
    });

    this.tasks.push({
      id: 'task-7',
      projectId: 'proj-7',
      title: 'Train ML Model',
      description: 'Train a TensorFlow model on cleaned dataset.',
      xpReward: 250,
      status: TaskStatus.InProgress,
      assigneeId: '7', // Neha Gupta
      assigneeName: 'Neha Gupta',
      assignee: 'Neha Gupta',
      assignedTo: 'Neha Gupta',
      assignedAt: '2025-01-02T00:00:00.000Z',
      dueDate: '2027-03-01T00:00:00.000Z',
    });
    this.rebuildIndexes();
  }

  findAllByProjectId(projectId: string): Task[] {
    const list = this.tasksByProjectId.get(String(projectId));
    if (list) return list;
    return this.tasks.filter((task) => task.projectId === projectId);
  }

  findAll(): Task[] {
    return this.tasks;
  }

  findById(id: string): Task | undefined {
    return this.tasksById.get(String(id)) || this.tasks.find((task) => task.id === id);
  }

  create(createTaskDto: CreateTaskDto): Task {
    const newTask: Task = {
      id: `task-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      ...createTaskDto,
      priority: createTaskDto.priority || createTaskDto.difficulty || 'Medium',
      proofLink: createTaskDto.proofLink || createTaskDto.proofUrl,
      proofUrl: createTaskDto.proofUrl || createTaskDto.proofLink,
      status: createTaskDto.status || TaskStatus.ToDo,
    };
    if (newTask.assigneeName && !newTask.assignee) {
      newTask.assignee = newTask.assigneeName;
    }
    if (newTask.assignee && !newTask.assigneeName) {
      newTask.assigneeName = newTask.assignee;
    }
    if (newTask.assignee && !newTask.assignedTo) {
      newTask.assignedTo = newTask.assignee;
    }
    if (newTask.assigneeId && newTask.assigneeId.toLowerCase() !== 'unassigned' && !newTask.assignedAt) {
      newTask.assignedAt = new Date().toISOString();
    }
    this.tasks.push(newTask);
    this.indexTask(newTask);
    return newTask;
  }

  update(id: string, updateTaskDto: UpdateTaskDto): Task | undefined {
    const index = this.tasks.findIndex((task) => task.id === id);
    if (index === -1) {
      return undefined;
    }

    const updated: Task = {
      ...this.tasks[index],
      ...updateTaskDto,
    };

    if (updateTaskDto.assigneeId === undefined && 'assigneeId' in updateTaskDto) {
      delete updated.assigneeId;
    }
    if ((updateTaskDto as any).assignedAt === undefined && 'assignedAt' in updateTaskDto) {
      delete updated.assignedAt;
    }

    if (updated.assigneeName && !updated.assignee) {
      updated.assignee = updated.assigneeName;
    }
    if (updated.assignee && !updated.assigneeName) {
      updated.assigneeName = updated.assignee;
    }
    if (updated.assignee) {
      updated.assignedTo = updated.assignee;
    }

    this.tasks[index] = updated;
    this.indexTask(updated);

    return this.tasks[index];
  }

  delete(id: string): boolean {
    const initialLength = this.tasks.length;
    this.tasks = this.tasks.filter((task) => task.id !== id);
    const deleted = this.tasks.length < initialLength;
    if (deleted) {
      this.rebuildIndexes();
    }
    return deleted;
  }

  resetToSeed(): void {
    this.tasks = [];
    this.tasksById.clear();
    this.tasksByProjectId.clear();
    this.initSeeds();
  }

  reset(): void {
    if (process.env.NODE_ENV !== 'test' && !process.env.ALLOW_STORE_RESET) return;
    this.resetToSeed();
  }

  anonymizeUser(userId: string, originalName?: string): number {
    const uid = String(userId || '');
    const origLower = originalName ? originalName.trim().toLowerCase() : '';
    let count = 0;
    for (const task of this.tasks) {
      const matchesId = String(task.assigneeId || '') === uid;
      const matchesName =
        Boolean(origLower) &&
        ((task.assigneeName || '').trim().toLowerCase() === origLower ||
          (task.assignedTo || '').trim().toLowerCase() === origLower ||
          (task.assignee || '').trim().toLowerCase() === origLower);
      if (matchesId || matchesName) {
        task.assigneeName = 'Deleted user';
        task.assignedTo = 'Deleted user';
        task.assignee = 'Deleted user';
        (task as any).assigneeIsDeleted = true;
        count += 1;
      }
      if (task.rejectedBy && (String(task.rejectedBy) === uid || (origLower && task.rejectedBy.trim().toLowerCase() === origLower))) {
        task.rejectedBy = 'Deleted user';
      }
    }
    return count;
  }
}
