import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

const categories = ['Bug Report', 'Feature Request', 'Account Issue', 'Other'] as const;

type SupportCategory = (typeof categories)[number];

export class CreateSupportRequestDto {
  @ApiProperty({ description: 'Support request category', enum: categories })
  @IsString()
  @IsEnum(categories)
  category!: SupportCategory;

  @ApiProperty({ description: 'Subject for the support request', minLength: 5, maxLength: 100, required: false })
  @IsOptional()
  @IsString()
  @Length(5, 100)
  subject?: string;

  @ApiProperty({ description: 'Detailed support request message', minLength: 20, maxLength: 1000 })
  @IsString()
  @IsNotEmpty()
  @Length(20, 1000)
  message!: string;
}
