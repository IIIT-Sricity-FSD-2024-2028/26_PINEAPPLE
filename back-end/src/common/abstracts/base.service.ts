import { NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';

export abstract class BaseService<T extends { id: string }> {
  protected readonly items: T[] = [];

  findAll(): T[] {
    return [...this.items];
  }

  findOne(id: string): T {
    const item = this.items.find((entry: T) => entry.id === id);
    if (!item) {
      throw new NotFoundException(`Resource with id ${id} not found`);
    }
    return item;
  }

  create(item: Omit<T, 'id'>): T {
    const created = { ...item, id: randomUUID() } as T;
    this.items.push(created);
    return created;
  }

  update(id: string, update: Partial<Omit<T, 'id'>>): T {
    const index = this.items.findIndex((entry: T) => entry.id === id);
    if (index === -1) {
      throw new NotFoundException(`Resource with id ${id} not found`);
    }

    this.items[index] = { ...this.items[index], ...update } as T;
    return this.items[index];
  }

  remove(id: string): void {
    const index = this.items.findIndex((entry) => entry.id === id);
    if (index === -1) {
      throw new NotFoundException(`Resource with id ${id} not found`);
    }
    this.items.splice(index, 1);
  }
}
