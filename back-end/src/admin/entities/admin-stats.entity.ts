import { ApiProperty } from '@nestjs/swagger';

export class AdminStatsEntity {
  @ApiProperty({ description: 'Total number of registered users' })
  totalUsers!: number;

  @ApiProperty({ description: 'Number of users with active status' })
  activeUsers!: number;

  @ApiProperty({ description: 'Number of suspended users' })
  suspendedUsers!: number;

  @ApiProperty({ description: 'Number of flagged users' })
  flaggedUsers!: number;

  @ApiProperty({ description: 'Number of banned users' })
  bannedUsers!: number;

  @ApiProperty({ description: 'Total number of projects' })
  totalProjects!: number;

  @ApiProperty({ description: 'Number of projects currently open' })
  openProjects!: number;

  @ApiProperty({ description: 'Number of projects currently in progress' })
  inProgressProjects!: number;

  @ApiProperty({ description: 'Number of completed projects' })
  completedProjects!: number;

  @ApiProperty({ description: 'Number of cancelled projects' })
  cancelledProjects!: number;

  @ApiProperty({ description: 'Total number of tasks' })
  totalTasks!: number;

  @ApiProperty({ description: 'Number of tasks pending' })
  pendingTasks!: number;

  @ApiProperty({ description: 'Number of tasks in progress' })
  inProgressTasks!: number;

  @ApiProperty({ description: 'Number of tasks submitted for review' })
  submittedTasks!: number;

  @ApiProperty({ description: 'Number of approved tasks' })
  approvedTasks!: number;
}
