import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({ example: 'proj-1' })
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @ApiPropertyOptional({ example: 'Hey team, I just pushed the new database schema.' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ example: 'Hey team, I just pushed the new database schema.' })
  @IsOptional()
  @IsString()
  text?: string;

  @ApiPropertyOptional({ example: 'Priya' })
  @IsOptional()
  @IsString()
  senderName?: string;
}
