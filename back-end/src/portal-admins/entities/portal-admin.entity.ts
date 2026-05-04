import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PortalAdminEntity {
  @ApiProperty({ description: 'Unique portal admin identifier' })
  id!: string;

  @ApiProperty({ description: 'Display name of the portal admin' })
  name!: string;

  @ApiProperty({ description: 'Email address of the portal admin' })
  email!: string;

  @ApiProperty({ description: 'Password for the portal admin account' })
  password!: string;

  @ApiProperty({ description: 'Portal admin role', enum: ['admin', 'superuser'] })
  portalRole!: 'admin' | 'superuser';

  @ApiProperty({ description: 'Permissions assigned to the portal admin', type: [String] })
  permissions!: string[];

  @ApiProperty({ description: 'Creation timestamp in ISO format' })
  createdAt!: string;

  @ApiPropertyOptional({ description: 'Last login timestamp in ISO format' })
  lastLogin?: string;
}
