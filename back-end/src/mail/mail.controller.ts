import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { MailService } from './mail.service';

@ApiTags('Mail')
@Controller('mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Check mail transport readiness and last delivery status (dev safe)' })
  getHealth() {
    return this.mailService.getHealth();
  }
}
