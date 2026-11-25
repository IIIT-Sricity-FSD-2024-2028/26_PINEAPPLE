import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CloseProjectTicketDto {
  @ApiProperty({ description: 'Administrative reason for closing project from support ticket (10 to 500 chars)' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
