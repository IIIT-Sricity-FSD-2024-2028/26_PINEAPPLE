import { Injectable, Logger, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { IdempotencyRecord, PaymentIntent, PaymentProvider } from './payment-provider.interface';
import { ClockService } from '../../common/services/clock.service';

@Injectable()
export class DemoUpiProvider implements PaymentProvider {
  readonly providerName = 'demo-upi';
  private readonly logger = new Logger(DemoUpiProvider.name);
  private intents = new Map<string, PaymentIntent>();
  private idempotencyRecords = new Map<string, IdempotencyRecord>();

  constructor(@Optional() private readonly clockService?: ClockService) {}

  private nowMs(): number {
    return this.clockService ? this.clockService.now().getTime() : Date.now();
  }

  async createPaymentIntent(sessionId: string, amount: number, customPayeeName?: string): Promise<PaymentIntent> {
    const id = randomUUID();
    const payeeVpa = process.env.DEMO_UPI_VPA || 'teamforge@demo';
    const payeeName = customPayeeName || process.env.DEMO_PAYEE_NAME || 'TeamForge Escrow';
    const cleanAmount = Math.round(amount);
    const shortSession = String(sessionId).slice(-8);

    const upiUri = `upi://pay?pa=${payeeVpa}&pn=${encodeURIComponent(payeeName)}&am=${cleanAmount}&cu=INR&tn=${encodeURIComponent(`Mentorship Session ${shortSession}`)}`;

    const expiresAt = new Date(this.nowMs() + 30 * 60 * 1000).toISOString();

    const intent: PaymentIntent = {
      id,
      sessionId,
      amount: cleanAmount,
      currency: 'INR',
      payeeVpa,
      payeeName,
      upiUri,
      expiresAt,
      status: 'pending',
    };

    this.intents.set(id, intent);
    this.logger.log(`Created Demo UPI payment intent ${id} for session ${sessionId} (₹${cleanAmount})`);
    return intent;
  }

  getIdempotencyRecord(sessionId: string): IdempotencyRecord | undefined {
    return this.idempotencyRecords.get(sessionId);
  }

  saveIdempotencyRecord(sessionId: string, key: string, result: any): void {
    this.idempotencyRecords.set(sessionId, { sessionId, key, result });
  }

  clearIdempotencyRecords(): void {
    this.idempotencyRecords.clear();
  }

  async verifyPayment(paymentIntentId: string): Promise<boolean> {
    let intent = this.intents.get(paymentIntentId);
    if (!intent) {
      // Also look up by sessionId
      for (const item of this.intents.values()) {
        if (item.sessionId === paymentIntentId) {
          intent = item;
          break;
        }
      }
    }

    if (!intent) {
      // In demo mode, accept verification for existing valid session
      return true;
    }

    if (new Date(intent.expiresAt).getTime() <= this.nowMs()) {
      intent.status = 'expired';
      return false;
    }

    if (intent.status === 'cancelled') {
      return false;
    }

    intent.status = 'completed';
    return true;
  }

  async cancelPayment(paymentIntentId: string): Promise<void> {
    let intent = this.intents.get(paymentIntentId);
    if (!intent) {
      for (const item of this.intents.values()) {
        if (item.sessionId === paymentIntentId) {
          intent = item;
          break;
        }
      }
    }
    if (intent) {
      intent.status = 'cancelled';
    }
  }

  async getPaymentIntent(paymentIntentId: string): Promise<PaymentIntent | null> {
    return this.intents.get(paymentIntentId) || null;
  }

  resetToSeed(): void {
    this.reset();
  }

  reset(): void {
    this.intents.clear();
    this.idempotencyRecords.clear();
  }
}
