import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsArray, IsPositive, IsOptional, Min } from 'class-validator';

export class CreatePromotionPlanDto {
  @ApiProperty({ description: 'Plan name (e.g. Basic Promotion)' })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Price in INR' })
  @IsNumber()
  @IsPositive()
  price!: number;

  @ApiProperty({ description: 'Duration in days' })
  @IsNumber()
  @Min(1)
  duration!: number;

  @ApiProperty({ description: 'Array of features included in the plan' })
  @IsArray()
  features!: string[];

  @ApiProperty({ description: 'Visibility boost level' })
  @IsString()
  visibilityBoost!: 'Standard' | 'High' | 'Maximum';

  @ApiPropertyOptional({ description: 'Estimated student reach' })
  @IsOptional()
  @IsNumber()
  estimatedReach?: number;
}

export class PurchasePromotionDto {
  @ApiProperty({ description: 'Hackathon ID to promote' })
  @IsString()
  hackathonId!: string;

  @ApiProperty({ description: 'Promotion plan ID' })
  @IsString()
  planId!: string;

  @ApiProperty({ description: 'Organizer/host user ID' })
  @IsString()
  purchasedBy!: string;

  @ApiPropertyOptional({ description: 'Payment transaction ID' })
  @IsOptional()
  @IsString()
  transactionId?: string;
}

export class AnalyticsDto {
  @ApiProperty({ description: 'Hackathon ID' })
  @IsString()
  hackathonId!: string;
}
