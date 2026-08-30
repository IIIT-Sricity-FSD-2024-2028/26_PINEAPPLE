import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class PayoutsService {
  private payouts = [
    { id: 'po-1', collaborator: 'Alice', amount: 800, status: 'Completed', date: '2023-10-05' },
    { id: 'po-2', collaborator: 'Bob', amount: 1200, status: 'Pending', date: '2023-10-25' },
    { id: 'po-3', collaborator: 'Charlie', amount: 450, status: 'Pending', date: '2023-10-26' },
  ];

  async findAll() {
    const totalMonth = this.payouts
      .filter(p => p.status === 'Completed')
      .reduce((acc, curr) => acc + curr.amount, 0);

    return {
      totalMonth: `$${totalMonth.toLocaleString()}`,
      records: this.payouts,
    };
  }

  async processPayout(taskId: string, userId: string, amount: number) {
    return { payoutId: 'po-new', status: 'PROCESSED' };
  }

  async approvePayout(id: string) {
    const payout = this.payouts.find(p => p.id === id);
    if (!payout) throw new NotFoundException('Payout not found');
    payout.status = 'Completed';
    return payout;
  }
}
