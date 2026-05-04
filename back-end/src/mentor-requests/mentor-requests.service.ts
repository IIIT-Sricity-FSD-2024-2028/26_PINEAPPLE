import { BadRequestException, Injectable } from '@nestjs/common';
import { BaseService } from '../common/abstracts/base.service';
import { MentorRequestEntity } from './entities/mentor-request.entity';
import { CreateMentorRequestDto } from './dto/create-mentor-request.dto';
import { UpdateMentorRequestDto } from './dto/update-mentor-request.dto';

@Injectable()
export class MentorRequestsService extends BaseService<MentorRequestEntity> {
  create(createMentorRequestDto: CreateMentorRequestDto): MentorRequestEntity {
    if (!createMentorRequestDto.mentorId && !createMentorRequestDto.mentorEmail) {
      throw new BadRequestException('mentorId or mentorEmail is required when creating a mentor request');
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

    return super.update(id, updateMentorRequestDto);
  }

  findByProject(projectId: string): MentorRequestEntity[] {
    return this.items.filter((request: MentorRequestEntity) => request.projectId === projectId);
  }

  findByMentor(mentorIdOrEmail: string): MentorRequestEntity[] {
    return this.items.filter((request: MentorRequestEntity) => request.mentorId === mentorIdOrEmail || request.mentorEmail === mentorIdOrEmail);
  }

  accept(id: string): MentorRequestEntity {
    return super.update(id, {
      status: 'accepted',
      acceptedAt: new Date().toISOString(),
      declinedAt: undefined,
    });
  }

  decline(id: string): MentorRequestEntity {
    return super.update(id, {
      status: 'declined',
      declinedAt: new Date().toISOString(),
      acceptedAt: undefined,
    });
  }
}
