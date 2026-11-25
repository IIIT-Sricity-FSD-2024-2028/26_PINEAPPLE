import { ApiProperty } from '@nestjs/swagger';

export class LeaderboardEntryDto {
  @ApiProperty({
    description: 'User ID',
    example: 'c9b1d92a-a73f-4a4c-8b0f-2d2f78a8de12',
  })
  userId?: string;

  @ApiProperty({
    description: 'User full name',
    example: 'Rohan Mehta',
  })
  user!: string;

  @ApiProperty({
    description: 'User initials for avatar',
    example: 'RM',
  })
  initials!: string;

  @ApiProperty({
    description: 'Total experience points earned',
    example: 4200,
  })
  xp!: number;

  @ApiProperty({
    description: 'User reputation score (visible to self or admins)',
    example: 89,
    required: false,
  })
  rep?: number;

  @ApiProperty({
    description: 'Standing band (Good standing, Fair standing, Low standing)',
    example: 'Good standing',
    required: false,
  })
  band?: string;

  @ApiProperty({
    description: 'Number of completed tasks',
    example: 42,
  })
  tasks!: number;

  @ApiProperty({
    description: 'Number of projects participated in',
    example: 8,
  })
  projects!: number;

  @ApiProperty({
    description: 'On-time delivery percentage (if >= 3 tasks with due date)',
    example: 88,
    required: false,
  })
  onTimeRate?: number | null;

  @ApiProperty({
    description: 'Trust label',
    example: 'Trusted contributor',
    required: false,
  })
  trustLabel?: string;
}
