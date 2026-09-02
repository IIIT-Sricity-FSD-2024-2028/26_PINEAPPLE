import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsOptional,
  IsPositive, IsString, Max, Min,
} from 'class-validator';

// ── Create mentor listing (only approved Mentors can call this) ─────────────
export class CreateMentorProfileDto {
  @ApiProperty() @IsString() name!: string;
  @ApiPropertyOptional({ description: 'Emoji avatar, e.g. 🧑‍💻' }) @IsOptional() @IsString() avatar?: string;
  @ApiProperty({ description: 'Professional title' }) @IsString() title!: string;
  @ApiProperty() @IsString() bio!: string;
  @ApiProperty({ type: [String] }) @IsArray() @IsString({ each: true }) skills!: string[];
  @ApiProperty({ description: 'Years of experience' }) @IsInt() @Min(0) experienceYears!: number;
  @ApiProperty({ description: 'Session price in INR' }) @IsNumber() @IsPositive() sessionPrice!: number;
  @ApiProperty({ enum: [30, 60, 90], description: 'Session duration in minutes' }) @IsInt() sessionDuration!: number;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() languages?: string[];
  @ApiProperty({ enum: ['Weekdays', 'Weekends', 'Anytime'] })
  @IsEnum(['Weekdays', 'Weekends', 'Anytime']) availability!: string;
}

// ── Book a session (student) ─────────────────────────────────────────────────
export class BookSessionDto {
  @ApiProperty({ description: 'Mentor profile ID' }) @IsString() mentorId!: string;
  @ApiProperty({ description: 'What you need help with' }) @IsString() projectDescription!: string;
  @ApiProperty({ description: 'ID of the project owner\'s project this booking is for' }) @IsString() projectId!: string;
}

// ── Edit an existing mentor listing ──────────────────────────────────────────
export class UpdateMentorProfileDto extends PartialType(CreateMentorProfileDto) {}

// ── Submit a review (student after completion) ───────────────────────────────
export class SubmitReviewDto {
  @ApiProperty({ minimum: 1, maximum: 5 }) @IsInt() @Min(1) @Max(5) rating!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() comment?: string;
}

// ── Toggle availability (mentor) ────────────────────────────────────────────
export class UpdateAvailabilityDto {
  @ApiProperty() @IsBoolean() isAvailable!: boolean;
}

// ── Filter/sort query params ─────────────────────────────────────────────────
export class FilterMentorsDto {
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional({ type: [String], isArray: true }) @IsOptional() skills?: string | string[];
  @ApiPropertyOptional() @IsOptional() minPrice?: number;
  @ApiPropertyOptional() @IsOptional() maxPrice?: number;
  @ApiPropertyOptional() @IsOptional() minExp?: number;
  @ApiPropertyOptional({ enum: ['Weekdays', 'Weekends', 'Anytime'] }) @IsOptional() availability?: string;
  @ApiPropertyOptional() @IsOptional() minRating?: number;
  @ApiPropertyOptional({
    enum: ['price_asc', 'price_desc', 'rating', 'sessions'],
    description: 'Sort order',
  }) @IsOptional() sort?: string;
}
