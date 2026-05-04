import { IsString, IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum BadgeType {
  TechnicalExcellence = 'Technical Excellence',
  Leadership = 'Leadership',
  TeamPlayer = 'Team Player',
  Innovator = 'Innovator',
}

export class IssueBadgeDto {
  @ApiProperty({ example: '2' })
  @IsString()
  @IsNotEmpty()
  collaboratorId: string;

  @ApiProperty({ enum: BadgeType, example: BadgeType.TechnicalExcellence })
  @IsEnum(BadgeType)
  badgeType: BadgeType;

  @ApiProperty({ example: 'Exceptional code review and problem-solving skills.' })
  @IsString()
  @IsNotEmpty()
  comment: string;
}
