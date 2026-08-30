import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class OrganizationsService {
  // In-memory data store for Organizations
  private organizations = [
    { id: 'org-1', name: 'Acme Corp', tier: 'Enterprise', members: 120, status: 'Active' },
    { id: 'org-2', name: 'Global Tech', tier: 'Pro', members: 45, status: 'Active' },
    { id: 'org-3', name: 'Startup Inc', tier: 'Starter', members: 8, status: 'Suspended' },
    { id: 'org-4', name: 'Innovate AI', tier: 'Enterprise', members: 85, status: 'Active' },
  ];

  async findAll() {
    return this.organizations;
  }

  async findById(id: string) {
    const org = this.organizations.find(o => o.id === id);
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    return org;
  }

  async create(data: any) {
    const newOrg = {
      id: `org-${this.organizations.length + 1}`,
      name: data.name || 'New Organization',
      tier: data.tier || 'Starter',
      members: data.members || 1,
      status: 'Active',
    };
    this.organizations.push(newOrg);
    return newOrg;
  }

  async updateStatus(id: string, status: string) {
    const org = await this.findById(id);
    org.status = status;
    return org;
  }
}
