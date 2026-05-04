import { IsString, IsEnum, IsNumber, IsNotEmpty, IsOptional } from 'class-validator';
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

  @ApiProperty({ example: 'Create the ERD and define the tables for the backend.' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 50, description: 'XP awarded upon completion' })
  @IsNumber()
  xpReward: number;

  @ApiPropertyOptional({ enum: TaskStatus, default: TaskStatus.ToDo })
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @ApiPropertyOptional({ example: '2' })
  @IsString()
  @IsOptional()
  assigneeId?: string;
}
