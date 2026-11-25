import { IsIn, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ActionReportDto {
  @IsString()
  @IsIn(['warn', 'suspend', 'dismiss'])
  action!: 'warn' | 'suspend' | 'dismiss';

  @IsString()
  @IsNotEmpty()
  @MinLength(10, { message: 'Action reason must be at least 10 characters.' })
  @MaxLength(500, { message: 'Action reason cannot exceed 500 characters.' })
  reason!: string;
}
