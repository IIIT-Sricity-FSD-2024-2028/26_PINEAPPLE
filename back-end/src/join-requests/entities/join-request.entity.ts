import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class JoinRequestEntity {
  @ApiProperty({ description: 'Unique identifier for the join request' })
  id!: string;

  @ApiProperty({ description: 'User ID making the request' })
  userId!: string;

  @ApiProperty({ description: 'User display name' })
  userName!: string;

  @ApiProperty({ description: 'Target project ID' })
  projectId!: string;

  @ApiProperty({ description: 'Request status' })
  status!: string;

  @ApiProperty({ description: 'User\'s pitch/application message' })
  message!: string;

  @ApiPropertyOptional({ description: 'Role requested' })
  role?: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt!: Date;
}