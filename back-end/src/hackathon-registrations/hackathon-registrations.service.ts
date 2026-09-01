import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BaseService } from '../common/abstracts/base.service';
import { StudentVerificationEntity, VerificationState } from './entities/hackathon-registration.entity';
import { SubmitVerificationDto } from './dto/register.dto';

@Injectable()
export class HackathonRegistrationsService extends BaseService<StudentVerificationEntity> {
  
  submitVerification(dto: SubmitVerificationDto): StudentVerificationEntity {
    // Check if verification already exists for user
    const existing = this.items.find(v => v.userId === dto.userId);
    if (existing) {
      if (existing.status === VerificationState.Verified) {
        throw new BadRequestException('User is already verified');
      }
      if (existing.status === VerificationState.Pending) {
        throw new BadRequestException('Verification is already pending');
      }
      
      // Resubmit
      return super.update(existing.id, {
        college: dto.college,
        age: dto.age,
        course: dto.course,
        year: dto.year,
        studentId: dto.studentId,
        idCardImage: dto.idCardImage,
        status: VerificationState.Pending,
        submittedAt: new Date().toISOString(),
        adminNote: undefined
      });
    }

    return super.create({
      userId: dto.userId,
      college: dto.college,
      age: dto.age,
      course: dto.course,
      year: dto.year,
      studentId: dto.studentId,
      idCardImage: dto.idCardImage,
      status: VerificationState.Pending,
      submittedAt: new Date().toISOString(),
    });
  }

  verify(id: string, verifiedBy: string): StudentVerificationEntity {
    const record = this.findOne(id);
    if (record.status === VerificationState.Verified) {
      throw new BadRequestException('Already verified');
    }
    return super.update(id, {
      status: VerificationState.Verified,
      verifiedBy,
      verifiedAt: new Date().toISOString(),
    });
  }

  reject(id: string, verifiedBy: string, reason: string): StudentVerificationEntity {
    const record = this.findOne(id);
    return super.update(id, {
      status: VerificationState.Rejected, // or ResubmitRequired
      verifiedBy,
      adminNote: reason,
      verifiedAt: new Date().toISOString(),
    });
  }
  
  getPendingVerifications(): StudentVerificationEntity[] {
    return this.items.filter((r) => r.status === VerificationState.Pending);
  }
  
  findByUserId(userId: string): StudentVerificationEntity | undefined {
    return this.items.find((r) => r.userId === userId);
  }
}
