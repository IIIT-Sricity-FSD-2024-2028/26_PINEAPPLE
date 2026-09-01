import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsInt, IsNumber, IsOptional, IsPositive, IsString, Min } from 'class-validator';

export class CreateHackathonDto {
  @ApiProperty({ description: 'Host/Org ID' }) @IsString() orgId!: string;
  @ApiProperty() @IsString() name!: string;
  @ApiProperty() @IsString() description!: string;
  
  @ApiPropertyOptional() @IsOptional() @IsString() theme?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() eligibility?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() rules?: string;
  
  @ApiPropertyOptional({ enum: ['Online', 'Offline', 'Hybrid'], default: 'Online' })
  @IsOptional() @IsEnum(['Online', 'Offline', 'Hybrid']) mode?: 'Online' | 'Offline' | 'Hybrid';

  @ApiPropertyOptional() @IsOptional() @IsString() location?: string;

  @ApiProperty() @IsInt() @Min(1) minTeamSize!: number;
  @ApiProperty() @IsInt() @Min(1) maxTeamSize!: number;
  
  @ApiProperty() @IsNumber() @IsPositive() totalPrizePool!: number;
  
  // ISO strings for registration and event
  @ApiProperty({ description: 'Registration close date (ISO string)' }) @IsString() registrationClose!: string;
  @ApiPropertyOptional({ description: 'Event start date (ISO string)' }) @IsOptional() @IsString() eventStart?: string;
  @ApiPropertyOptional({ description: 'Event end date (ISO string)' }) @IsOptional() @IsString() eventEnd?: string;

  // Display / frontend fields
  @ApiPropertyOptional({ description: 'Emoji logo' }) @IsOptional() @IsString() logo?: string;
  @ApiPropertyOptional({ description: 'Display name of the organizing entity' }) @IsOptional() @IsString() organizer?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() technologies?: string[];

  // Promotion plan selected at creation time (optional)
  @ApiPropertyOptional({ description: 'Promotion plan ID to purchase after creation' })
  @IsOptional() @IsString() promotionPlanId?: string;
}

export class RegisterLeadDto {
  @ApiProperty() @IsString() userId!: string;
  @ApiProperty() @IsString() teamName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() college?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() studentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() idCardImage?: string;
}

export class ScoreTeamDto {
  @ApiProperty({ description: 'User ID scoring the team' }) @IsString() scoredBy!: string;
  @ApiProperty({ description: 'Score 1-100' }) @IsNumber() score!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() comment?: string;
}

export class CloseHackathonDto {
  @ApiProperty({ description: 'User ID closing the hackathon' }) @IsString() closedBy!: string;
}
