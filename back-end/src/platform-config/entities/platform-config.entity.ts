import { ApiProperty } from '@nestjs/swagger';

export class PlatformConfigEntity {
  @ApiProperty({ description: 'Maximum active projects a user can own simultaneously', default: 10 })
  maxProjectsPerUser: number = 10;

  @ApiProperty({ description: 'Maximum collaborators allowed per project', default: 20 })
  maxCollaboratorsPerProject: number = 20;

  @ApiProperty({ description: 'Minimum years of experience required for mentor approval', default: 4 })
  mentorMinYearsExperience: number = 4;

  @ApiProperty({ description: 'Standard base XP awarded upon task approval (Medium priority)', default: 50 })
  xpPerTaskCompletion: number = 50;

  @ApiProperty({ description: 'When enabled, blocks all non-admin traffic with 503 Maintenance Mode', default: false })
  maintenanceMode: boolean = false;

  @ApiProperty({ description: 'Current platform version', default: '1.4.2' })
  platformVersion: string = '1.4.2';
}
