import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class EscrowService {
  private escrows = [
    { id: 'esc-1', project: 'AI Chatbot', amount: 5000, status: 'Held', date: '2023-10-01' },
    { id: 'esc-2', project: 'Mobile App Refactor', amount: 3200, status: 'Held', date: '2023-10-15' },
    { id: 'esc-3', project: 'Security Audit', amount: 4200, status: 'Held', date: '2023-10-20' },
  ];

  async findAll() {
    return {
      totalHeld: `$${this.escrows.filter(e => e.status === 'Held').reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()}`,
      records: this.escrows,
    };
  }

  async holdFunds(taskId: string, amount: number) {
    return { escrowId: 'esc-new', status: 'HELD' };
  }

  async releaseFunds(escrowId: string) {
    const escrow = this.escrows.find(e => e.id === escrowId);
    if (!escrow) {
      throw new NotFoundException('Escrow record not found');
    }
    escrow.status = 'Released';
    return escrow;
  }
}
