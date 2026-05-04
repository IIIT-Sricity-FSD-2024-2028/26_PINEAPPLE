import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BaseService } from '../common/abstracts/base.service';
import { CreatePortalAdminDto } from './dto/create-portal-admin.dto';
import { UpdatePortalAdminDto } from './dto/update-portal-admin.dto';
import { PortalAdminEntity } from './entities/portal-admin.entity';

@Injectable()
export class PortalAdminsService extends BaseService<PortalAdminEntity> {
  create(createPortalAdminDto: CreatePortalAdminDto): PortalAdminEntity {
    const existing = this.items.find((admin: PortalAdminEntity) => admin.email === createPortalAdminDto.email.toLowerCase());
    if (existing) {
      throw new ConflictException(`Portal admin with email ${createPortalAdminDto.email} already exists`);
    }

    const created = super.create({
      ...createPortalAdminDto,
      email: createPortalAdminDto.email.toLowerCase(),
      createdAt: new Date().toISOString(),
    });

    return created;
  }

  update(id: string, updatePortalAdminDto: UpdatePortalAdminDto): PortalAdminEntity {
    const admin = this.findOne(id);

    if (updatePortalAdminDto.email && updatePortalAdminDto.email !== admin.email) {
      const normalizedEmail = updatePortalAdminDto.email.toLowerCase();
      const duplicate = this.items.find(
        (item) => item.email === normalizedEmail && item.id !== id,
      );
      if (duplicate) {
        throw new ConflictException(`Portal admin with email ${updatePortalAdminDto.email} already exists`);
      }
    }

    return super.update(id, {
      ...updatePortalAdminDto,
      ...(updatePortalAdminDto.email ? { email: updatePortalAdminDto.email.toLowerCase() } : {}),
    });
  }

  findByEmail(email: string): PortalAdminEntity | undefined {
    return this.items.find((admin: PortalAdminEntity) => admin.email === email.toLowerCase());
  }

  remove(id: string): void {
    const index = this.items.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new NotFoundException(`Portal admin with id ${id} not found`);
    }
    this.items.splice(index, 1);
  }
}
