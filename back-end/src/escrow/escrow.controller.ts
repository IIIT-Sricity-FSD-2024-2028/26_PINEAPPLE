import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { EscrowService } from './escrow.service';
import { Roles } from '../core/decorators/roles.decorator';
import { RolesGuard } from '../core/guards/roles.guard';

@Controller('escrow')
@UseGuards(RolesGuard)
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

  @Get()
  @Roles('Administrator')
  async getEscrows() {
    return this.escrowService.findAll();
  }

  @Post(':id/release')
  @Roles('Administrator')
  async releaseEscrow(@Param('id') id: string) {
    return this.escrowService.releaseFunds(id);
  }
}
