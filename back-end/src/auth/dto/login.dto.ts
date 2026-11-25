import { IsString, IsNotEmpty, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiPropertyOptional({ example: 'aditya@example.com' })
  @IsString()
  @IsOptional()
  identifier?: string;

  @ApiPropertyOptional({ example: 'aditya@example.com' })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: 'aditya' })
  @IsString()
  @IsOptional()
  username?: string;

  @ApiProperty({ example: 'password123' })
  @IsString({ message: 'Password is required.' })
  @IsNotEmpty({ message: 'Password is required.' })
  @Matches(/\S/, { message: 'Password is required.' })
  password: string;
}
