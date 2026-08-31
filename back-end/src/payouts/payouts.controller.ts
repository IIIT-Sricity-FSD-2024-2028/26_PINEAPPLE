import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from '../core/decorators/roles.decorator';
import { RolesGuard } from '../core/guards/roles.guard';
import { PayoutsService } from './payouts.service';

@ApiTags('Payouts')
@Controller('payouts')
@UseGuards(RolesGuard)
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Get('transactions')
  @Roles('user')
  @ApiQuery({ name: 'payeeId', required: false })
  findAll(@Query('payeeId') payeeId?: string) {
    return this.payoutsService.findAll(payeeId);
  }
}
