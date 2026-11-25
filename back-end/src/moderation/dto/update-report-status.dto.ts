import { IsIn, IsOptional, IsString } from 'class-validator';
import { ReportStatus } from '../entities/report.entity';

export class UpdateReportStatusDto {
  @IsString()
  @IsIn(['Open', 'Under review', 'Resolved', 'Dismissed'])
  status!: ReportStatus;

  @IsOptional()
  @IsString()
  note?: string;
}
