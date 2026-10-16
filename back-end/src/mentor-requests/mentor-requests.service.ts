import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { BaseService } from '../common/abstracts/base.service';
import { MentorRequestEntity } from './entities/mentor-request.entity';
import { CreateMentorRequestDto } from './dto/create-mentor-request.dto';
import { UpdateMentorRequestDto } from './dto/update-mentor-request.dto';
import { ProjectsService } from '../projects/projects.service';
import { UsersService } from '../users/users.service';
import { MentorApplicationsService } from '../mentor-applications/mentor-applications.service';
import { UserRole } from '../users/dto/create-user.dto';

@Injectable()
export class MentorRequestsService extends BaseService<MentorRequestEntity> {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly usersService: UsersService,
    private readonly mentorApplicationsService: MentorApplicationsService,
  ) {
    super();
  }

  isApprovedMentor(userId?: string): boolean {
    if (!userId) return false;
    let userEmail: string | undefined;
    try {
      const user = this.usersService.findById(userId);
      if (user) {
        userEmail = user.email;
        if (user.role === UserRole.Mentor || user.profile?.mentorUnlocked) {
          return true;
        }
      }
    } catch {
      // User not found in repository
    }

    try {
      const apps = this.mentorApplicationsService.findByUser(userId);
      if (apps && apps.some((a) => a.status === 'approved')) {
        return true;
      }
      if (userEmail) {
        const approved = this.mentorApplicationsService.findByStatus('approved');
        if (approved.some((a) => a.email && a.email.toLowerCase() === userEmail.toLowerCase())) {
          return true;
        }
      }
    } catch {
      // Lookup failure
    }

    return false;
  }

  create(createMentorRequestDto: CreateMentorRequestDto): MentorRequestEntity {
    if (!createMentorRequestDto.mentorId && !createMentorRequestDto.mentorEmail) {
      throw new BadRequestException('mentorId or mentorEmail is required when creating a mentor request');
    }

    if (createMentorRequestDto.projectId && this.projectsService.isLocked(createMentorRequestDto.projectId)) {
      throw new BadRequestException('Project is locked. Mentor requests cannot be created.');
    }

    return super.create({
      ...createMentorRequestDto,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
  }

  update(id: string, updateMentorRequestDto: UpdateMentorRequestDto): MentorRequestEntity {
    if (
      updateMentorRequestDto.status &&
      !['pending', 'accepted', 'declined'].includes(updateMentorRequestDto.status)
    ) {
      throw new BadRequestException('Invalid status value');
    }

    const current = this.findOne(id);
    if (current?.status === 'accepted' && updateMentorRequestDto.status && updateMentorRequestDto.status !== 'accepted') {
      throw new ForbiddenException('A mentor cannot leave or be removed once a project has started.');
    }
    if (current?.projectId && this.projectsService.isLocked(current.projectId)) {
      throw new BadRequestException('Project is locked. Mentor requests cannot be modified.');
    }

    return super.update(id, updateMentorRequestDto as any);
  }

  findByProject(projectId: string): MentorRequestEntity[] {
    return this.items.filter((request: MentorRequestEntity) => request.projectId === projectId);
  }

  findByMentor(mentorIdOrEmail: string): MentorRequestEntity[] {
    return this.items.filter((request: MentorRequestEntity) => request.mentorId === mentorIdOrEmail || request.mentorEmail === mentorIdOrEmail);
  }

  accept(id: string, userId?: string, role?: string): MentorRequestEntity {
    const isPrivileged = ['admin', 'superuser', 'administrator', 'super user'].includes(
      String(role || '').toLowerCase(),
    );
    if (!isPrivileged) {
      if (!this.isApprovedMentor(userId)) {
        throw new ForbiddenException('Only approved mentors can accept mentor requests.');
      }
      const current = this.findOne(id);
      let userEmail: string | undefined;
      try {
        if (userId) userEmail = this.usersService.findById(userId)?.email?.toLowerCase();
      } catch { /* ignored */ }

      const reqMentorId = current.mentorId?.trim();
      const reqMentorEmail = current.mentorEmail?.trim().toLowerCase();
      if ((reqMentorId || reqMentorEmail) && userId) {
        const matches = (reqMentorId && reqMentorId === userId) || (userEmail && reqMentorEmail === userEmail);
        if (!matches) {
          throw new ForbiddenException('This mentor request was not assigned to you.');
        }
      }
    }

    const current = this.findOne(id);
    const updated = super.update(id, {
      status: 'accepted',
      acceptedAt: new Date().toISOString(),
      declinedAt: undefined,
    });

    if (current?.projectId) {
      try {
        let mentorName = 'Mentor';
        let assignedMentorId = userId || current.mentorId;
        if (assignedMentorId) {
          try {
            const u = this.usersService.findById(assignedMentorId);
            if (u) mentorName = u.name;
          } catch {
            /* ignore */
          }
        } else if (current.mentorEmail) {
          try {
            const u = this.usersService.findAll().find(
              (usr) => usr.email && usr.email.toLowerCase() === current.mentorEmail!.toLowerCase(),
            );
            if (u) {
              mentorName = u.name;
              assignedMentorId = u.id;
            }
          } catch {
            /* ignore */
          }
        }

        const project = this.projectsService.findById(current.projectId);
        if (project) {
          project.mentorId = assignedMentorId;
          project.mentor = mentorName;
        }
      } catch {
        /* non-critical */
      }
    }

    return updated;
  }

  decline(id: string, userId?: string, role?: string): MentorRequestEntity {
    const current = this.findOne(id);
    if (current?.status === 'accepted') {
      throw new ForbiddenException('A mentor cannot leave or be removed once a project has started.');
    }
    const isPrivileged = ['admin', 'superuser', 'administrator', 'super user'].includes(
      String(role || '').toLowerCase(),
    );
    if (!isPrivileged) {
      if (!this.isApprovedMentor(userId)) {
        throw new ForbiddenException('Only approved mentors can decline mentor requests.');
      }
      let userEmail: string | undefined;
      try {
        if (userId) userEmail = this.usersService.findById(userId)?.email?.toLowerCase();
      } catch { /* ignored */ }

      const reqMentorId = current.mentorId?.trim();
      const reqMentorEmail = current.mentorEmail?.trim().toLowerCase();
      if ((reqMentorId || reqMentorEmail) && userId) {
        const matches = (reqMentorId && reqMentorId === userId) || (userEmail && reqMentorEmail === userEmail);
        if (!matches) {
          throw new ForbiddenException('This mentor request was not assigned to you.');
        }
      }
    }

    return super.update(id, {
      status: 'declined',
      declinedAt: new Date().toISOString(),
      acceptedAt: undefined,
    });
  }

  override remove(id: string): void {
    const current = this.findOne(id);
    if (current?.status === 'accepted') {
      throw new ForbiddenException('A mentor cannot leave or be removed once a project has started.');
    }
    if (current?.projectId && this.projectsService.isLocked(current.projectId)) {
      throw new BadRequestException('Project is locked. Mentor requests cannot be removed.');
    }
    super.remove(id);
  }
}
