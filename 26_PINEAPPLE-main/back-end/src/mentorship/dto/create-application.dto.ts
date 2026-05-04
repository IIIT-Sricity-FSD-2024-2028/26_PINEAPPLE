import { IsString, IsNumber, IsUrl, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ApplicationStatus {
  Pending = 'Pending',
  Approved = 'Approved',
  Rejected = 'Rejected',
}

export class CreateApplicationDto {
  @ApiProperty({ example: 'https://linkedin.com/in/johndoe' })
  @IsUrl()
  @IsNotEmpty()
  linkedinURL: string;

  @ApiProperty({ example: 5 })
  @IsNumber()
  experienceYears: number;

  @ApiProperty({ example: 'I want to help students build production-ready apps.' })
  @IsString()
  @IsNotEmpty()
  motivation: string;
}
