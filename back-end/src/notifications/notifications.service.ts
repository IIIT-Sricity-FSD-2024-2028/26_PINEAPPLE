import { Injectable, NotFoundException } from '@nestjs/common';
import { Notification } from './notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';

@Injectable()
export class NotificationsService {
  private notifications: Notification[] = [];
  private nextId = 1;

  private static readonly DEFAULT_TITLES: Record<string, string> = {
    PROJECT_MEMBERSHIP_ENDED: 'Project Membership Ended',
    PROJECT_COMPLETED: 'Project Completed',
    PROJECT_UPDATE: 'Project Update',
    APPLICATION_APPROVED: 'Application Approved',
    TASK_APPROVED: 'Submission Approved',
    TASK_ASSIGNED: 'Task Assigned',
    MENTOR_REQUEST: 'Mentor Request',
    MENTOR_SESSION_BOOKED: 'Mentor Booking Confirmed',
    MENTOR_SESSION_STARTED: 'Mentor Session Started',
    MENTOR_SESSION_ACCEPTED: 'Mentor Request Accepted',
    MENTOR_SESSION_DECLINED: 'Mentor Request Declined',
    MENTOR_SESSION_COMPLETED: 'Mentor Session Completed',
    MENTOR_SESSION_CANCELLED: 'Mentor Session Cancelled',
    NEW_MESSAGE: 'New Message',
  };

  create(createNotificationDto: CreateNotificationDto): Notification {
    const rawType = createNotificationDto.type || 'NOTIFICATION';
    const computedTitle =
      createNotificationDto.title ||
      NotificationsService.DEFAULT_TITLES[rawType] ||
      rawType.replace(/_/g, ' ');

    const notification: Notification = {
      id: this.generateId(),
      userId: String(createNotificationDto.userId),
      type: rawType,
      title: computedTitle,
      message: createNotificationDto.message,
      readStatus: createNotificationDto.readStatus ?? false,
      createdAt: new Date(),
      referenceId: createNotificationDto.referenceId,
    };

    this.notifications.push(notification);
    return notification;
  }

  findAll(): Notification[] {
    return [...this.notifications].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  findOne(id: string): Notification {
    const notification = this.notifications.find((n: Notification) => n.id === id);
    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }
    return notification;
  }

  findByUser(userId: string): Notification[] {
    const target = String(userId).trim().toLowerCase();
    return this.notifications
      .filter((n: Notification) => String(n.userId).trim().toLowerCase() === target)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  update(id: string, updateNotificationDto: UpdateNotificationDto): Notification {
    const notificationIndex = this.notifications.findIndex(n => n.id === id);
    if (notificationIndex === -1) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }

    const updatedNotification = {
      ...this.notifications[notificationIndex],
      ...updateNotificationDto,
    };

    this.notifications[notificationIndex] = updatedNotification;
    return updatedNotification;
  }

  markAsRead(id: string): Notification {
    return this.update(id, { readStatus: true });
  }

  markAllAsRead(userId?: string): Notification[] {
    const target = userId ? String(userId).trim().toLowerCase() : null;
    const toUpdate = target
      ? this.notifications.filter((n: Notification) => String(n.userId).trim().toLowerCase() === target)
      : this.notifications;
    toUpdate.forEach((n: Notification) => {
      n.readStatus = true;
    });
    return toUpdate;
  }

  remove(id: string): void {
    const notificationIndex = this.notifications.findIndex(n => n.id === id);
    if (notificationIndex === -1) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }
    this.notifications.splice(notificationIndex, 1);
  }

  private generateId(): string {
    return `notif-${this.nextId++}`;
  }
}