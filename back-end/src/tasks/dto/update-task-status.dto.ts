import { IsOptional, IsString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for the Kanban-board status transitions.
 * Callers may pass either:
 *   - `status`  — a canonical status value (or one of the accepted aliases), OR
 *   - `column`  — a Kanban column key: 'todo' | 'progress' | 'review' | 'done'
 *
 * Both are optional individually but at least one MUST be supplied. The
 * TasksService will normalise the incoming value onto the canonical
 * `TaskStatus` enum before persisting.
 *
 * Accepted status aliases (case-insensitive):
 *   • 'To Do'       ← 'Open', 'Todo', 'todo'
 *   • 'In Progress' ← 'in-progress'
 *   • 'In Review'   ← 'submitted'
 *   • 'Completed'   ← 'Approved', 'Done'
 */
export const KANBAN_COLUMN_KEYS = ['todo', 'progress', 'review', 'done'] as const;
export type KanbanColumnKey = (typeof KANBAN_COLUMN_KEYS)[number];

export class UpdateTaskStatusDto {
  @ApiPropertyOptional({
    description:
      'Canonical status or any accepted alias (Open, Approved, Done, submitted, ...).',
    example: 'In Progress',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Kanban column key. Alternative to `status`.',
    enum: KANBAN_COLUMN_KEYS,
    example: 'progress',
  })
  @IsOptional()
  @IsIn(KANBAN_COLUMN_KEYS as unknown as string[])
  column?: KanbanColumnKey;
}
