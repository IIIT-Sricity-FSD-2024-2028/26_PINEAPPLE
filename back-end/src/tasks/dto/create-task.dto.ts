import { IsString, IsNumber, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TaskStatus {
  ToDo = 'To Do',
  InProgress = 'In Progress',
  InReview = 'In Review',
  Completed = 'Completed',
}

export class CreateTaskDto {
  @ApiProperty({ example: 'proj-1' })
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @ApiProperty({ example: 'Design Database Schema' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: 'Create the ERD and define the tables for the backend.' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 50, description: 'XP awarded upon completion' })
  @IsNumber()
  @IsOptional()
  xpReward?: number;

  @ApiPropertyOptional({ enum: TaskStatus, default: TaskStatus.ToDo })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: '2' })
  @IsString()
  @IsOptional()
  assigneeId?: string;

  @ApiPropertyOptional({ example: 'Arjun Sharma' })
  @IsString()
  @IsOptional()
  assignee?: string;

  @ApiPropertyOptional({ example: 'Medium' })
  @IsString()
  @IsOptional()
  difficulty?: string;
}
