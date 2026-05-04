import { Injectable, NotFoundException } from '@nestjs/common';
import { CommunicationRepository, Message, Notification } from './communication.repository';
import { SendMessageDto } from './dto/send-message.dto';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class CommunicationService {
  constructor(private readonly communicationRepository: CommunicationRepository) {}

  sendMessage(senderId: string, dto: SendMessageDto): Message {
    return this.communicationRepository.sendMessage(senderId, dto);
  }

  getMessagesByProjectId(projectId: string): Message[] {
    return this.communicationRepository.getMessagesByProjectId(projectId);
  }

  createNotification(dto: CreateNotificationDto): Notification {
    return this.communicationRepository.createNotification(dto);
  }

  getNotificationsByUserId(userId: string): Notification[] {
    return this.communicationRepository.getNotificationsByUserId(userId);
  }

  markNotificationAsRead(notificationId: string): Notification {
    const notif = this.communicationRepository.markNotificationAsRead(notificationId);
    if (!notif) {
      throw new NotFoundException(`Notification with ID ${notificationId} not found.`);
    }
    return notif;
  }
}
