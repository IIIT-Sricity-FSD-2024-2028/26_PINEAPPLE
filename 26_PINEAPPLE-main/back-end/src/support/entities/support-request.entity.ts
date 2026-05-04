import { ApiProperty } from '@nestjs/swagger';

export type SupportRequestCategory = 'Bug Report' | 'Feature Request' | 'Account Issue' | 'Other';
export type SupportRequestStatus = 'open' | 'in-progress' | 'resolved';

export class SupportRequestEntity {
  @ApiProperty({ description: 'Unique support ticket identifier' })
  id!: string;

  @ApiProperty({ description: 'User ID that submitted the request' })
  userId!: string;

  @ApiProperty({ description: 'Email address of the requester' })
  from!: string;

  @ApiProperty({ description: 'Support request category', enum: ['Bug Report', 'Feature Request', 'Account Issue', 'Other'] })
  category!: SupportRequestCategory;

  @ApiProperty({ description: 'Subject line for the support request' })
  subject!: string;

  @ApiProperty({ description: 'Detailed support request message' })
  message!: string;

  @ApiProperty({ description: 'Current ticket status', enum: ['open', 'in-progress', 'resolved'] })
  status!: SupportRequestStatus;

  @ApiProperty({ description: 'Ticket creation timestamp in ISO format' })
  createdAt!: string;
}
