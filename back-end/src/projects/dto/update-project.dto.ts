import { PartialType, OmitType, ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsDefined } from 'class-validator';
import { CreateProjectDto } from './create-project.dto';

export class UpdateProjectDto extends PartialType(OmitType(CreateProjectDto, ['dueDate'] as const)) {
  @ApiProperty({ example: '2027-01-15T00:00:00.000Z', description: 'Due date for the project' })
  @IsDefined({ message: 'Project due date is required.' })
  @IsNotEmpty({ message: 'Project due date is required.' })
  @IsString({ message: 'Project due date must be a valid string.' })
  dueDate: string;
}
