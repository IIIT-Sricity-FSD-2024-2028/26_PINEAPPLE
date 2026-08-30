import { Injectable } from '@nestjs/common';

@Injectable()
export class AnalyticsService {
  async getDashboardData() {
    return {
      mrr: 0,
      activeSubscriptions: 0,
      totalCommission: 0,
      dau: 0,
      wau: 0,
    };
  }
}
