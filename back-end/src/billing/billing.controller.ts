import { Controller, Post, Body, Req, Headers, UseGuards } from '@nestjs/common';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('webhook')
  async handleWebhook(@Body() payload: any, @Headers('stripe-signature') signature: string) {
    // Idempotent handling of payment gateway webhooks
    return this.billingService.processWebhook(payload, signature);
  }
}
