import { Injectable } from '@nestjs/common';
import { SendMessageDto } from './dto/send-message.dto';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UsersRepository } from '../users/users.repository';

export interface Message {
  id: string;
  projectId: string;
  senderId: string;
  senderName: string;
  sender?: string;
  role: string;
  senderRole?: string;
  content: string;
  text?: string;
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

  constructor(private readonly usersRepository: UsersRepository) {
    const now = new Date();
    
    // Seed test messages linked to proj-1
    this.messages.push({
      id: 'msg-1',
      projectId: 'proj-1',
      senderId: '1', // Priya (Admin/Project Owner)
      senderName: 'Priya Patel',
      role: 'Owner',
      content: 'Welcome to the AI Study Planner project. Let us get started!',
      text: 'Welcome to the AI Study Planner project. Let us get started!',
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 24), // 1 day ago
    });
    this.messages.push({
      id: 'msg-2',
      projectId: 'proj-1',
      senderId: '2', // Arjun (Collaborator)
      senderName: 'Arjun Sharma',
      role: 'Collaborator',
      content: 'I will start looking at the database schema today.',
      text: 'I will start looking at the database schema today.',
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

    this.messages.push({
      id: 'msg-3',
      projectId: 'proj-6',
      senderId: '6', // Aditya Sai
      senderName: 'Aditya Sai',
      role: 'Collaborator',
      content: 'I have set up the Vue frontend skeleton.',
      text: 'I have set up the Vue frontend skeleton.',
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 5),
    });
    this.messages.push({
      id: 'msg-4',
      projectId: 'proj-6',
      senderId: '8', // Vikram Nair
      senderName: 'Vikram Nair',
      role: 'Collaborator',
      content: 'Great, I will start writing the Solidity contracts tomorrow.',
      text: 'Great, I will start writing the Solidity contracts tomorrow.',
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 4),
    });

    this.messages.push({
      id: 'msg-5',
      projectId: 'proj-7',
      senderId: '7', // Neha Gupta
      senderName: 'Neha Gupta',
      role: 'Collaborator',
      content: 'Hello team, the climate data sets are ready for analysis.',
      text: 'Hello team, the climate data sets are ready for analysis.',
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 2),
    });


    this.notifications.push({
      id: 'notif-4',
      userId: '7', // Neha Gupta
      title: 'Task In Progress',
      message: 'You started working on "Train ML Model".',
      isRead: true,
      timestamp: new Date(now.getTime() - 1000 * 60 * 15),
    });
  }

  private resolveDisplayRole(role?: string): string {
    const r = String(role || '').trim().toLowerCase().replace(/[_\s]+/g, '-');
    if (r === 'project-owner' || r === 'owner') return 'Owner';
    if (r === 'mentor') return 'Mentor';
    if (r === 'collaborator' || r === 'collab') return 'Collaborator';
    if (r === 'admin' || r === 'administrator') return 'Admin';
    if (r === 'superuser' || r === 'super-user') return 'Super User';
    return 'Collaborator';
  }

  sendMessage(senderId: string, roleHeader: string | undefined, dto: SendMessageDto): Message {
    const user = this.usersRepository.findById(senderId);
    const senderName = (user ? (user.name || user.profile?.fullName) : undefined) || dto.senderName || 'Unknown user';

    // Role priority: roleHeader (from active context) or user's base role
    const resolvedRole = this.resolveDisplayRole(roleHeader || user?.role);
    const content = (dto.content || dto.text || '').trim();

    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      projectId: dto.projectId,
      senderId,
      senderName,
      sender: senderName,
      role: resolvedRole,
      senderRole: resolvedRole,
      content,
      text: content,
      timestamp: new Date(),
    };
    this.messages.push(newMessage);
    return newMessage;
  }

  getMessagesByProjectId(projectId: string): Message[] {
    return this.messages
      .filter((msg) => msg.projectId === projectId)
      .map((msg) => {
        let senderName = msg.senderName;
        let role = msg.role;

        const isRoleString = ['collaborator', 'project owner', 'owner', 'project-owner', 'mentor', 'admin', 'administrator', 'superuser', 'super user'].includes(
          String(senderName || '').trim().toLowerCase(),
        );

        if (!senderName || isRoleString) {
          const user = this.usersRepository.findById(msg.senderId);
          senderName = user ? (user.name || user.profile?.fullName || 'Unknown user') : 'Unknown user';
          if (!role && user) {
            role = this.resolveDisplayRole(user.role);
          }
        }

        if (!role) {
          const user = this.usersRepository.findById(msg.senderId);
          role = user ? this.resolveDisplayRole(user.role) : 'Collaborator';
        }

        return {
          ...msg,
          senderName,
          sender: senderName,
          role,
          senderRole: role,
          content: msg.content,
          text: msg.text || msg.content,
          timestamp: msg.timestamp,
        };
      })
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
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
