import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { PayoutsService } from './payouts.service';
import { Roles } from '../core/decorators/roles.decorator';
import { RolesGuard } from '../core/guards/roles.guard';

@Controller('payouts')
@UseGuards(RolesGuard)
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Get()
  @Roles('Administrator')
  async getPayouts() {
    return this.payoutsService.findAll();
  }

  @Post(':id/approve')
  @Roles('Administrator')
  async approvePayout(@Param('id') id: string) {
    return this.payoutsService.approvePayout(id);
  }
}
