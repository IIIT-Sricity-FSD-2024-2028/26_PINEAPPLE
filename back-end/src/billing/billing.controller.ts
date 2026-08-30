import { Controller, Post, Get, Body, Headers, UseGuards } from '@nestjs/common';
import { BillingService } from './billing.service';
import { Roles } from '../core/decorators/roles.decorator';
import { RolesGuard } from '../core/guards/roles.guard';

@Controller('billing')
@UseGuards(RolesGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('metrics')
  @Roles('Administrator')
  async getMetrics() {
    return this.billingService.getMetrics();
  }

  @Post('webhook')
  async handleWebhook(@Body() payload: any, @Headers('stripe-signature') signature: string) {
    return this.billingService.processWebhook(payload, signature);
  }
}
