import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsBoolean } from 'class-validator';

export class UpdateNotificationDto {
  @ApiProperty({
    description: 'Whether the notification has been read',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  readStatus?: boolean;

  @ApiProperty({
    description: 'Title of the notification',
    example: 'Project Membership Ended',
    required: false,
  })
  @IsOptional()
  title?: string;
}