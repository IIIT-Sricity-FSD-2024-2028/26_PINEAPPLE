import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateReplyDto {
  @ApiProperty({ description: 'Reply body (1 to 2000 characters)' })
  @IsString()
  @IsNotEmpty()
  body!: string;

  @ApiPropertyOptional({ description: 'Mark reply as internal admin-only note', default: false })
  @IsOptional()
  @IsBoolean()
  internal?: boolean;
}
