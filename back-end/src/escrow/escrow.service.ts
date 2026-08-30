import { Injectable } from '@nestjs/common';

@Injectable()
export class EscrowService {
  async fund(sourceType: string, sourceId: string, amount: number) {
    return { status: 'funded' };
  }

  async release(escrowId: string) {
    return { status: 'released' };
  }

  async refund(escrowId: string) {
    return { status: 'refunded' };
  }

  async dispute(escrowId: string) {
    return { status: 'disputed' };
  }
}
