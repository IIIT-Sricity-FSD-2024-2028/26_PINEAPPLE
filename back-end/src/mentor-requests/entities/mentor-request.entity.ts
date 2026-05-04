import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type MentorRequestStatus = 'pending' | 'accepted' | 'declined';

export class MentorRequestEntity {
  @ApiProperty({ description: 'Unique mentor request identifier', example: '4f3a9e2d-d9e8-4bbb-b6f8-a3b132b8f1c1' })
  id!: string;

  @ApiProperty({ description: 'Target project ID for this mentor request', example: 'c9b1d92a-a73f-4a4c-8b0f-2d2f78a8de12' })
  projectId!: string;

  @ApiPropertyOptional({ description: 'Target mentor user ID', example: 'a1d2c3b4-e5f6-7890-1234-56789abcdef0' })
  mentorId?: string;

  @ApiPropertyOptional({ description: 'Target mentor email address', example: 'mentor@example.com' })
  mentorEmail?: string;

  @ApiPropertyOptional({ description: 'Optional project owner message or pitch for the mentor', example: 'We would love your guidance on our full-stack project with React and Node.' })
  message?: string;

  @ApiProperty({ description: 'Current mentor request status', enum: ['pending', 'accepted', 'declined'], example: 'pending' })
  status!: MentorRequestStatus;

  @ApiProperty({ description: 'ISO timestamp when the request was created', example: '2026-04-23T12:34:56.789Z' })
  createdAt!: string;

  @ApiPropertyOptional({ description: 'ISO timestamp when the request was accepted', example: '2026-04-24T08:15:00.123Z' })
  acceptedAt?: string;

  @ApiPropertyOptional({ description: 'ISO timestamp when the request was declined', example: '2026-04-24T09:00:00.123Z' })
  declinedAt?: string;
}
