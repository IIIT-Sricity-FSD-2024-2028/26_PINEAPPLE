import { IsString, IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ResolutionAction {
  Warn = 'Warn',
  Suspend = 'Suspend',
  Dismiss = 'Dismiss',
}

export class ResolveReportDto {
  @ApiProperty({ enum: ResolutionAction, example: ResolutionAction.Warn })
  @IsEnum(ResolutionAction)
  action: ResolutionAction;

  @ApiProperty({ example: 'Issued a formal warning and deducted 50 Rep Score.' })
  @IsString()
  @IsNotEmpty()
  resolution: string;
}
