import { IsBoolean, IsOptional, IsString, Length, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUsernameDto {
  @ApiPropertyOptional({ example: 'new_username' })
  @IsOptional()
  @IsString()
  @Length(3, 30, { message: 'Username must be between 3 and 30 characters.' })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Username must contain only letters, numbers, underscores, and hyphens.',
  })
  username?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  confirm?: boolean;
}
