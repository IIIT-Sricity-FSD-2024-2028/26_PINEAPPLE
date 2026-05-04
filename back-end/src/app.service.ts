import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return { status: 'ok', message: 'TeamForge backend is running.' };
  }
}
