import { Injectable } from '@nestjs/common';
import { ActionFeedbackEntity } from './feedback.entity';

@Injectable()
export class ActionFeedbackRepository {
  private readonly items: ActionFeedbackEntity[] = [];

  create(record: ActionFeedbackEntity): ActionFeedbackEntity {
    this.items.push(record);
    return { ...record };
  }

  findByEntity(entityType: string, entityId: string): ActionFeedbackEntity[] {
    const eType = String(entityType || '').toUpperCase().trim();
    const eId = String(entityId || '').trim();
    return this.items
      .filter(
        (item) =>
          String(item.entityType || '').toUpperCase().trim() === eType &&
          String(item.entityId || '').trim() === eId,
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  findByProject(projectId: string): ActionFeedbackEntity[] {
    const pId = String(projectId || '').trim();
    return this.items
      .filter((item) => String(item.projectId || '').trim() === pId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  findByUser(userId: string): ActionFeedbackEntity[] {
    const uId = String(userId || '').trim();
    return this.items
      .filter(
        (item) =>
          String(item.actorUserId || '').trim() === uId ||
          String(item.targetUserId || '').trim() === uId,
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  findById(id: string): ActionFeedbackEntity | undefined {
    return this.items.find((item) => String(item.id) === String(id));
  }

  findAll(): ActionFeedbackEntity[] {
    return [...this.items].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  reset(): void {
    this.items.length = 0;
  }
}
