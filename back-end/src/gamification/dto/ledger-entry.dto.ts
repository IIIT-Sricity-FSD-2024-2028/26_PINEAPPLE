import { IsString, IsEnum, IsNumber, IsDate } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum LedgerType {
  XP = 'XP',
  REPUTATION = 'REPUTATION',
}

export class LedgerEntryDto {
  @ApiProperty({ example: 'entry-123' })
  @IsString()
  id: string;

  @ApiProperty({ example: 'user-1' })
  @IsString()
  userId: string;

  @ApiProperty({ enum: LedgerType, example: LedgerType.XP })
  @IsEnum(LedgerType)
  type: LedgerType;

  @ApiProperty({ example: 50 })
  @IsNumber()
  amount: number;

  @ApiProperty({ example: 'Task Approved' })
  @IsString()
  reason: string;

  @ApiProperty({ example: '2026-05-03T12:00:00Z' })
  @IsDate()
  timestamp: Date;
}
