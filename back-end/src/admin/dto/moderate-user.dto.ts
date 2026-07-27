import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { UserStatus } from '../../users/dto/create-user.dto';

export class ModerateUserDto {
  @ApiProperty({
    description: 'New moderation status for the user',
    enum: UserStatus,
  })
  @IsEnum(UserStatus)
  status!: UserStatus;
}
