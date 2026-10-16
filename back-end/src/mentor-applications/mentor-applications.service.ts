import { BadRequestException, Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { BaseService } from '../common/abstracts/base.service';
import { MentorApplicationEntity, MentorApplicationStatus } from './entities/mentor-application.entity';
import { CreateMentorApplicationDto } from './dto/create-mentor-application.dto';
import { UpdateMentorApplicationDto } from './dto/update-mentor-application.dto';
import { UserRole } from '../users/dto/create-user.dto';
import { AuditService } from '../audit/audit.service';
import { PlatformConfigService } from '../platform-config/platform-config.service';

@Injectable()
export class MentorApplicationsService extends BaseService<MentorApplicationEntity> {
  constructor(
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
    private readonly platformConfigService: PlatformConfigService,
  ) {
    super();
  }

  create(createMentorApplicationDto: CreateMentorApplicationDto): MentorApplicationEntity {
    let years = createMentorApplicationDto.years !== undefined
      ? Number(createMentorApplicationDto.years)
      : createMentorApplicationDto.yearsOfExperience !== undefined
        ? Number(createMentorApplicationDto.yearsOfExperience)
        : undefined;

    if (years === undefined && createMentorApplicationDto.experience) {
      const match = String(createMentorApplicationDto.experience).match(/\d+/);
      if (match) years = parseInt(match[0], 10);
    }

    const minYears = this.platformConfigService.getConfig().mentorMinYearsExperience;
    if (years !== undefined && years < minYears) {
      throw new BadRequestException(`Minimum ${minYears} years of professional experience required for mentor eligibility.`);
    }

    const created = super.create({
      ...createMentorApplicationDto,
      years,
      yearsOfExperience: years,
      linkedin: createMentorApplicationDto.linkedin || createMentorApplicationDto.portfolio,
      motivation: createMentorApplicationDto.motivation || createMentorApplicationDto.bio,
      status: 'pending',
      applicationDate: new Date().toISOString(),
    });

    try {
      this.auditService.log({
        action: 'mentor-application-sent',
        actor: created.name || `User #${created.userId}`,
        target: 'Mentor Application',
        entityType: 'mentor_application',
        entityId: created.id,
        event: `${created.name || 'User'} submitted mentor application (${created.years || 0} yrs exp)`,
        details: { years: created.years, skills: created.skills },
      });
    } catch { /* non-critical */ }

    return created;
  }

  update(id: string, updateMentorApplicationDto: UpdateMentorApplicationDto): MentorApplicationEntity {
    if (updateMentorApplicationDto.status && !['pending', 'approved', 'rejected'].includes(updateMentorApplicationDto.status)) {
      throw new BadRequestException('Invalid status value');
    }

    return super.update(id, updateMentorApplicationDto as any);
  }

  findByUser(userId: string): MentorApplicationEntity[] {
    const strUserId = String(userId);
    return this.items.filter((application: MentorApplicationEntity) => String(application.userId) === strUserId);
  }

  findByStatus(status: MentorApplicationStatus): MentorApplicationEntity[] {
    return this.items.filter((application: MentorApplicationEntity) => application.status === status);
  }

  approve(id: string, performedBy = 'admin'): MentorApplicationEntity {
    const application = this.findOne(id);

    // If already approved/rejected, don't allow changing
    if (application.status !== 'pending') {
      throw new BadRequestException(`Application is already ${application.status}`);
    }

    let years = application.years !== undefined
      ? Number(application.years)
      : application.yearsOfExperience !== undefined
        ? Number(application.yearsOfExperience)
        : undefined;
    if (years === undefined && (application as any).experience) {
      const match = String((application as any).experience).match(/\d+/);
      if (match) years = parseInt(match[0], 10);
    }
    const minYears = this.platformConfigService.getConfig().mentorMinYearsExperience;
    if (years !== undefined && years < minYears) {
      throw new BadRequestException(`Cannot approve: Applicant has ${years} year(s) of experience, but minimum required is ${minYears}.`);
    }

    application.status = 'approved';

    // Auto-update the user's role to Mentor and unlock mentor profile
    let user: any;
    try {
      user = this.usersService.findById(String(application.userId));
    } catch {
      user = this.usersService.findAll().find(
        (u) => String(u.id) === String(application.userId) ||
               (application.email && u.email && u.email.toLowerCase() === application.email.toLowerCase())
      );
    }

    if (user) {
      this.usersService.update(String(user.id), {
        role: UserRole.Mentor,
        profile: { ...(user.profile || {}), mentorUnlocked: true },
      });
    }

    try {
      this.auditService.log({
        action: 'mentor-application-approved',
        actor: performedBy || 'Admin',
        target: application.name || `User #${application.userId}`,
        entityType: 'mentor_application',
        entityId: application.id,
        event: `Mentor application for ${application.name || 'User'} was approved by ${performedBy || 'Admin'}`,
        details: { status: 'approved' },
      });
    } catch { /* non-critical */ }

    return application;
  }

  reject(id: string): MentorApplicationEntity {
    const application = this.findOne(id);
    const updated = super.update(id, { status: 'rejected' });

    try {
      this.auditService.log({
        action: 'mentor-application-rejected',
        actor: 'Admin',
        target: application ? application.name : `Application #${id}`,
        entityType: 'mentor_application',
        entityId: id,
        event: `Mentor application for ${application ? application.name : 'User'} was rejected`,
        details: { status: 'rejected' },
      });
    } catch { /* non-critical */ }

    return updated;
  }
}
