import { ApiProperty } from '@nestjs/swagger';

export class LeaderboardEntryDto {
  @ApiProperty({
    description: 'User ranking position',
    example: 1,
  })
  rank!: number;

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
    description: 'User reputation score',
    example: 89,
  })
  rep!: number;

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
}