import { Injectable, NotFoundException } from '@nestjs/common';
import { Notification } from './notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';

@Injectable()
export class NotificationsService {
  private notifications: Notification[] = [];
  private nextId = 1;

  create(createNotificationDto: CreateNotificationDto): Notification {
    const notification: Notification = {
      id: this.generateId(),
      userId: createNotificationDto.userId,
      type: createNotificationDto.type,
      message: createNotificationDto.message,
      readStatus: createNotificationDto.readStatus ?? false,
      createdAt: new Date(),
      referenceId: createNotificationDto.referenceId,
    };

    this.notifications.push(notification);
    return notification;
  }

  findAll(): Notification[] {
    return [...this.notifications];
  }

  findOne(id: string): Notification {
    const notification = this.notifications.find((n: Notification) => n.id === id);
    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }
    return notification;
  }

  findByUser(userId: string): Notification[] {
    return this.notifications.filter((n: Notification) => n.userId === userId);
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
    const toUpdate = userId ? this.notifications.filter((n: Notification) => n.userId === userId) : this.notifications;
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