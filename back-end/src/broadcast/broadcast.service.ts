import { Injectable } from '@nestjs/common';

@Injectable()
export class BroadcastService {
  async sendTargetedBroadcast(senderId: string, message: string, skillTags: string[]) {
    // Send message only to users matching skillTags
    return { status: 'sent', recipientCount: 0 };
  }
}
