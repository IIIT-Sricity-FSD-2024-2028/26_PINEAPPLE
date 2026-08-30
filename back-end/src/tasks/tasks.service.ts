import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { TasksRepository, Task } from './tasks.repository';
import { CreateTaskDto, TaskStatus } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateTaskStatusDto, KanbanColumnKey } from './dto/update-task-status.dto';
import { GamificationService } from '../gamification/gamification.service';

/**
 * Maps a Kanban column key to the canonical TaskStatus.
 * Kept in the service (not the DTO) so the mapping stays a
 * single source of truth for the whole app.
 */
const COLUMN_TO_STATUS: Record<KanbanColumnKey, TaskStatus> = {
  todo: TaskStatus.ToDo,
  progress: TaskStatus.InProgress,
  review: TaskStatus.InReview,
  done: TaskStatus.Completed,
};

/**
 * Aliases accepted by the API so both the current
 * front-end vocabulary ('Open', 'Approved', ...) and the
 * canonical enum values keep working side-by-side.
 * Comparisons are case-insensitive.
 */
const STATUS_ALIASES: Record<string, TaskStatus> = {
  'to do': TaskStatus.ToDo,
  todo: TaskStatus.ToDo,
  open: TaskStatus.ToDo,
  'in progress': TaskStatus.InProgress,
  'in-progress': TaskStatus.InProgress,
  'in review': TaskStatus.InReview,
  submitted: TaskStatus.InReview,
  completed: TaskStatus.Completed,
  done: TaskStatus.Completed,
  approved: TaskStatus.Completed,
};

@Injectable()
export class TasksService {
  constructor(
    private readonly tasksRepository: TasksRepository,
    private readonly gamificationService: GamificationService,
  ) {}

  findAllByProjectId(projectId: string): Task[] {
    return this.tasksRepository.findAllByProjectId(projectId);
  }

  findAll(): Task[] {
    return this.tasksRepository.findAll();
  }

  findById(id: string): Task {
    const task = this.tasksRepository.findById(id);
    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found.`);
    }
    return task;
  }

  create(createTaskDto: CreateTaskDto): Task {
    return this.tasksRepository.create(createTaskDto);
  }

  update(id: string, updateTaskDto: UpdateTaskDto): Task {
    // 1. Fetch the existing task state so we can detect status changes
    const existingTask = this.findById(id);

    // 2. Execute the update in the repository
    const updatedTask = this.tasksRepository.update(id, updateTaskDto);
    if (!updatedTask) {
      throw new NotFoundException(`Task with ID ${id} not found.`);
    }

    // 3. Cross-Module Gamification Integration
    // Trigger XP reward if the task transitioned to 'Completed' just now
    if (
      updateTaskDto.status === TaskStatus.Completed &&
      existingTask.status !== TaskStatus.Completed
    ) {
      const targetAssigneeId = updatedTask.assigneeId || existingTask.assigneeId;

      if (targetAssigneeId) {
        this.gamificationService.awardXp(
          targetAssigneeId,
          updatedTask.xpReward,
          `Task Completed: ${updatedTask.title}`
        );
      }
    }

    return updatedTask;
  }

  /**
   * Kanban-friendly status update. Accepts either a Kanban `column`
   * key or a `status` string (aliases allowed). Delegates the actual
   * persistence & XP handling to {@link update} so gamification
   * behaviour and audit trails stay identical.
   *
   * @throws BadRequestException when neither `status` nor `column` are provided,
   *         or when the provided value is not recognisable.
   */
  updateStatus(id: string, payload: UpdateTaskStatusDto): Task {
    const normalised = this.normaliseIncomingStatus(payload);
    return this.update(id, { status: normalised } as UpdateTaskDto);
  }

  private normaliseIncomingStatus(payload: UpdateTaskStatusDto): TaskStatus {
    if (payload?.column) {
      const mapped = COLUMN_TO_STATUS[payload.column];
      if (mapped) return mapped;
    }
    if (payload?.status) {
      const key = payload.status.trim().toLowerCase();
      const mapped = STATUS_ALIASES[key];
      if (mapped) return mapped;
      // Also accept the raw enum values.
      const rawMatch = Object.values(TaskStatus).find(
        (value) => value.toLowerCase() === key,
      );
      if (rawMatch) return rawMatch as TaskStatus;
    }
    throw new BadRequestException(
      'Provide a valid `status` or Kanban `column` value.',
    );
  }

  delete(id: string): void {
    const isDeleted = this.tasksRepository.delete(id);
    if (!isDeleted) {
      throw new NotFoundException(`Task with ID ${id} not found.`);
    }
  }
}
