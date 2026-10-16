import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BaseService } from '../common/abstracts/base.service';
import { CreatePortalAdminDto } from './dto/create-portal-admin.dto';
import { UpdatePortalAdminDto } from './dto/update-portal-admin.dto';
import { PortalAdminEntity } from './entities/portal-admin.entity';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class PortalAdminsService extends BaseService<PortalAdminEntity> {
  constructor(private readonly auditService: AuditService) {
    super();
  }

  create(createPortalAdminDto: CreatePortalAdminDto): PortalAdminEntity {
    const existing = this.items.find((admin: PortalAdminEntity) => admin.email === createPortalAdminDto.email.toLowerCase());
    if (existing) {
      throw new ConflictException(`Portal admin with email ${createPortalAdminDto.email} already exists`);
    }

    const created = super.create({
      ...createPortalAdminDto,
      portalRole: 'admin',
      email: createPortalAdminDto.email.toLowerCase(),
      createdAt: new Date().toISOString(),
    });

    try {
      this.auditService.log({
        action: 'admin-created',
        actor: 'Super User',
        target: created.name || created.email,
        entityType: 'portal_admin',
        entityId: created.id,
        event: `Super User provisioned new admin account: "${created.name}" (${created.email})`,
        details: { permissions: created.permissions },
      });
    } catch { /* non-critical */ }

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

    const updated = super.update(id, {
      ...updatePortalAdminDto,
      ...(updatePortalAdminDto.email ? { email: updatePortalAdminDto.email.toLowerCase() } : {}),
    });

    try {
      const isStatusChange = updatePortalAdminDto.status && updatePortalAdminDto.status !== admin.status;
      this.auditService.log({
        action: isStatusChange ? 'admin-status-updated' : 'admin-updated',
        actor: 'Super User',
        target: admin.name || admin.email,
        entityType: 'portal_admin',
        entityId: id,
        event: isStatusChange 
          ? `Super User toggled admin "${admin.name}" status to ${updatePortalAdminDto.status}`
          : `Super User updated permissions for admin "${admin.name}"`,
        details: updatePortalAdminDto,
      });
    } catch { /* non-critical */ }

    return updated;
  }

  findByEmail(email: string): PortalAdminEntity | undefined {
    return this.items.find((admin: PortalAdminEntity) => admin.email === email.toLowerCase());
  }

  remove(id: string): void {
    const index = this.items.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new NotFoundException(`Portal admin with id ${id} not found`);
    }
    const targetAdmin = this.items[index];
    this.items.splice(index, 1);

    try {
      this.auditService.log({
        action: 'admin-deleted',
        actor: 'Super User',
        target: targetAdmin ? targetAdmin.name || targetAdmin.email : `Admin #${id}`,
        entityType: 'portal_admin',
        entityId: id,
        event: `Super User erased admin account: "${targetAdmin ? targetAdmin.name : id}"`,
      });
    } catch { /* non-critical */ }
  }
}
