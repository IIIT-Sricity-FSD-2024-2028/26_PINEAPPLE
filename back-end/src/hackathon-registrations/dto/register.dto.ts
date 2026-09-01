import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class SubmitVerificationDto {
  @ApiProperty() @IsString() userId!: string;
  @ApiProperty() @IsString() college!: string;
  @ApiProperty() @IsInt() @Min(13) age!: number;
  @ApiProperty() @IsString() course!: string;
  @ApiProperty() @IsInt() @Min(1) year!: number;
  @ApiProperty() @IsString() studentId!: string;
  @ApiProperty() @IsString() idCardImage!: string;
}

export class VerifyStudentDto {
  @ApiProperty({ description: 'Admin user ID' }) @IsString() verifiedBy!: string;
}

export class RejectStudentDto {
  @ApiProperty({ description: 'Admin user ID' }) @IsString() verifiedBy!: string;
  @ApiProperty() @IsString() reason!: string;
}
