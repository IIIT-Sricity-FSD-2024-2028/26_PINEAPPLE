import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ReportStatus {
  Open = 'Open',
  Resolved = 'Resolved',
}

export class CreateReportDto {
  @ApiProperty({ example: '3' })
  @IsString()
  @IsNotEmpty()
  targetUserId: string;

  @ApiProperty({ example: 'Refusing to communicate and abandoning tasks.' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
