import { BadRequestException, Injectable } from '@nestjs/common';
import { BaseService } from '../common/abstracts/base.service';
import { HackathonRegistrationEntity } from './entities/hackathon-registration.entity';
import { RegisterParticipantDto } from './dto/register.dto';

@Injectable()
export class HackathonRegistrationsService extends BaseService<HackathonRegistrationEntity> {
  register(dto: RegisterParticipantDto): HackathonRegistrationEntity {
    const alreadyRegistered = this.items.find((r) => r.hackathonId === dto.hackathonId && r.userId === dto.userId);
    if (alreadyRegistered) {
      throw new BadRequestException('This user is already registered for this hackathon.');
    }
    return super.create({
      hackathonId: dto.hackathonId,
      userId: dto.userId,
      teamId: dto.teamId,
      role: dto.role,
      fullName: dto.fullName,
      collegeName: dto.collegeName,
      age: dto.age,
      idCardImageRef: dto.idCardImageRef,
      verificationStatus: 'pending',
      registeredAt: new Date().toISOString(),
    });
  }

  verify(id: string, verifiedBy: string): HackathonRegistrationEntity {
    return super.update(id, {
      verificationStatus: 'verified',
      verifiedBy,
      verifiedAt: new Date().toISOString(),
    });
  }

  reject(id: string, verifiedBy: string, reason?: string): HackathonRegistrationEntity {
    return super.update(id, {
      verificationStatus: 'rejected',
      verifiedBy,
      verifiedAt: new Date().toISOString(),
      rejectionReason: reason,
    });
  }

  findPending(): HackathonRegistrationEntity[] {
    return this.items.filter((r) => r.verificationStatus === 'pending');
  }

  findByHackathon(hackathonId: string): HackathonRegistrationEntity[] {
    return this.items.filter((r) => r.hackathonId === hackathonId);
  }

  findByTeam(teamId: string): HackathonRegistrationEntity[] {
    return this.items.filter((r) => r.teamId === teamId);
  }

  isVerified(hackathonId: string, userId: string): boolean {
    return this.items.some(
      (r) => r.hackathonId === hackathonId && r.userId === userId && r.verificationStatus === 'verified',
    );
  }
}
