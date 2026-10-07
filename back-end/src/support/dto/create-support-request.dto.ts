import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

const categories = ['Bug Report', 'Feature Request', 'Account Issue', 'Other'] as const;

type SupportCategory = (typeof categories)[number];

export class CreateSupportRequestDto {
  @ApiProperty({ description: 'Support request category', enum: categories })
  @IsString()
  @IsNotEmpty()
  category!: string;

  @ApiProperty({ description: 'Subject for the support request', required: false })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiProperty({ description: 'Detailed support request message' })
  @IsString()
  @IsNotEmpty()
  message!: string;
}
