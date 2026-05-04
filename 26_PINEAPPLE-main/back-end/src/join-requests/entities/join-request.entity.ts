import { ApiProperty } from '@nestjs/swagger';

export class JoinRequestEntity {
  @ApiProperty({ description: 'Unique identifier for the join request' })
  id!: string;

  @ApiProperty({ description: 'User ID making the request' })
  userId!: string;

  @ApiProperty({ description: 'User display name' })
  userName!: string;

  @ApiProperty({ description: 'Target project ID' })
  projectId!: string;

  @ApiProperty({ description: 'Request status', enum: ['pending', 'approved', 'rejected'] })
  status!: 'pending' | 'approved' | 'rejected';

  @ApiProperty({ description: 'User\'s pitch/application message' })
  message!: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt!: Date;
}