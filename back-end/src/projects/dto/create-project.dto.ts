import { IsString, IsArray, IsNotEmpty, IsOptional, IsNumber, IsBoolean, IsObject, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ProjectDifficulty {
  Easy = 'Easy',
  Medium = 'Medium',
  Hard = 'Hard',
  Beginner = 'Beginner',
  Intermediate = 'Intermediate',
  Advanced = 'Advanced',
}

export enum ProjectStatus {
  Open = 'Open',
  InProgress = 'In Progress',
  Completed = 'Completed',
  Closed = 'Closed',
}

export class CreateProjectDto {
  @ApiProperty({ example: 'AI Study Planner' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'An intelligent study scheduling app.' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ example: 'Key goals and deliverables' })
  @IsOptional()
  @IsString()
  objectives?: string;

  @ApiPropertyOptional({ enum: ProjectDifficulty, example: ProjectDifficulty.Medium })
  @IsOptional()
  @IsString()
  difficulty?: string;

  @ApiPropertyOptional({ type: [String], example: ['React', 'Python', 'ML'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredSkills?: string[];

  @ApiPropertyOptional({ type: [String], example: ['React', 'Python', 'ML'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @ApiProperty({ example: '2027-01-15T00:00:00.000Z', description: 'Due date for the project' })
  @IsNotEmpty({ message: 'Project due date is required.' })
  @IsString()
  dueDate: string;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsNumber()
  maxCollaborators?: number;

  @ApiPropertyOptional({ example: 5, description: 'Target team size (cannot be below active member count)' })
  @IsOptional()
  @IsNumber()
  teamSize?: number;

  @ApiPropertyOptional({ example: false, description: 'Whether to shift open task deadlines forward on due date change' })
  @IsOptional()
  @IsBoolean()
  shiftTasks?: boolean;

  @ApiPropertyOptional({ example: 'Project Owner' })
  @IsOptional()
  @IsString()
  owner?: string;

  @ApiPropertyOptional({ example: '1' })
  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiPropertyOptional({ enum: ProjectStatus, example: ProjectStatus.Open })
  @IsOptional()
  @IsString()
  @IsIn(Object.values(ProjectStatus), {
    message: 'Invalid project status. Supported statuses are Open, In Progress, Completed, Closed.',
  })
  status?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  progress?: number;

  @ApiPropertyOptional({ type: [Object], example: [{ id: '1', name: 'User' }], required: false })
  @IsOptional()
  @IsArray()
  collaborators?: any[];

  @ApiPropertyOptional({ type: [Object], required: false })
  @IsOptional()
  @IsArray()
  tasks?: any[];

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;

  @ApiPropertyOptional({ example: '2026-03-01T00:00:00.000Z' })
  @IsOptional()
  completedAt?: Date | string;

  @ApiPropertyOptional({ example: 'https://github.com/example/repo' })
  @IsOptional()
  @IsString()
  finalLink?: string;

  @ApiPropertyOptional({ example: 'https://github.com/example/repo' })
  @IsOptional()
  @IsString()
  finishedLink?: string;

  @ApiPropertyOptional({ example: 'https://github.com/example/repo' })
  @IsOptional()
  @IsString()
  finalProjectUrl?: string;

  @ApiPropertyOptional({ example: 'https://github.com/example/repo' })
  @IsOptional()
  @IsString()
  projectLink?: string;

  @ApiPropertyOptional({ example: '7' })
  @IsOptional()
  mentorId?: string | null;

  @ApiPropertyOptional({ example: 'Neha Gupta' })
  @IsOptional()
  mentor?: any;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  removedUsers?: any[];

  @ApiPropertyOptional({ example: 'Web App', description: 'Project category for starter task templates' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ type: [String], example: ['web-repo-readme', 'web-main-screens'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  starterTaskKeys?: string[];

  @ApiPropertyOptional({ description: 'Optional per-template overrides for title and description' })
  @IsOptional()
  @IsObject()
  starterTaskOverrides?: Record<string, { title?: string; description?: string }>;
}
