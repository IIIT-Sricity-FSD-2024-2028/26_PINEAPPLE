import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class CreateJoinRequestDto {
  @ApiProperty({ description: 'User ID making the request' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ description: 'User display name' })
  @IsString()
  @IsNotEmpty()
  userName!: string;

  @ApiProperty({ description: 'Target project ID' })
  @IsUUID()
  projectId!: string;

  @ApiProperty({ description: 'User\'s pitch/application message' })
  @IsString()
  @IsNotEmpty()
  message!: string;
}