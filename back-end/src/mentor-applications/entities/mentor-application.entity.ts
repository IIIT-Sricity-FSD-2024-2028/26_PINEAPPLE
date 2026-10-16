import { ApiProperty } from '@nestjs/swagger';

export type MentorApplicationStatus = 'pending' | 'approved' | 'rejected';

export class MentorApplicationEntity {
  @ApiProperty({ description: 'Unique application identifier', example: '0f8fad5b-d9cb-469f-a165-70867728950e' })
  id!: string;

  @ApiProperty({ description: 'User ID of the applicant', example: 'c9b1d92a-a73f-4a4c-8b0f-2d2f78a8de12' })
  userId!: string;

  @ApiProperty({ description: 'Applicant email address', example: 'mentor@example.com' })
  email!: string;

  @ApiProperty({ description: 'Applicant full name', example: 'Riya Sharma' })
  name!: string;

  @ApiProperty({ description: 'Applicant biography or motivation statement', example: 'Experienced software developer with 7 years mentoring students.' })
  bio?: string;

  @ApiProperty({ description: 'Applicant experience summary', example: '7 years in full-stack development and mentoring.' })
  experience?: string;

  @ApiProperty({ description: 'Years of professional experience', example: 5 })
  years?: number;

  @ApiProperty({ description: 'Years of professional experience', example: 5 })
  yearsOfExperience?: number;

  @ApiProperty({ description: 'Applicant LinkedIn URL', example: 'https://linkedin.com/in/mentor' })
  linkedin?: string;

  @ApiProperty({ description: 'Applicant portfolio URL', example: 'https://portfolio.dev' })
  portfolio?: string;

  @ApiProperty({ description: 'Applicant motivation statement', example: 'I enjoy mentoring...' })
  motivation?: string;

  @ApiProperty({ description: 'Area of expertise', example: 'React, Node.js' })
  expertise?: string;

  @ApiProperty({ description: 'University or institution', example: 'Stanford University' })
  university?: string;

  @ApiProperty({ description: 'Skills or expertise offered by the applicant', example: ['JavaScript', 'Node.js', 'React'] })
  skills?: string[];

  @ApiProperty({ description: 'Current application status', enum: ['pending', 'approved', 'rejected'], example: 'pending' })
  status!: MentorApplicationStatus;

  @ApiProperty({ description: 'ISO timestamp when the application was submitted', example: '2026-04-23T12:34:56.789Z' })
  applicationDate!: string;
}
