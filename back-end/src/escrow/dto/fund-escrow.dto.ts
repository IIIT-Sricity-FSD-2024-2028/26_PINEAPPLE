import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class FundEscrowDto {
  @ApiProperty() @IsString() hackathonId!: string;
  @ApiProperty() @IsNumber() @IsPositive() prizeAmount!: number;
  @ApiProperty() @IsNumber() @IsPositive() platformFee!: number;
  @ApiProperty() @IsNumber() @IsPositive() gatewayFee!: number;
  @ApiProperty() @IsString() releaseCondition!: string;
}
