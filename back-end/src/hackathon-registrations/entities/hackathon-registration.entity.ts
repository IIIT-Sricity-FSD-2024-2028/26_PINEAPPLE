import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// One row per participant (lead OR teammate) per hackathon. Platform Admin
// must verify this KYC before the participant is allowed to take part.
// NOTE: idCardImageRef is stored as a plain string reference/base64 here
// because this app is an in-memory demo with no real storage layer — a
// production system must never keep raw ID document images like this;
// they'd need encrypted, access-controlled storage (e.g. S3 + KMS), not a
// plain in-memory field.
export class HackathonRegistrationEntity {
  @ApiProperty() id!: string;
  @ApiProperty() hackathonId!: string;
  @ApiProperty() userId!: string;
  @ApiProperty() teamId!: string;
  @ApiProperty({ enum: ['lead', 'member'] }) role!: 'lead' | 'member';
  @ApiProperty() fullName!: string;
  @ApiProperty() collegeName!: string;
  @ApiProperty() age!: number;
  @ApiProperty({ description: 'Reference to the uploaded ID card image' }) idCardImageRef!: string;
  @ApiProperty({ enum: ['pending', 'verified', 'rejected'] }) verificationStatus!: 'pending' | 'verified' | 'rejected';
  @ApiPropertyOptional() verifiedBy?: string;
  @ApiPropertyOptional() verifiedAt?: string;
  @ApiPropertyOptional() rejectionReason?: string;
  @ApiProperty() registeredAt!: string;
}
