import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { TransactionEntity } from './entities/transaction.entity';

// Single ledger of every money movement released from escrow — currently
// mentor-session payouts. Kept intentionally minimal (no commission/fee
// splitting logic here).
@Injectable()
export class PayoutsService {
  private transactions: TransactionEntity[] = [];

  recordTransaction(input: { payerId: string; payeeId?: string; amount: number; type: string }): TransactionEntity {
    const txn: TransactionEntity = {
      id: randomUUID(),
      payerId: input.payerId,
      payeeId: input.payeeId,
      amount: input.amount,
      currency: 'INR',
      type: input.type,
      status: 'completed',
      createdAt: new Date().toISOString(),
    };
    this.transactions.push(txn);
    return txn;
  }

  findAll(payeeId?: string): TransactionEntity[] {
    return payeeId ? this.transactions.filter((t) => t.payeeId === payeeId) : [...this.transactions];
  }
}
