import { ApiProperty } from '@nestjs/swagger';

export class AuditLogEntry {
  @ApiProperty({ description: 'Unique audit log entry identifier' })
  id!: string;

  @ApiProperty({ description: 'Action type performed by the admin' })
  action!: string;

  @ApiProperty({ description: 'Entity type being operated on' })
  entityType!: string;

  @ApiProperty({ description: 'ID of the affected entity' })
  entityId!: string;

  @ApiProperty({ description: 'Admin or role that performed the action' })
  performedBy!: string;

  @ApiProperty({ description: 'Timestamp when the action was recorded' })
  timestamp!: string;

  @ApiProperty({ description: 'Optional details for the audit entry', type: Object })
  details!: Record<string, any>;
}
