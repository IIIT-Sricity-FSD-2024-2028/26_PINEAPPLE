import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiPropertyOptional({ description: 'Optional refresh token if cookies are not used' })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
