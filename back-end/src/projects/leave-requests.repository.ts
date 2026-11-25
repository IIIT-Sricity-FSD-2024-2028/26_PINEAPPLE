import { Injectable } from '@nestjs/common';

export type LeaveRequestStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';

export interface LeaveRequest {
  id: string;
  projectId: string;
  userId: string;
  userName?: string;
  userAvatar?: string;
  reasons: string[];
  explanation: string;
  status: LeaveRequestStatus;
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
  rejectionReasons?: string[];
  rejectionExplanation?: string;
  reminderSentAt?: string;
}

@Injectable()
export class LeaveRequestsRepository {
  private requests: LeaveRequest[] = [];

  create(data: Omit<LeaveRequest, 'id' | 'createdAt'> & { id?: string; createdAt?: string }): LeaveRequest {
    const newReq: LeaveRequest = {
      id: data.id || `lr-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      createdAt: data.createdAt || new Date().toISOString(),
      ...data,
    };
    this.requests.push(newReq);
    return newReq;
  }

  findById(id: string): LeaveRequest | undefined {
    return this.requests.find((r) => String(r.id) === String(id));
  }

  findByProjectId(projectId: string): LeaveRequest[] {
    return this.requests.filter((r) => String(r.projectId) === String(projectId));
  }

  findPendingByProjectAndUser(projectId: string, userId: string): LeaveRequest | undefined {
    return this.requests.find(
      (r) =>
        String(r.projectId) === String(projectId) &&
        String(r.userId) === String(userId) &&
        r.status === 'pending',
    );
  }

  findLatestByProjectAndUser(projectId: string, userId: string): LeaveRequest | undefined {
    const userReqs = this.requests
      .filter(
        (r) =>
          String(r.projectId) === String(projectId) &&
          String(r.userId) === String(userId),
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return userReqs[0];
  }

  findAllPending(): LeaveRequest[] {
    return this.requests.filter((r) => r.status === 'pending');
  }

  findAll(): LeaveRequest[] {
    return [...this.requests];
  }

  update(id: string, updates: Partial<LeaveRequest>): LeaveRequest {
    const idx = this.requests.findIndex((r) => String(r.id) === String(id));
    if (idx === -1) {
      throw new Error(`LeaveRequest with id ${id} not found.`);
    }
    this.requests[idx] = {
      ...this.requests[idx],
      ...updates,
    };
    return this.requests[idx];
  }

  delete(id: string): boolean {
    const initialLen = this.requests.length;
    this.requests = this.requests.filter((r) => String(r.id) !== String(id));
    return this.requests.length < initialLen;
  }

  reset(): void {
    this.requests = [];
  }
}
