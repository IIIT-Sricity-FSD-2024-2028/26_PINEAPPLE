import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateJoinRequestDto {
  @ApiProperty({ description: 'User ID making the request' })
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiPropertyOptional({ description: 'User display name' })
  @IsString()
  @IsOptional()
  userName?: string;

  @ApiProperty({ description: 'Target project ID' })
  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @ApiPropertyOptional({ description: 'User\'s pitch/application message' })
  @IsString()
  @IsOptional()
  message?: string;

  @ApiPropertyOptional({ description: 'Role applied for', default: 'Collaborator' })
  @IsString()
  @IsOptional()
  role?: string;

  @ApiPropertyOptional({ description: 'Request status', default: 'Pending' })
  @IsString()
  @IsOptional()
  status?: string;
}