import { IsString, IsNotEmpty, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdminLoginDto {
  @ApiPropertyOptional({ example: 'admin@teamforge.io' })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: 'admin@teamforge.io' })
  @IsString()
  @IsOptional()
  identifier?: string;

  @ApiProperty({ example: 'admin123' })
  @IsString({ message: 'Password is required.' })
  @IsNotEmpty({ message: 'Password is required.' })
  @Matches(/\S/, { message: 'Password is required.' })
  password!: string;
}
