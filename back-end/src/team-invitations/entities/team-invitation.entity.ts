import { ApiProperty } from '@nestjs/swagger';

export class TeamInvitationEntity {
  @ApiProperty() id!: string;
  @ApiProperty() teamId!: string;
  @ApiProperty() invitedUserId!: string;
  @ApiProperty({ description: 'User ID of the team lead who sent the invite' }) invitedBy!: string;
  @ApiProperty({ enum: ['pending', 'accepted', 'declined'] }) status!: 'pending' | 'accepted' | 'declined';
  @ApiProperty() createdAt!: string;
}
