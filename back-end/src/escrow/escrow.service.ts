import { BadRequestException, Injectable } from '@nestjs/common';
import { BaseService } from '../common/abstracts/base.service';
import { EscrowAccountEntity, EscrowState } from './entities/escrow-account.entity';
import { FundEscrowDto } from './dto/fund-escrow.dto';

@Injectable()
export class EscrowService extends BaseService<EscrowAccountEntity> {
  fund(dto: FundEscrowDto): EscrowAccountEntity {
    return super.create({
      hackathonId: dto.hackathonId,
      prizeAmount: dto.prizeAmount,
      platformFee: dto.platformFee,
      gatewayFee: dto.gatewayFee,
      totalFunded: dto.prizeAmount + dto.platformFee + dto.gatewayFee,
      status: EscrowState.Funded,
      fundedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });
  }

  fundForSession(sessionId: string, amount: number): EscrowAccountEntity {
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

  findByHackathon(hackathonId: string): EscrowAccountEntity | undefined {
    return this.items.find((e) => e.hackathonId === hackathonId);
  }
}
