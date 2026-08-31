import { Injectable, ForbiddenException } from '@nestjs/common';
import { BaseService } from '../common/abstracts/base.service';
import { OrganizationEntity, OrgMembershipEntity } from './entities/organization.entity';
import { CreateOrganizationDto } from './dto/organization.dto';

// Lean Organization module: exists so a Hackathon has a real "host" identity
// (a company/institution) instead of a bare user id. Billing/subscription
// tiers are out of scope here — this only backs hackathon hosting.
@Injectable()
export class OrganizationsService extends BaseService<OrganizationEntity> {
  private memberships: OrgMembershipEntity[] = [];

  registerOrganization(dto: CreateOrganizationDto): OrganizationEntity {
    const org = super.create({
      name: dto.name,
      domain: dto.domain,
      contactEmail: dto.contactEmail,
      createdAt: new Date().toISOString(),
    });
    this.memberships.push({
      id: `${org.id}:${dto.orgAdminUserId}`,
      orgId: org.id,
      userId: dto.orgAdminUserId,
      orgRole: 'org_admin',
      joinedAt: new Date().toISOString(),
    });
    return org;
  }

  isOrgAdmin(orgId: string, userId: string): boolean {
    return this.memberships.some((m) => m.orgId === orgId && m.userId === userId && m.orgRole === 'org_admin');
  }

  // Every hackathon-hosting action must call this — throws if the caller
  // isn't actually an admin of the org they claim to be hosting for
  // (tenant isolation: an Org Admin can only act for their own org).
  assertOrgAdmin(orgId: string, userId: string): void {
    this.findOne(orgId); // 404s if org doesn't exist
    if (!this.isOrgAdmin(orgId, userId)) {
      throw new ForbiddenException('Only an Org Admin of this organization can perform this action.');
    }
  }

  getOrgsForUser(userId: string): OrgMembershipEntity[] {
    return this.memberships.filter((m) => m.userId === userId);
  }

  getMembers(orgId: string): OrgMembershipEntity[] {
    return this.memberships.filter((m) => m.orgId === orgId);
  }
}
