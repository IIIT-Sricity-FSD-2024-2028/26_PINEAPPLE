import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TeamEntity {
  @ApiProperty() id!: string;
  @ApiProperty({ description: 'Hackathon this team is registered for' }) hackathonId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ description: 'User ID of the team lead' }) leadUserId!: string;
  @ApiProperty() createdAt!: string;
  @ApiPropertyOptional({ description: 'Backing project/workspace ID — set once the hackathon starts' })
  projectId?: string;
  @ApiPropertyOptional({ description: 'Host score once judged, 1-10' })
  score?: number;
  @ApiPropertyOptional() scoredAt?: string;
  @ApiPropertyOptional() scoreComment?: string;
}

export class TeamMembershipEntity {
  @ApiProperty() id!: string;
  @ApiProperty() teamId!: string;
  @ApiProperty() userId!: string;
  @ApiProperty({ enum: ['lead', 'member'] }) role!: 'lead' | 'member';
  @ApiProperty() joinedAt!: string;
}
