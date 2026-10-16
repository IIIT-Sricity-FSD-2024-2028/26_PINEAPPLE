import { Injectable } from '@nestjs/common';
import { PlatformConfigEntity } from './entities/platform-config.entity';
import { UpdatePlatformConfigDto } from './dto/update-platform-config.dto';

@Injectable()
export class PlatformConfigService {
  private config: PlatformConfigEntity = new PlatformConfigEntity();

  getConfig(): PlatformConfigEntity {
    return { ...this.config };
  }

  updateConfig(dto: UpdatePlatformConfigDto): PlatformConfigEntity {
    this.config = {
      ...this.config,
      ...(dto.maxProjectsPerUser !== undefined ? { maxProjectsPerUser: dto.maxProjectsPerUser } : {}),
      ...(dto.maxCollaboratorsPerProject !== undefined ? { maxCollaboratorsPerProject: dto.maxCollaboratorsPerProject } : {}),
      ...(dto.mentorMinYearsExperience !== undefined ? { mentorMinYearsExperience: dto.mentorMinYearsExperience } : {}),
      ...(dto.xpPerTaskCompletion !== undefined ? { xpPerTaskCompletion: dto.xpPerTaskCompletion } : {}),
      ...(dto.maintenanceMode !== undefined ? { maintenanceMode: Boolean(dto.maintenanceMode) } : {}),
      ...(dto.platformVersion ? { platformVersion: dto.platformVersion } : {}),
    };
    return this.getConfig();
  }

  isMaintenanceActive(): boolean {
    return Boolean(this.config.maintenanceMode);
  }
}
