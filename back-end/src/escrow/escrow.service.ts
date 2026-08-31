import { BadRequestException, Injectable } from '@nestjs/common';
import { BaseService } from '../common/abstracts/base.service';
import { EscrowAccountEntity } from './entities/escrow-account.entity';
import { FundEscrowDto } from './dto/fund-escrow.dto';

// Escrow lifecycle: funded -> released | refunded | disputed.
// A hackathon's prize pool is funded here the instant the host creates and
// publishes the hackathon; funds only move (release/refund) via an explicit
// TRANSACTION recorded by the caller (payouts/), never a silent balance edit.
@Injectable()
export class EscrowService extends BaseService<EscrowAccountEntity> {
  fund(dto: FundEscrowDto): EscrowAccountEntity {
    return super.create({
      sourceType: dto.sourceType,
      sourceId: dto.sourceId,
      heldAmount: dto.amount,
      currency: dto.currency ?? 'INR',
      status: 'funded',
      fundedAt: new Date().toISOString(),
      releaseCondition: dto.releaseCondition,
    });
  }

  release(id: string): EscrowAccountEntity {
    const escrow = this.findOne(id);
    if (escrow.status !== 'funded' && escrow.status !== 'disputed') {
      throw new BadRequestException(`Escrow ${id} cannot be released from status '${escrow.status}'`);
    }
    return super.update(id, { status: 'released', releasedAt: new Date().toISOString() });
  }

  refund(id: string): EscrowAccountEntity {
    const escrow = this.findOne(id);
    if (escrow.status !== 'funded' && escrow.status !== 'disputed') {
      throw new BadRequestException(`Escrow ${id} cannot be refunded from status '${escrow.status}'`);
    }
    return super.update(id, { status: 'refunded', releasedAt: new Date().toISOString() });
  }

  findBySource(sourceType: string, sourceId: string): EscrowAccountEntity | undefined {
    return this.items.find((e) => e.sourceType === sourceType && e.sourceId === sourceId);
  }
}
