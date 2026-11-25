import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyPhoneDto {
  @ApiProperty({
    description: 'Firebase Phone Auth ID Token obtained after SMS OTP confirmation',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjEyMzQ1Ni...789',
  })
  @IsString()
  @IsNotEmpty({ message: 'idToken is required' })
  idToken!: string;
}
