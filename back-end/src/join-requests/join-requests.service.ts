import { Injectable } from '@nestjs/common';
import { BaseService } from '../common/abstracts/base.service';
import { JoinRequestEntity } from './entities/join-request.entity';
import { CreateJoinRequestDto } from './dto/create-join-request.dto';
import { UpdateJoinRequestDto } from './dto/update-join-request.dto';

@Injectable()
export class JoinRequestsService extends BaseService<JoinRequestEntity> {
  create(createJoinRequestDto: CreateJoinRequestDto): JoinRequestEntity {
    const now = new Date();
    const joinRequest = {
      ...createJoinRequestDto,
      status: 'pending' as const,
      createdAt: now,
      updatedAt: now,
    };
    return super.create(joinRequest);
  }

  update(id: string, updateJoinRequestDto: UpdateJoinRequestDto): JoinRequestEntity {
    const updated = super.update(id, {
      ...updateJoinRequestDto,
      updatedAt: new Date(),
    });
    return updated;
  }

  findByProject(projectId: string): JoinRequestEntity[] {
    return this.items.filter((request: JoinRequestEntity) => request.projectId === projectId);
  }

  findByUser(userId: string): JoinRequestEntity[] {
    return this.items.filter((request: JoinRequestEntity) => request.userId === userId);
  }

  findByStatus(status: string): JoinRequestEntity[] {
    return this.items.filter((request: JoinRequestEntity) => request.status === status);
  }

  approveRequest(id: string): JoinRequestEntity {
    return this.update(id, { status: 'approved' });
  }

  rejectRequest(id: string): JoinRequestEntity {
    return this.update(id, { status: 'rejected' });
  }
}