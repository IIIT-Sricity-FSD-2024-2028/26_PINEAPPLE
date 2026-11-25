import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdatePlatformConfigDto {
  @ApiPropertyOptional({ description: 'Maximum active projects a user can own simultaneously', minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxProjectsPerUser?: number;

  @ApiPropertyOptional({ description: 'Maximum collaborators allowed per project', minimum: 1, maximum: 200 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  maxCollaboratorsPerProject?: number;

  @ApiPropertyOptional({ description: 'Minimum years of experience required for mentor approval (5 to 40)', minimum: 5, maximum: 40 })
  @IsOptional()
  @IsInt({ message: 'Minimum tenure must be a whole number.' })
  @Min(5, { message: 'Minimum tenure cannot be lower than 5.' })
  @Max(40, { message: 'Minimum tenure cannot exceed 40.' })
  mentorMinYearsExperience?: number;

  @ApiPropertyOptional({ description: 'Alias for mentorMinYearsExperience (5 to 40)', minimum: 5, maximum: 40 })
  @IsOptional()
  @IsInt({ message: 'Minimum tenure must be a whole number.' })
  @Min(5, { message: 'Minimum tenure cannot be lower than 5.' })
  @Max(40, { message: 'Minimum tenure cannot exceed 40.' })
  minimumTenure?: number;

  @ApiPropertyOptional({ description: 'Standard base XP awarded upon task approval (Medium priority)', minimum: 0, maximum: 10000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  xpPerTaskCompletion?: number;

  @ApiPropertyOptional({ description: 'When enabled, blocks all non-admin traffic with 503 Maintenance Mode' })
  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @ApiPropertyOptional({ description: 'Current platform version' })
  @IsOptional()
  @IsString()
  platformVersion?: string;

  @ApiPropertyOptional({ description: 'Days a rejected mentor applicant must wait before re-applying', minimum: 1, maximum: 365 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  mentorReapplyCooldownDays?: number;

  @ApiPropertyOptional({ description: 'Minimum project age in days required to earn a completion badge', minimum: 0, maximum: 365 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  completionBadgeMinProjectAgeDays?: number;

  @ApiPropertyOptional({ description: 'Minimum minutes between task assignment and approval to count for completion badges', minimum: 0, maximum: 10080 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10080)
  taskMinReviewGapMinutes?: number;

  @ApiPropertyOptional({ description: 'Maximum simultaneous active memberships per user', minimum: 1, maximum: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  maxActiveMemberships?: number;

  @ApiPropertyOptional({ description: 'Maximum new projects a user can create per 24 hours', minimum: 1, maximum: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  maxProjectsPerDay?: number;

  @ApiPropertyOptional({ description: 'Maximum combined reports a user can submit per 24 hours', minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  reportDailyLimit?: number;

  @ApiPropertyOptional({ description: 'Maximum tasks allowed per project', minimum: 1, maximum: 500 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  taskLimitPerProject?: number;
}
