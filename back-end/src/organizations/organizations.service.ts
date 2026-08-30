import { Injectable } from '@nestjs/common';

@Injectable()
export class OrganizationsService {
  create(createOrganizationDto: any) {
    return 'This action adds a new organization';
  }

  findAll() {
    return `This action returns all organizations`;
  }

  findOne(id: number) {
    return `This action returns a #${id} organization`;
  }

  addMember(id: number, memberDto: any) {
    return `This action adds a member to organization #${id}`;
  }
}
