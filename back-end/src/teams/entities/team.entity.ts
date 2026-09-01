import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TeamState {
  Forming = 'Forming',
  VerificationPending = 'VerificationPending',
  Registered = 'Registered',
  Active = 'Active',
  Submitted = 'Submitted',
  Judged = 'Judged',
  Winner = 'Winner',
  Participant = 'Participant',
  Rejected = 'Rejected'
}

export class TeamEntity {
  @ApiProperty() id!: string;
  @ApiProperty({ description: 'Hackathon this team is registered for' }) hackathonId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ description: 'User ID of the team lead' }) leadUserId!: string;
  
  @ApiProperty({ enum: TeamState }) status!: TeamState;
  @ApiProperty({ description: 'Amount of XP staked by the team' }) stakedXP!: number;
  
  @ApiProperty() createdAt!: string;
  @ApiPropertyOptional({ description: 'Backing project/workspace ID — set once the hackathon starts' })
  projectId?: string;

  @ApiPropertyOptional({ description: 'College/University name' })
  college?: string;

  @ApiPropertyOptional({ description: 'Student Roll No / ID' })
  studentId?: string;

  @ApiPropertyOptional({ description: 'ID Card image URL' })
  idCardImage?: string;

  @ApiPropertyOptional({ description: 'Admin user ID who approved/rejected verification' })
  verifiedBy?: string;

  @ApiPropertyOptional()
  verifiedAt?: string;

  @ApiPropertyOptional({ description: 'Rejection reason if rejected' })
  rejectionReason?: string;
  
  @ApiPropertyOptional({ description: 'Host score once judged, 1-100' })
  score?: number;
  @ApiPropertyOptional() scoredAt?: string;
  @ApiPropertyOptional() scoreComment?: string;
  
  @ApiPropertyOptional({ description: 'Submission details' })
  submission?: {
    repoUrl: string;
    demoUrl: string;
    presentationUrl: string;
    submittedAt: string;
  };
}

export class TeamMembershipEntity {
  @ApiProperty() id!: string;
  @ApiProperty() teamId!: string;
  @ApiProperty() userId!: string;
  @ApiProperty({ enum: ['lead', 'member'] }) role!: 'lead' | 'member';
  @ApiProperty() joinedAt!: string;
}
