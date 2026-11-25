import { ApiProperty } from '@nestjs/swagger';

export const COMPLETION_BADGE_MIN_TASKS = 3;
export const COMPLETION_BADGE_MIN_PROJECT_AGE_DAYS = 3;
export const TASK_MIN_REVIEW_GAP_MINUTES = 60;
export const TASK_LIMIT_PER_PROJECT = 30;

export class PlatformConfigEntity {
  @ApiProperty({ description: 'Maximum active projects a user can own simultaneously', default: 10 })
  maxProjectsPerUser: number = 10;

  @ApiProperty({ description: 'Maximum collaborators allowed per project', default: 20 })
  maxCollaboratorsPerProject: number = 20;

  @ApiProperty({ description: 'Minimum years of experience required for mentor approval (5 to 40)', default: 5 })
  mentorMinYearsExperience: number = 5;

  @ApiProperty({ description: 'Alias for mentorMinYearsExperience', default: 5 })
  minimumTenure?: number;

  @ApiProperty({ description: 'Days a rejected mentor applicant must wait before re-applying', default: 14 })
  mentorReapplyCooldownDays: number = 14;

  @ApiProperty({ description: 'Maximum simultaneous non-finished projects a user can join as an active member', default: 3 })
  maxActiveMemberships: number = 3;

  @ApiProperty({ description: 'Maximum new projects an owner can create within a 24-hour window', default: 3 })
  maxProjectsPerDay: number = 3;

  @ApiProperty({ description: 'Maximum combined reports a user can submit within a 24-hour window', default: 10 })
  reportDailyLimit: number = 10;

  @ApiProperty({ description: 'Standard base XP awarded upon task approval (Medium priority)', default: 50 })
  xpPerTaskCompletion: number = 50;

  @ApiProperty({ description: 'Minimum project age in days required to earn a completion badge', default: COMPLETION_BADGE_MIN_PROJECT_AGE_DAYS })
  completionBadgeMinProjectAgeDays: number = COMPLETION_BADGE_MIN_PROJECT_AGE_DAYS;

  @ApiProperty({ description: 'Minimum minutes between task assignment and approval to count for completion badges', default: TASK_MIN_REVIEW_GAP_MINUTES })
  taskMinReviewGapMinutes: number = TASK_MIN_REVIEW_GAP_MINUTES;

  @ApiProperty({ description: 'Maximum number of tasks allowed per project', default: TASK_LIMIT_PER_PROJECT })
  taskLimitPerProject: number = TASK_LIMIT_PER_PROJECT;

  @ApiProperty({ description: 'When enabled, blocks all non-admin traffic with 503 Maintenance Mode', default: false })
  maintenanceMode: boolean = false;

  @ApiProperty({ description: 'Current platform version', default: '1.4.2' })
  platformVersion: string = '1.4.2';
}
