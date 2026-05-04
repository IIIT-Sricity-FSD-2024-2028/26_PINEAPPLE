import { BadRequestException, Injectable } from '@nestjs/common';
import { BaseService } from '../common/abstracts/base.service';
import { CreateSupportRequestDto } from './dto/create-support-request.dto';
import { UpdateSupportStatusDto } from './dto/update-support-status.dto';
import { SupportRequestEntity, SupportRequestStatus } from './entities/support-request.entity';

@Injectable()
export class SupportService extends BaseService<SupportRequestEntity> {
  create(createSupportRequestDto: CreateSupportRequestDto & { userId: string; from: string }): SupportRequestEntity {
    const created = super.create({
      ...createSupportRequestDto,
      status: 'open',
      createdAt: new Date().toISOString(),
      subject: createSupportRequestDto.subject || `Support request: ${createSupportRequestDto.category}`,
    });

    return created;
  }

  updateStatus(id: string, updateSupportStatusDto: UpdateSupportStatusDto): SupportRequestEntity {
    const allowedStatuses: SupportRequestStatus[] = ['open', 'in-progress', 'resolved'];
    if (!allowedStatuses.includes(updateSupportStatusDto.status)) {
      throw new BadRequestException('Invalid status value');
    }

    return super.update(id, { status: updateSupportStatusDto.status });
  }

  findByUser(userId: string): SupportRequestEntity[] {
    return this.items.filter((ticket: SupportRequestEntity) => ticket.userId === userId);
  }

  findByStatus(status: SupportRequestStatus): SupportRequestEntity[] {
    return this.items.filter((ticket: SupportRequestEntity) => ticket.status === status);
  }
}
