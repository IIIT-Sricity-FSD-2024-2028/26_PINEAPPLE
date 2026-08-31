import { ApiProperty } from '@nestjs/swagger';

export class OrganizationEntity {
  @ApiProperty() id!: string;
  @ApiProperty({ description: 'Organization / company / institution name' }) name!: string;
  @ApiProperty({ description: 'Verified email domain, e.g. acme.com' }) domain!: string;
  @ApiProperty({ description: 'Billing / contact email' }) contactEmail!: string;
  @ApiProperty() createdAt!: string;
}

export class OrgMembershipEntity {
  @ApiProperty() id!: string;
  @ApiProperty() orgId!: string;
  @ApiProperty() userId!: string;
  @ApiProperty({ enum: ['org_admin', 'member'] }) orgRole!: 'org_admin' | 'member';
  @ApiProperty() joinedAt!: string;
}
