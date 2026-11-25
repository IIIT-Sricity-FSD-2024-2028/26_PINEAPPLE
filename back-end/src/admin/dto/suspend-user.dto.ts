import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class SuspendUserDto {
  @ApiProperty({ description: 'Reason for suspending the user (at least 10 characters)', minLength: 10 })
  @IsString()
  @IsNotEmpty()
  @MinLength(10, { message: 'Explanation must be at least 10 characters.' })
  reason!: string;
}
