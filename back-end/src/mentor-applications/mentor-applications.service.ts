import { BadRequestException, Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { BaseService } from '../common/abstracts/base.service';
import { MentorApplicationEntity, MentorApplicationStatus } from './entities/mentor-application.entity';
import { CreateMentorApplicationDto } from './dto/create-mentor-application.dto';
import { UpdateMentorApplicationDto } from './dto/update-mentor-application.dto';

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

  approve(id: string): MentorApplicationEntity {
    const application = this.findOne(id);
    const updated = super.update(id, { status: 'approved' });

    try {
      const user = this.usersService.findOne(application.userId);
      if (user.role !== 'mentor') {
        this.usersService.update(user.id, { role: 'mentor' });
      }
    } catch {
      // If the applicant does not exist in the user store, leave the application updated only
    }

    return updated;
  }

  reject(id: string): MentorApplicationEntity {
    return super.update(id, { status: 'rejected' });
  }
}
