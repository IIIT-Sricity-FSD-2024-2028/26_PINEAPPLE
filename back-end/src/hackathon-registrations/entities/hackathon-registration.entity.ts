import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum VerificationState {
  Pending = 'Pending',
  ResubmitRequired = 'ResubmitRequired',
  Verified = 'Verified',
  Rejected = 'Rejected'
}

export class StudentVerificationEntity {
  @ApiProperty() id!: string;
  @ApiProperty() userId!: string;
  @ApiProperty() college!: string;
  @ApiProperty() age!: number;
  @ApiProperty() course!: string;
  @ApiProperty() year!: number;
  @ApiProperty() studentId!: string;
  @ApiProperty({ description: 'ID Card image URL/Ref' }) idCardImage!: string;
  
  @ApiProperty({ enum: VerificationState }) status!: VerificationState;
  @ApiPropertyOptional() adminNote?: string;
  
  @ApiProperty() submittedAt!: string;
  @ApiPropertyOptional() verifiedAt?: string;
  @ApiPropertyOptional() verifiedBy?: string;
}
