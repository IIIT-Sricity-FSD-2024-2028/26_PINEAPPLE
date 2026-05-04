import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class WarnUserDto {
  @ApiProperty({ description: 'Reason for warning the user' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
