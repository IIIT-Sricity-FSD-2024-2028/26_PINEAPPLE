import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateTeamDto {
  @ApiProperty() @IsString() hackathonId!: string;
  @ApiProperty() @IsString() name!: string;
  @ApiProperty({ description: 'User ID of the team lead (creator)' }) @IsString() leadUserId!: string;
}
