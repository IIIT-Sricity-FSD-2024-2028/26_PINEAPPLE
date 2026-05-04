import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserProfile {
  @ApiProperty({ description: 'Full name of the user' })
  fullName!: string;

  @ApiProperty({ description: 'Unique username (lowercase)' })
  username!: string;

  @ApiPropertyOptional({ description: 'User biography' })
  bio?: string;

  @ApiPropertyOptional({ description: 'LinkedIn profile URL' })
  linkedin?: string;

  @ApiPropertyOptional({ description: 'Phone number (redundant with main phone)' })
  phone?: string;

  @ApiProperty({ description: 'Experience points earned', default: 0 })
  xp!: number;

  @ApiProperty({ description: 'Reputation score', default: 0 })
  rep!: number;

  @ApiProperty({ description: 'Array of skill tags', type: [String] })
  skills!: string[];

  @ApiProperty({ description: 'Whether mentor features are unlocked', default: false })
  mentorUnlocked!: boolean;
}

export class UserData {
  @ApiProperty({ description: 'User projects', type: [Object] })
  projects!: any[];

  @ApiProperty({ description: 'User notifications', type: [Object] })
  notifications!: any[];

  @ApiProperty({ description: 'Pending join requests', type: [Object] })
  requests!: any[];

  @ApiPropertyOptional({ description: 'Administrative warnings issued to the user', type: [Object] })
  warnings?: any[];
}

export class UserEntity {
  @ApiProperty({ description: 'Unique identifier for the user' })
  id!: string;

  @ApiProperty({ description: 'Email address of the user' })
  email!: string;

  @ApiProperty({ description: 'Full name of the user' })
  name!: string;

  @ApiProperty({ description: 'Hashed password' })
  password!: string;

  @ApiPropertyOptional({ description: 'Phone number (India format: 10 digits)' })
  phone?: string;

  @ApiProperty({ description: 'User status', enum: ['active', 'suspended', 'flagged', 'banned'], default: 'active' })
  status!: 'active' | 'suspended' | 'flagged' | 'banned';

  @ApiProperty({ description: 'User role for RBAC', enum: ['collaborator', 'project-owner', 'mentor', 'admin', 'superuser'] })
  role!: 'collaborator' | 'project-owner' | 'mentor' | 'admin' | 'superuser';

  @ApiProperty({ description: 'User profile information', type: UserProfile })
  profile!: UserProfile;

  @ApiProperty({ description: 'User data and relationships', type: UserData })
  data!: UserData;
}
