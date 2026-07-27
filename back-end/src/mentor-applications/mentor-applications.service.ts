import { BadRequestException, Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { BaseService } from '../common/abstracts/base.service';
import { MentorApplicationEntity, MentorApplicationStatus } from './entities/mentor-application.entity';
import { CreateMentorApplicationDto } from './dto/create-mentor-application.dto';
import { UpdateMentorApplicationDto } from './dto/update-mentor-application.dto';
import { UserRole } from '../users/dto/create-user.dto';

@Injectable()
export class MentorApplicationsService extends BaseService<MentorApplicationEntity> {
  constructor(private readonly usersService: UsersService) {
    super();
  }

  create(createMentorApplicationDto: CreateMentorApplicationDto): MentorApplicationEntity {
    const created = super.create({
      ...createMentorApplicationDto,
      status: 'pending',
      applicationDate: new Date().toISOString(),
    });

    return created;
  }

  update(id: string, updateMentorApplicationDto: UpdateMentorApplicationDto): MentorApplicationEntity {
    if (updateMentorApplicationDto.status && !['pending', 'approved', 'rejected'].includes(updateMentorApplicationDto.status)) {
      throw new BadRequestException('Invalid status value');
    }

    return super.update(id, updateMentorApplicationDto);
  }

  findByUser(userId: string): MentorApplicationEntity[] {
    return this.items.filter((application: MentorApplicationEntity) => application.userId === userId);
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

    application.status = 'approved';

    // Optional: Auto-update the user's role to Mentor
    const user = this.usersService.findById(application.userId);
    if (user && user.role !== UserRole.Mentor) {
      this.usersService.update(user.id, { role: UserRole.Mentor });
    }

    return application;
  }

  reject(id: string): MentorApplicationEntity {
    return super.update(id, { status: 'rejected' });
  }
}
