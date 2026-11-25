import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export const LEAVE_CATEGORIES = [
  'Too busy',
  'Project not as described',
  'Conflict with the team',
  'Personal reasons',
  'Other',
] as const;

export type LeaveCategory = (typeof LEAVE_CATEGORIES)[number];

export class LeaveProjectDto {
  @ApiProperty({
    description: 'Category reason for leaving the project',
    enum: LEAVE_CATEGORIES,
    example: 'Too busy',
  })
  @IsNotEmpty({ message: 'A leave category is required.' })
  @IsString()
  @IsIn(LEAVE_CATEGORIES, {
    message: 'Category must be one of: Too busy, Project not as described, Conflict with the team, Personal reasons, Other',
  })
  category!: LeaveCategory;

  @ApiProperty({
    description: 'Written explanation for leaving (10 to 500 characters)',
    example: 'Due to unexpected academic coursework load, I am unable to commit to tasks.',
    minLength: 10,
    maxLength: 500,
  })
  @IsNotEmpty({ message: 'An explanation of at least 10 characters is required.' })
  @IsString()
  @MinLength(10, { message: 'Explanation must be at least 10 characters long.' })
  @MaxLength(500, { message: 'Explanation cannot exceed 500 characters.' })
  reason!: string;
}
