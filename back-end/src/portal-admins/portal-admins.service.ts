import { ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { BaseService } from '../common/abstracts/base.service';
import { CreatePortalAdminDto } from './dto/create-portal-admin.dto';
import { UpdatePortalAdminDto } from './dto/update-portal-admin.dto';
import { PortalAdminEntity } from './entities/portal-admin.entity';
import { AuditService } from '../audit/audit.service';
import { ADMIN_REFRESH_SERVICE } from '../common/utils/refresh-cookie.util';

@Injectable()
export class PortalAdminsService extends BaseService<PortalAdminEntity> {
  constructor(
    private readonly auditService: AuditService,
    @Optional()
    private readonly moduleRef?: ModuleRef,
  ) {
    super();
  }

  private getAdminRefreshService(): any {
    if (!this.moduleRef) return undefined;
    try {
      return this.moduleRef.get(ADMIN_REFRESH_SERVICE, { strict: false });
    } catch {
      return undefined;
    }
  }

  findById(id: string): PortalAdminEntity | undefined {
    return this.items.find((admin: PortalAdminEntity) => admin.id === id);
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
      tokenVersion: 1,
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
    } catch (err: any) {
        console.warn('[portal-admins.service] Suppressed non-critical error:', err?.message || err);
      }

    return created;
  }

  update(id: string, updatePortalAdminDto: UpdatePortalAdminDto): PortalAdminEntity {
    const admin = this.findOne(id);
    const oldStatus = String(admin.status || 'active').toLowerCase();
    const oldRole = String(admin.portalRole || 'admin').toLowerCase();
    const oldPermissions = Array.isArray(admin.permissions) ? [...admin.permissions] : [];

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

    const nextStatus = String(updated.status || 'active').toLowerCase();
    const nextRole = String(updated.portalRole || 'admin').toLowerCase();
    const nextPermissions = Array.isArray(updated.permissions) ? updated.permissions : [];

    const becameInactive =
      nextStatus !== oldStatus &&
      ['suspended', 'disabled', 'inactive', 'deactivated', 'banned'].includes(nextStatus);
    const passwordChanged =
      typeof updatePortalAdminDto.password === 'string' &&
      updatePortalAdminDto.password.length > 0 &&
      updatePortalAdminDto.password !== admin.password;
    const roleChanged = nextRole !== oldRole;
    const permissionRemoved =
      Array.isArray(updatePortalAdminDto.permissions) &&
      !nextPermissions.includes('*') &&
      oldPermissions.some((perm) => !nextPermissions.includes(perm));

    if (becameInactive || passwordChanged || roleChanged || permissionRemoved) {
      const adminRefreshService = this.getAdminRefreshService();
      if (adminRefreshService?.bumpTokenVersion) {
        updated.tokenVersion = adminRefreshService.bumpTokenVersion(id);
      } else {
        updated.tokenVersion = (updated.tokenVersion ?? 1) + 1;
      }
    }

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
    } catch (err: any) {
        console.warn('[portal-admins.service] Suppressed non-critical error:', err?.message || err);
      }

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

    const adminRefreshService = this.getAdminRefreshService();
    adminRefreshService?.bumpTokenVersion?.(id);
    adminRefreshService?.revokeAllForAdmin?.(id);

    try {
      this.auditService.log({
        action: 'admin-deleted',
        actor: 'Super User',
        target: targetAdmin ? targetAdmin.name || targetAdmin.email : `Admin #${id}`,
        entityType: 'portal_admin',
        entityId: id,
        event: `Super User erased admin account: "${targetAdmin ? targetAdmin.name : id}"`,
      });
    } catch (err: any) {
        console.warn('[portal-admins.service] Suppressed non-critical error:', err?.message || err);
      }
  }

  revokeSessions(id: string): { success: true; revoked: true; adminId: string; tokenVersion: number } {
    const portalAdmin = this.findById(id);
    const adminRefreshService = this.getAdminRefreshService();
    const resolved = portalAdmin || adminRefreshService?.resolveActiveAdmin?.(id);
    if (!resolved) {
      throw new NotFoundException(`Portal admin with id ${id} not found`);
    }
    const tokenVersion = adminRefreshService?.bumpTokenVersion?.(id) ?? ((portalAdmin?.tokenVersion ?? 1) + 1);
    if (portalAdmin) {
      portalAdmin.tokenVersion = tokenVersion;
    }
    try {
      this.auditService.log({
        action: 'admin-sessions-revoked',
        actor: 'Super User',
        target: portalAdmin?.name || portalAdmin?.email || resolved?.email || `Admin #${id}`,
        entityType: 'portal_admin',
        entityId: id,
        event: `Super User revoked all active sessions for admin "${portalAdmin?.name || id}"`,
      });
    } catch (err: any) {
      console.warn('[portal-admins.service] Suppressed non-critical error:', err?.message || err);
    }
    return { success: true, revoked: true, adminId: id, tokenVersion };
  }

  resetToSeed(): void {
    this.reset();
  }

  reset(): void {
    this.items.length = 0;
  }
}
