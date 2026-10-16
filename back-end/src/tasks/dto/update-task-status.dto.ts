import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for task status transitions.
 * Callers pass a canonical status value or accepted alias.
 *
 * Accepted status aliases (case-insensitive):
 *   • 'To Do'       ← 'Open', 'Todo', 'todo'
 *   • 'In Progress' ← 'in-progress'
 *   • 'In Review'   ← 'submitted'
 *   • 'Completed'   ← 'Approved', 'Done'
 */
export class UpdateTaskStatusDto {
  @ApiProperty({
    description:
      'Canonical status or any accepted alias (Open, Approved, Done, submitted, ...).',
    example: 'In Progress',
  })
  @IsNotEmpty()
  @IsString()
  status!: string;

  @ApiPropertyOptional({ example: 'https://github.com/pr/1' })
  @IsOptional()
  @IsString()
  proofLink?: string;

  @ApiPropertyOptional({ example: 'https://github.com/pr/1' })
  @IsOptional()
  @IsString()
  proofUrl?: string;

  @ApiPropertyOptional({ example: 'Notes on submission' })
  @IsOptional()
  @IsString()
  notes?: string;
}
