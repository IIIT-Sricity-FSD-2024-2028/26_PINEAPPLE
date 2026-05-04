import { Injectable, NotFoundException } from '@nestjs/common';
import { TasksRepository, Task } from './tasks.repository';
import { CreateTaskDto, TaskStatus } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { GamificationService } from '../gamification/gamification.service';

@Injectable()
export class TasksService {
  constructor(
    private readonly tasksRepository: TasksRepository,
    private readonly gamificationService: GamificationService,
  ) {}

  findAllByProjectId(projectId: string): Task[] {
    return this.tasksRepository.findAllByProjectId(projectId);
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

  delete(id: string): void {
    const isDeleted = this.tasksRepository.delete(id);
    if (!isDeleted) {
      throw new NotFoundException(`Task with ID ${id} not found.`);
    }
  }
}
