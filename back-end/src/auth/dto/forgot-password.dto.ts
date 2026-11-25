import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'aditya@example.com',
    description: 'User email or username',
  })
  @IsString()
  @IsNotEmpty()
  identifier: string;
}
