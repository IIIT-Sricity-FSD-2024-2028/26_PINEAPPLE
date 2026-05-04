import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateNotificationDto {
  @ApiProperty({ example: '2' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ example: 'Task Completed' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'You earned 100 XP for completing the Authentication task.' })
  @IsString()
  @IsNotEmpty()
  message: string;
}
