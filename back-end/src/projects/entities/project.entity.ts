import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProjectMember {
  @ApiProperty({ description: 'Member name' })
  name!: string;

  @ApiProperty({ description: 'Member initials' })
  initials!: string;

  @ApiProperty({ description: 'Member role in the project', enum: ['Owner', 'Developer', 'Designer', 'QA', 'Contributor'] })
  role!: 'Owner' | 'Developer' | 'Designer' | 'QA' | 'Contributor';
}

export class ProjectTask {
  @ApiProperty({ description: 'Task ID' })
  id!: string;

  @ApiProperty({ description: 'Task title' })
  title!: string;

  @ApiPropertyOptional({ description: 'Task description' })
  description?: string;

  @ApiProperty({ description: 'Assigned user' })
  assignedTo!: string;

  @ApiProperty({ description: 'Task status', enum: ['pending', 'in-progress', 'submitted', 'approved'] })
  status!: 'pending' | 'in-progress' | 'submitted' | 'approved';

  @ApiPropertyOptional({ description: 'Proof link' })
  proofLink?: string;

  @ApiPropertyOptional({ description: 'Due date' })
  due?: string;

  @ApiProperty({ description: 'Priority', enum: ['Low', 'Medium', 'High'] })
  priority!: 'Low' | 'Medium' | 'High';
}

export class JoinRequest {
  @ApiProperty({ description: 'Request ID' })
  id!: string;

  @ApiProperty({ description: 'User ID making the request' })
  userId!: string;

  @ApiProperty({ description: 'User name' })
  userName!: string;

  @ApiProperty({ description: 'Request status', enum: ['pending', 'approved', 'rejected'] })
  status!: 'pending' | 'approved' | 'rejected';

  @ApiProperty({ description: 'Request message' })
  message!: string;

  @ApiProperty({ description: 'Request timestamp' })
  createdAt!: Date;
}

export class ProjectEntity {
  @ApiProperty({ description: 'Unique identifier for the project' })
  id!: string;

  @ApiProperty({ description: 'Project name' })
  name!: string;

  @ApiProperty({ description: 'Project description' })
  desc!: string;

  @ApiProperty({ description: 'Required skills', type: [String] })
  skills!: string[];

  @ApiProperty({ description: 'Project progress percentage', minimum: 0, maximum: 100 })
  progress!: number;

  @ApiProperty({ description: 'Number of collaborators' })
  collaborators!: number;

  @ApiProperty({ description: 'Project owner (user name or email)' })
  owner!: string;

  @ApiProperty({ description: 'Project members', type: [ProjectMember] })
  members!: ProjectMember[];

  @ApiProperty({ description: 'Project status', enum: ['open', 'in-progress', 'completed', 'cancelled'] })
  status!: 'open' | 'in-progress' | 'completed' | 'cancelled';

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt!: Date;

  @ApiProperty({ description: 'Whether created via API', default: true })
  isUserCreated!: boolean;

  @ApiProperty({ description: 'Project tasks', type: [ProjectTask] })
  tasks!: ProjectTask[];

  @ApiProperty({ description: 'Pending join requests', type: [JoinRequest] })
  requests!: JoinRequest[];

  @ApiProperty({ description: 'Invited user emails', type: [String] })
  invites!: string[];
}