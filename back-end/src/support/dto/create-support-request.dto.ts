import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

const categories = [
  'Bug Report',
  'Feature Request',
  'Account Issue',
  'Project Closure Request',
  'Help Inquiry',
  'Other',
] as const;

export class CreateSupportRequestDto {
  @ApiPropertyOptional({ description: 'Ticket type (only "help" can be created by users)', enum: ['help', 'project_closure'] })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'Support request category', enum: categories })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Subject for the support request (5 to 120 characters)' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiProperty({ description: 'Detailed support request message (10 to 2000 characters)' })
  @IsString()
  @IsNotEmpty()
  message!: string;

  @ApiPropertyOptional({ description: 'Priority level', enum: ['low', 'normal', 'high'] })
  @IsOptional()
  @IsIn(['low', 'normal', 'high'])
  priority?: 'low' | 'normal' | 'high';

  @ApiPropertyOptional({ description: 'Visitor email address (required when unauthenticated)' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Previous resolved/rejected ticket ID when submitting a follow-up' })
  @IsOptional()
  @IsString()
  parentTicketId?: string;
}
