import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { UserStatus } from '../../users/dto/create-user.dto';

export class ModerateUserDto {
  @ApiProperty({
    description: 'New moderation status for the user',
    enum: UserStatus,
  })
  @IsEnum(UserStatus)
  status!: UserStatus;

  @ApiPropertyOptional({
    description: 'Explanation for status change (at least 10 characters required for suspend/reactivate)',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
