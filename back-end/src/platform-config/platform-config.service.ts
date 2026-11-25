import { Injectable, BadRequestException } from '@nestjs/common';
import { PlatformConfigEntity } from './entities/platform-config.entity';
import { UpdatePlatformConfigDto } from './dto/update-platform-config.dto';

@Injectable()
export class PlatformConfigService {
  private config: PlatformConfigEntity = new PlatformConfigEntity();

  private resolvePositiveEnvInt(envKey: string, fallback: number): number {
    const raw = process.env[envKey] ? Number(process.env[envKey]) : undefined;
    return raw && !Number.isNaN(raw) && raw > 0 ? Math.floor(raw) : fallback;
  }

  getConfig(): PlatformConfigEntity {
    const effectiveCooldown = this.resolvePositiveEnvInt(
      'MENTOR_REAPPLY_COOLDOWN_DAYS',
      this.config.mentorReapplyCooldownDays,
    );
    const effectiveMaxMemberships = this.resolvePositiveEnvInt(
      'MAX_ACTIVE_MEMBERSHIPS',
      this.config.maxActiveMemberships,
    );
    const effectiveMaxProjectsPerDay = this.resolvePositiveEnvInt(
      'PROJECT_DAILY_LIMIT',
      this.config.maxProjectsPerDay,
    );
    const effectiveOpenProjectLimit = this.resolvePositiveEnvInt(
      'OPEN_PROJECT_LIMIT',
      this.config.maxProjectsPerUser,
    );
    const effectiveReportDailyLimit = this.resolvePositiveEnvInt(
      'REPORT_DAILY_LIMIT',
      this.config.reportDailyLimit,
    );
    const effectiveMinProjectAgeDays = this.resolvePositiveEnvInt(
      'COMPLETION_BADGE_MIN_PROJECT_AGE_DAYS',
      this.config.completionBadgeMinProjectAgeDays,
    );
    const effectiveTaskMinReviewGapMinutes = this.resolvePositiveEnvInt(
      'TASK_MIN_REVIEW_GAP_MINUTES',
      this.config.taskMinReviewGapMinutes,
    );
    const effectiveTaskLimitPerProject = this.resolvePositiveEnvInt(
      'TASK_LIMIT_PER_PROJECT',
      this.config.taskLimitPerProject,
    );
    return {
      ...this.config,
      minimumTenure: this.config.mentorMinYearsExperience,
      mentorReapplyCooldownDays: effectiveCooldown,
      maxActiveMemberships: effectiveMaxMemberships,
      maxProjectsPerDay: effectiveMaxProjectsPerDay,
      maxProjectsPerUser: effectiveOpenProjectLimit,
      reportDailyLimit: effectiveReportDailyLimit,
      completionBadgeMinProjectAgeDays: effectiveMinProjectAgeDays,
      taskMinReviewGapMinutes: effectiveTaskMinReviewGapMinutes,
      taskLimitPerProject: effectiveTaskLimitPerProject,
    };
  }

  updateConfig(dto: UpdatePlatformConfigDto): PlatformConfigEntity {
    const rawTenure = dto.mentorMinYearsExperience !== undefined ? dto.mentorMinYearsExperience : dto.minimumTenure;
    if (rawTenure !== undefined) {
      if (!Number.isInteger(rawTenure) || rawTenure < 5 || rawTenure > 40) {
        throw new BadRequestException('Minimum tenure must be a whole number between 5 and 40.');
      }
      if (rawTenure < this.config.mentorMinYearsExperience) {
        throw new BadRequestException('Minimum tenure can only be raised (between 5 and 40).');
      }
    }

    const tenure = rawTenure !== undefined ? rawTenure : this.config.mentorMinYearsExperience;

    this.config = {
      ...this.config,
      ...(dto.maxProjectsPerUser !== undefined ? { maxProjectsPerUser: dto.maxProjectsPerUser } : {}),
      ...(dto.maxCollaboratorsPerProject !== undefined ? { maxCollaboratorsPerProject: dto.maxCollaboratorsPerProject } : {}),
      mentorMinYearsExperience: tenure,
      ...(dto.mentorReapplyCooldownDays !== undefined ? { mentorReapplyCooldownDays: dto.mentorReapplyCooldownDays } : {}),
      ...(dto.maxActiveMemberships !== undefined ? { maxActiveMemberships: dto.maxActiveMemberships } : {}),
      ...(dto.maxProjectsPerDay !== undefined ? { maxProjectsPerDay: dto.maxProjectsPerDay } : {}),
      ...(dto.reportDailyLimit !== undefined ? { reportDailyLimit: dto.reportDailyLimit } : {}),
      ...(dto.xpPerTaskCompletion !== undefined ? { xpPerTaskCompletion: dto.xpPerTaskCompletion } : {}),
      ...(dto.completionBadgeMinProjectAgeDays !== undefined
        ? { completionBadgeMinProjectAgeDays: dto.completionBadgeMinProjectAgeDays }
        : {}),
      ...(dto.taskMinReviewGapMinutes !== undefined
        ? { taskMinReviewGapMinutes: dto.taskMinReviewGapMinutes }
        : {}),
      ...(dto.taskLimitPerProject !== undefined
        ? { taskLimitPerProject: dto.taskLimitPerProject }
        : {}),
      ...(dto.maintenanceMode !== undefined ? { maintenanceMode: Boolean(dto.maintenanceMode) } : {}),
      ...(dto.platformVersion ? { platformVersion: dto.platformVersion } : {}),
    };
    return this.getConfig();
  }

  isMaintenanceActive(): boolean {
    return Boolean(this.config.maintenanceMode);
  }

  resetToSeed(): void {
    this.config = new PlatformConfigEntity();
  }

  reset(): void {
    if (process.env.NODE_ENV !== 'test' && !process.env.ALLOW_STORE_RESET) return;
    this.resetToSeed();
  }
}
