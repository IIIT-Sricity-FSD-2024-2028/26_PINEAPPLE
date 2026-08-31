import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsInt, IsNumber, IsOptional, IsPositive, IsString, Min } from 'class-validator';

export class CreateHackathonDto {
  @ApiProperty({ description: 'Hosting Organization ID' }) @IsString() orgId!: string;
  @ApiProperty({ description: 'Org Admin user ID creating this hackathon' }) @IsString() createdBy!: string;
  @ApiProperty() @IsString() title!: string;
  @ApiProperty() @IsString() description!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() theme?: string;
  @ApiProperty() @IsString() eligibilityCriteria!: string;
  @ApiProperty() @IsInt() @Min(1) teamSizeMin!: number;
  @ApiProperty() @IsInt() @Min(1) teamSizeMax!: number;
  @ApiProperty() @IsNumber() @IsPositive() prizePool!: number;
  @ApiPropertyOptional({ type: [Number], default: [50, 30, 20], description: '1st/2nd/3rd split %, must sum to 100' })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(3)
  prizeSplit?: number[];
  @ApiProperty({ description: 'ISO date-time' }) @IsString() registrationDeadline!: string;
}

export class RegisterLeadDto {
  @ApiProperty() @IsString() userId!: string;
  @ApiProperty() @IsString() teamName!: string;
  @ApiProperty() @IsString() fullName!: string;
  @ApiProperty() @IsString() collegeName!: string;
  @ApiProperty() @IsInt() @Min(13) age!: number;
  @ApiProperty() @IsString() idCardImageRef!: string;
}

export class ScoreTeamDto {
  @ApiProperty({ description: 'Org Admin / host user ID scoring the team' }) @IsString() scoredBy!: string;
  @ApiProperty({ minimum: 1, maximum: 10 }) @IsNumber() @Min(1) score!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() comment?: string;
}

export class CloseHackathonDto {
  @ApiProperty({ description: 'Org Admin / host user ID closing the hackathon' }) @IsString() closedBy!: string;
}
