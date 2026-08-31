import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../core/decorators/roles.decorator';
import { RolesGuard } from '../core/guards/roles.guard';
import { EscrowService } from './escrow.service';

@ApiTags('Escrow')
@Controller('escrow')
@UseGuards(RolesGuard)
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

  @Get()
  @Roles('admin', 'superuser')
  findAll() {
    return this.escrowService.findAll();
  }

  @Get(':id')
  @Roles('admin', 'superuser', 'user')
  findOne(@Param('id') id: string) {
    return this.escrowService.findOne(id);
  }
}
