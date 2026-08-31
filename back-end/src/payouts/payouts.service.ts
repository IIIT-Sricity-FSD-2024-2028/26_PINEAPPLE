import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { TransactionEntity } from './entities/transaction.entity';

// Single ledger of every money movement triggered by the hackathon flow —
// prize releases, refunds. Kept intentionally minimal (no mentor-marketplace
// commission logic here — out of scope for the hackathon feature).
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
