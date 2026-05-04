import { Injectable } from '@nestjs/common';
import { SendMessageDto } from './dto/send-message.dto';
import { CreateNotificationDto } from './dto/create-notification.dto';

export interface Message {
  id: string;
  projectId: string;
  senderId: string;
  content: string;
  timestamp: Date;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  isRead: boolean;
  timestamp: Date;
}

@Injectable()
export class CommunicationRepository {
  private messages: Message[] = [];
  private notifications: Notification[] = [];

  constructor() {
    const now = new Date();
    
    // Seed test messages linked to proj-1
    this.messages.push({
      id: 'msg-1',
      projectId: 'proj-1',
      senderId: '1', // Priya (Admin/Project Owner)
      content: 'Welcome to the AI Study Planner project. Let us get started!',
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 24), // 1 day ago
    });
    this.messages.push({
      id: 'msg-2',
      projectId: 'proj-1',
      senderId: '2', // Arjun (Collaborator)
      content: 'I will start looking at the database schema today.',
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 2), // 2 hours ago
    });

    // Seed test notifications
    this.notifications.push({
      id: 'notif-1',
      userId: '2', // Arjun
      title: 'Task Assigned',
      message: 'You have been assigned to "Implement Authentication".',
      isRead: false,
      timestamp: new Date(now.getTime() - 1000 * 60 * 60), // 1 hour ago
    });
    this.notifications.push({
      id: 'notif-2',
      userId: '1', // Priya
      title: 'Project Update',
      message: 'Arjun completed the "Design Database Schema" task.',
      isRead: true,
      timestamp: new Date(now.getTime() - 1000 * 60 * 30), // 30 mins ago
    });
  }

  sendMessage(senderId: string, dto: SendMessageDto): Message {
    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      projectId: dto.projectId,
      senderId,
      content: dto.content,
      timestamp: new Date(),
    };
    this.messages.push(newMessage);
    return newMessage;
  }

  getMessagesByProjectId(projectId: string): Message[] {
    return this.messages
      .filter((msg) => msg.projectId === projectId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()); // Chronological order
  }

  createNotification(dto: CreateNotificationDto): Notification {
    const newNotification: Notification = {
      id: `notif-${Date.now()}`,
      userId: dto.userId,
      title: dto.title,
      message: dto.message,
      isRead: false,
      timestamp: new Date(),
    };
    this.notifications.push(newNotification);
    return newNotification;
  }

  getNotificationsByUserId(userId: string): Notification[] {
    return this.notifications
      .filter((notif) => notif.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()); // Reverse chronological order
  }

  markNotificationAsRead(notificationId: string): Notification | undefined {
    const notif = this.notifications.find((n) => n.id === notificationId);
    if (notif) {
      notif.isRead = true;
      return notif;
    }
    return undefined;
  }
}
