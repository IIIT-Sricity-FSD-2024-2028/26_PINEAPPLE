import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SuperUserDeleteUserDto {
  @ApiPropertyOptional({
    example: 'Account deleted by Super User following verified policy violation.',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
