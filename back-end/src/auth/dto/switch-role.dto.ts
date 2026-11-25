import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SwitchRoleDto {
  @ApiProperty({ example: 'Project Owner', description: 'Target role (Collaborator, Project Owner, Mentor)' })
  @IsString()
  @IsNotEmpty()
  role: string;
}
