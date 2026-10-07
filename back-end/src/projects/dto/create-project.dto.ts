import { IsString, IsArray, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';
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

  @ApiPropertyOptional({ example: '3 Months' })
  @IsOptional()
  @IsString()
  duration?: string;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsNumber()
  maxCollaborators?: number;

  @ApiPropertyOptional({ example: 'Project Owner' })
  @IsOptional()
  @IsString()
  owner?: string;

  @ApiPropertyOptional({ example: '1' })
  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiPropertyOptional({ example: 'Open' })
  @IsOptional()
  @IsString()
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
}
