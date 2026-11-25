import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ResetDemoDto {
  @ApiProperty({
    example: 'RESET',
    description: 'Must equal exact string "RESET" to trigger full demo data reset.',
  })
  @IsOptional()
  @IsString()
  confirm?: string;
}
