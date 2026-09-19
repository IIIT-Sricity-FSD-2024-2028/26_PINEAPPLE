import { Injectable } from '@nestjs/common';
import { CreateTaskDto, TaskStatus } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  xpReward: number;
  status: TaskStatus;
  assigneeId?: string;
}

@Injectable()
export class TasksRepository {
  private tasks: Task[] = [];

  constructor() {
    // Seed test data explicitly linked to 'proj-1' from Phase 4
    this.tasks.push({
      id: 'task-1',
      projectId: 'proj-1',
      title: 'Design Database Schema',
      description: 'Create the ERD and define the initial data structures.',
      xpReward: 50,
      status: TaskStatus.Completed,
      assigneeId: '2', // Arjun Sharma
    });

    this.tasks.push({
      id: 'task-2',
      projectId: 'proj-1',
      title: 'Implement Authentication',
      description: 'Setup JWT and Role Guards for security.',
      xpReward: 100,
      status: TaskStatus.InProgress,
      assigneeId: '2', 
    });

    this.tasks.push({
      id: 'task-3',
      projectId: 'proj-1',
      title: 'Create Dashboard UI',
      description: 'Build the React components for the user dashboard.',
      xpReward: 75,
      status: TaskStatus.ToDo,
    });

    this.tasks.push({
      id: 'task-4',
      projectId: 'proj-6',
      title: 'Write Smart Contracts',
      description: 'Implement secure voting logic in Solidity.',
      xpReward: 200,
      status: TaskStatus.InProgress,
      assigneeId: '8', // Vikram Nair
    });

    this.tasks.push({
      id: 'task-5',
      projectId: 'proj-6',
      title: 'Frontend Vue Integration',
      description: 'Connect Vue frontend with Web3.js.',
      xpReward: 150,
      status: TaskStatus.ToDo,
      assigneeId: '6', // Aditya Sai
    });

    this.tasks.push({
      id: 'task-6',
      projectId: 'proj-7',
      title: 'Data Collection & Cleaning',
      description: 'Scrape and clean climate data from public APIs.',
      xpReward: 100,
      status: TaskStatus.Completed,
      assigneeId: '6', // Aditya Sai
    });

    this.tasks.push({
      id: 'task-7',
      projectId: 'proj-7',
      title: 'Train ML Model',
      description: 'Train a TensorFlow model on cleaned dataset.',
      xpReward: 250,
      status: TaskStatus.InProgress,
      assigneeId: '7', // Neha Gupta
    });

    this.tasks.push({
      id: 'task-8',
      projectId: 'proj-8',
      title: 'Database Normalization',
      description: 'Optimize PostgreSQL schema for product catalog.',
      xpReward: 80,
      status: TaskStatus.Completed,
      assigneeId: '1', // Priya Patel
    });
  }

  findAllByProjectId(projectId: string): Task[] {
    return this.tasks.filter((task) => task.projectId === projectId);
  }

  findAll(): Task[] {
    return this.tasks;
  }

  findById(id: string): Task | undefined {
    return this.tasks.find((task) => task.id === id);
  }

  create(createTaskDto: CreateTaskDto): Task {
    const newTask: Task = {
      id: `task-${Date.now()}`,
      ...createTaskDto,
      status: createTaskDto.status || TaskStatus.ToDo,
    };
    this.tasks.push(newTask);
    return newTask;
  }

  update(id: string, updateTaskDto: UpdateTaskDto): Task | undefined {
    const index = this.tasks.findIndex((task) => task.id === id);
    if (index === -1) {
      return undefined;
    }

    this.tasks[index] = {
      ...this.tasks[index],
      ...updateTaskDto,
    };

    return this.tasks[index];
  }

  delete(id: string): boolean {
    const initialLength = this.tasks.length;
    this.tasks = this.tasks.filter((task) => task.id !== id);
    return this.tasks.length < initialLength;
  }
}
