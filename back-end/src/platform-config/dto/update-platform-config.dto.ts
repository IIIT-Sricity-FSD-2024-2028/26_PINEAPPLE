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

  @ApiPropertyOptional({ description: 'Minimum years of experience required for mentor approval', minimum: 0, maximum: 50 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  mentorMinYearsExperience?: number;

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
}
