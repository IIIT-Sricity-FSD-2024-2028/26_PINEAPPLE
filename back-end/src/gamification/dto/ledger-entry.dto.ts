import { IsString, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum LedgerType {
  XP = 'XP',
  REPUTATION = 'REPUTATION',
}

export class LedgerEntryDto {
  @ApiProperty({ example: 'ledg-1' })
  @IsString()
  id: string;

  @ApiProperty({ example: '2' })
  @IsString()
  userId: string;

  @ApiProperty({ example: 'task-1', required: false })
  @IsString()
  @IsOptional()
  taskId?: string | null;

  @ApiProperty({ example: 'proj-1', required: false })
  @IsString()
  @IsOptional()
  projectId?: string | null;

  @ApiProperty({ example: 40 })
  @IsNumber()
  xp: number;

  @ApiProperty({ example: 'Task Approved: Design Database Schema' })
  @IsString()
  reason: string;

  @ApiProperty({ example: '2026-10-24T12:00:00.000Z' })
  @IsString()
  date: string;

  // Backward compatibility helpers
  @IsOptional()
  type?: LedgerType;

  @IsOptional()
  amount?: number;

  @IsOptional()
  timestamp?: Date;
}
