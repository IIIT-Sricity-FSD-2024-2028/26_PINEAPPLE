import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export class ModerateUserDto {
  @ApiProperty({
    description: 'New moderation status for the user',
    enum: ['active', 'suspended', 'flagged', 'banned'],
  })
  @IsString()
  @IsIn(['active', 'suspended', 'flagged', 'banned'])
  status!: 'active' | 'suspended' | 'flagged' | 'banned';
}
