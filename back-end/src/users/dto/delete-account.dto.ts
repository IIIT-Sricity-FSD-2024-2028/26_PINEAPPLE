import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class DeleteAccountDto {
  @ApiPropertyOptional({
    example: 'arjunsharma',
    description: 'Confirmation string that must match the caller username',
  })
  @IsOptional()
  @IsString()
  username?: string;
}
