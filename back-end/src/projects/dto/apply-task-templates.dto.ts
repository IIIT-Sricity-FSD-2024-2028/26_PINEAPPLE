import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsObject, IsOptional, IsString } from 'class-validator';

export class ApplyTaskTemplatesDto {
  @ApiProperty({ type: [String], example: ['web-repo-readme', 'web-main-screens'] })
  @IsArray()
  @ArrayNotEmpty({ message: 'Select at least one starter task template key to apply.' })
  @IsString({ each: true })
  keys!: string[];

  @ApiPropertyOptional({
    description: 'Optional title/description overrides keyed by template key',
    example: { 'web-repo-readme': { title: 'Set up TeamForge web repo and docs' } },
  })
  @IsOptional()
  @IsObject()
  overrides?: Record<string, { title?: string; description?: string }>;
}
