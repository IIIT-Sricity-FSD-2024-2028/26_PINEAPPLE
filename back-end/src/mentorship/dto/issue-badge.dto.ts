import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum BadgeType {
  TechnicalExcellence = 'Technical Excellence',
  Leadership = 'Leadership',
  TeamPlayer = 'Team Player',
  Innovator = 'Innovator',
}

export class IssueBadgeDto {
  @ApiProperty({ example: 'proj-1', description: 'ID of the project' })
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @ApiPropertyOptional({ example: '2', description: 'Recipient user ID' })
  @IsOptional()
  @IsString()
  recipientId?: string;

  @ApiPropertyOptional({ example: '2', description: 'Collaborator user ID (alias for recipientId)' })
  @IsOptional()
  @IsString()
  collaboratorId?: string;

  @ApiPropertyOptional({ example: 'Technical Excellence', description: 'Name of the recommendation badge' })
  @IsOptional()
  @IsString()
  badgeName?: string;

  @ApiPropertyOptional({ example: 'Technical Excellence', description: 'Badge type (alias for badgeName)' })
  @IsOptional()
  @IsString()
  badgeType?: string;

  @ApiPropertyOptional({ example: 'Exceptional code review and problem-solving skills.' })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional({ example: 'Exceptional code review and problem-solving skills.' })
  @IsOptional()
  @IsString()
  note?: string;
}
