import { IsString, IsArray, IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ProjectDifficulty {
  Easy = 'Easy',
  Medium = 'Medium',
  Hard = 'Hard',
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

  @ApiProperty({ enum: ProjectDifficulty, example: ProjectDifficulty.Medium })
  @IsEnum(ProjectDifficulty)
  difficulty: ProjectDifficulty;

  @ApiProperty({ type: [String], example: ['React', 'Python', 'ML'] })
  @IsArray()
  @IsString({ each: true })
  requiredSkills: string[];

  @ApiProperty({ example: '3 Months' })
  @IsString()
  @IsNotEmpty()
  duration: string;
}
