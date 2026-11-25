import { BadRequestException, Injectable } from '@nestjs/common';
import { BaseService } from '../common/abstracts/base.service';
import { EscrowAccountEntity, EscrowState } from './entities/escrow-account.entity';

@Injectable()
export class EscrowService extends BaseService<EscrowAccountEntity> {
  fundForSession(sessionId: string, amount: number): EscrowAccountEntity {
    const existing = this.findAll().find((e) => e.mentorSessionId === sessionId);
    if (existing) {
      throw new BadRequestException(`Escrow already funded for session ${sessionId}`);
    }
    const platformFee = Math.round(amount * 0.15); // 15% platform cut
    const gatewayFee = Math.round(amount * 0.02);  // 2% gateway fee
    return super.create({
      mentorSessionId: sessionId,
      prizeAmount: amount,
      platformFee,
      gatewayFee,
      totalFunded: amount + platformFee + gatewayFee,
      status: EscrowState.Funded,
      fundedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });
  }


  getCurrentlyHeldTotal(): number {
    return this.findAll()
      .filter((e) => e.status === EscrowState.Funded || e.status === EscrowState.Disputed)
      .reduce((sum, e) => sum + (e.totalFunded || 0), 0);
  }

  freezeForDispute(id: string): EscrowAccountEntity {
    const escrow = this.findOne(id);
    if (escrow.status === EscrowState.Disputed) {
      return escrow;
    }
    if (escrow.status !== EscrowState.Funded) {
      throw new BadRequestException(`Escrow ${id} cannot be disputed from status '${escrow.status}'`);
    }
    return super.update(id, { status: EscrowState.Disputed });
  }

  split(
    id: string,
    mentorPayout: number,
    platformFee: number,
    refundAmount: number,
  ): EscrowAccountEntity {
    const escrow = this.findOne(id);
    if (escrow.status !== EscrowState.Funded && escrow.status !== EscrowState.Disputed) {
      throw new BadRequestException(`Escrow ${id} cannot be split from status '${escrow.status}'`);
    }
    return super.update(id, {
      status: EscrowState.Distributed,
      distributedAt: new Date().toISOString(),
      splitMentorPayout: mentorPayout,
      splitPlatformFee: platformFee,
      splitRefundAmount: refundAmount,
    });
  }

  release(id: string): EscrowAccountEntity {
    const escrow = this.findOne(id);
    if (escrow.status !== EscrowState.Funded && escrow.status !== EscrowState.Disputed) {
      throw new BadRequestException(`Escrow ${id} cannot be released from status '${escrow.status}'`);
    }
    return super.update(id, { status: EscrowState.Distributed, distributedAt: new Date().toISOString() });
  }

  refund(id: string): EscrowAccountEntity {
    const escrow = this.findOne(id);
    if (escrow.status !== EscrowState.Funded && escrow.status !== EscrowState.Disputed) {
      throw new BadRequestException(`Escrow ${id} cannot be refunded from status '${escrow.status}'`);
    }
    return super.update(id, { status: EscrowState.Refunded });
  }

  resetToSeed(): void {
    this.reset();
  }

  reset(): void {
    this.items.length = 0;
  }
}
