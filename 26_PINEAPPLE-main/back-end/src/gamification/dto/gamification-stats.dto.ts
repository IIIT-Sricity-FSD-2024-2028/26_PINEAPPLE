import { IsString, IsNumber, IsDate } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GamificationStatsDto {
  @ApiProperty({ example: 'user-1' })
  @IsString()
  userId: string;

  @ApiProperty({ example: 1200 })
  @IsNumber()
  totalXp: number;

  @ApiProperty({ example: 100, description: 'Base reputation is 100' })
  @IsNumber()
  repScore: number;

  @ApiProperty({ example: '2026-05-03T12:00:00Z' })
  @IsDate()
  lastActive: Date;
}
