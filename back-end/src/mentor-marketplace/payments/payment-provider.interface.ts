export interface PaymentIntent {
  id: string;
  sessionId: string;
  amount: number;
  currency: string;
  payeeVpa: string;
  payeeName: string;
  upiUri: string;
  expiresAt: string;
  status: 'pending' | 'completed' | 'cancelled' | 'expired';
}

export interface IdempotencyRecord {
  sessionId: string;
  key: string;
  result: any;
}

export interface PaymentProvider {
  readonly providerName: string;
  createPaymentIntent(sessionId: string, amount: number, payeeName?: string): Promise<PaymentIntent>;
  verifyPayment(paymentIntentId: string): Promise<boolean>;
  cancelPayment(paymentIntentId: string): Promise<void>;
  getPaymentIntent(paymentIntentId: string): Promise<PaymentIntent | null>;
  getIdempotencyRecord?(sessionId: string): IdempotencyRecord | undefined;
  saveIdempotencyRecord?(sessionId: string, key: string, result: any): void;
}
