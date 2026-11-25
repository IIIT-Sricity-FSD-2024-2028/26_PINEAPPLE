import { IsIn, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { ReportReason } from '../entities/report.entity';

export const VALID_REPORT_REASONS: ReportReason[] = [
  'Harassment',
  'Spam',
  'Cheating or plagiarism',
  'Fake proof',
  'Abandoned work',
  'Inappropriate content',
  'Other',
];

export class CreateReportDto {
  @IsString()
  @IsNotEmpty()
  reportedUserId!: string;

  @IsString()
  @IsIn(VALID_REPORT_REASONS, {
    message: 'Reason must be one of: Harassment, Spam, Cheating or plagiarism, Fake proof, Abandoned work, Inappropriate content, Other',
  })
  reason!: ReportReason;

  @IsString()
  @MinLength(20, { message: 'Report details must be at least 20 characters.' })
  @MaxLength(1000, { message: 'Report details cannot exceed 1000 characters.' })
  details!: string;
}
