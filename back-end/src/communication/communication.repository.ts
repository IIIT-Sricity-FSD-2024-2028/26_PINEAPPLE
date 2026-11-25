import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { SendMessageDto } from './dto/send-message.dto';
import { UsersRepository } from '../users/users.repository';
import { ProjectsRepository } from '../projects/projects.repository';
import { getProjectRole } from '../common/utils/role.util';

export interface Message {
  id: string;
  projectId: string;
  senderId: string;
  senderName: string;
  sender?: string;
  role?: string;
  senderRole?: string;
  projectRole?: string | null;
  content: string;
  text?: string;
  flaggedForAdmin?: boolean;
  flagReason?: string;
  flaggedAt?: string;
  timestamp: Date;
}

@Injectable()
export class CommunicationRepository {
  private static readonly MAX_MESSAGES = 5000;
  private messages: Message[] = [];
  private messagesByProjectId = new Map<string, Message[]>();
  private lastReadByUserProject = new Map<string, string>();

  private indexMessage(m: Message): void {
    if (!m) return;
    const pid = String(m.projectId);
    if (!this.messagesByProjectId.has(pid)) {
      this.messagesByProjectId.set(pid, []);
    }
    const list = this.messagesByProjectId.get(pid)!;
    const existingIdx = list.findIndex((item) => item.id === m.id);
    if (existingIdx !== -1) {
      list[existingIdx] = m;
    } else {
      list.push(m);
    }
  }

  private rebuildIndexes(): void {
    this.messagesByProjectId.clear();
    for (const m of this.messages) {
      this.indexMessage(m);
    }
  }

  constructor(
    private readonly usersRepository: UsersRepository,
    @Inject(forwardRef(() => ProjectsRepository))
    private readonly projectsRepository: any,
  ) {
    this.seedMessages();
  }

  private seedMessages(): void {
    this.messages = [];
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

    // Delete stored role fields from message records on start-up
    this.cleanStoredRoles();
    this.rebuildIndexes();
  }

  resetToSeed(): void {
    this.seedMessages();
    this.resetReadState();
  }

  reset(): void {
    this.resetToSeed();
  }

  cleanStoredRoles(): void {
    for (const msg of this.messages) {
      delete (msg as any).role;
      delete (msg as any).senderRole;
    }
  }

  sendMessage(
    senderId: string,
    dto: SendMessageDto,
    projectRole: string,
    customTimestamp?: Date,
    meta?: { flaggedForAdmin?: boolean; flagReason?: string },
  ): Message {
    const user = this.usersRepository.findById(senderId) || this.usersRepository.findAll().find(u => String(u.id) === String(senderId) || String((u as any).uid || '') === String(senderId));
    const senderName = (user ? (user.name || user.profile?.fullName) : undefined) || dto.senderName || 'Unknown user';
    const content = (dto.content || dto.text || '').trim();
    const msgDate = customTimestamp || new Date();

    const newMessage: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      projectId: dto.projectId,
      senderId,
      senderName,
      sender: senderName,
      content,
      text: content,
      ...(meta?.flaggedForAdmin
        ? {
            flaggedForAdmin: true,
            flagReason: meta.flagReason || 'Content filter match',
            flaggedAt: msgDate.toISOString(),
          }
        : {}),
      timestamp: msgDate,
    };
    this.messages.push(newMessage);
    if (this.messages.length > CommunicationRepository.MAX_MESSAGES) {
      this.messages.shift();
    }
    this.indexMessage(newMessage);
    this.setLastReadAt(String(senderId), String(dto.projectId), msgDate.toISOString());

    return {
      ...newMessage,
      role: projectRole,
      senderRole: projectRole,
      projectRole,
    };
  }

  private readKey(userId: string, projectId: string): string {
    return `${String(userId).trim()}:${String(projectId).trim()}`;
  }

  getLastReadAt(userId: string, projectId: string): string | undefined {
    return this.lastReadByUserProject.get(this.readKey(userId, projectId));
  }

  setLastReadAt(userId: string, projectId: string, iso: string): void {
    this.lastReadByUserProject.set(this.readKey(userId, projectId), iso);
  }

  resetReadState(): void {
    this.lastReadByUserProject.clear();
  }

  findMessageById(messageId: string): Message | undefined {
    return this.messages.find((m) => String(m.id) === String(messageId));
  }

  deleteMessage(messageId: string): boolean {
    const initialLen = this.messages.length;
    this.messages = this.messages.filter((m) => String(m.id) !== String(messageId));
    if (this.messages.length < initialLen) {
      this.rebuildIndexes();
      return true;
    }
    return false;
  }

  getMessageContextSnapshot(projectId: string, messageId: string, maxCount = 20): Array<{
    id: string;
    projectId: string;
    senderId: string;
    senderName: string;
    role?: string;
    content: string;
    timestamp: string;
  }> {
    const all = this.getMessagesByProjectId(projectId);
    if (all.length === 0) return [];
    const targetIdx = all.findIndex((m) => String(m.id) === String(messageId));
    let slice: Message[];
    if (all.length <= maxCount || targetIdx === -1) {
      slice = all.slice(0, maxCount);
    } else {
      const half = Math.floor(maxCount / 2);
      const start = Math.max(0, Math.min(targetIdx - half, all.length - maxCount));
      slice = all.slice(start, start + maxCount);
    }
    return slice.map((m) => ({
      id: String(m.id),
      projectId: String(m.projectId),
      senderId: String(m.senderId),
      senderName: String(m.senderName || 'Unknown user'),
      role: m.projectRole || m.role || undefined,
      content: String(m.content || m.text || ''),
      timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : new Date(m.timestamp).toISOString(),
    }));
  }

  exportChatReadState(): Record<string, string> {
    const out: Record<string, string> = {};
    this.lastReadByUserProject.forEach((v, k) => {
      out[k] = v;
    });
    return out;
  }

  importChatReadState(state: Record<string, string>): void {
    if (!state || typeof state !== 'object') return;
    this.lastReadByUserProject.clear();
    for (const [k, v] of Object.entries(state)) {
      if (typeof v === 'string') {
        this.lastReadByUserProject.set(k, v);
      }
    }
  }

  getMessagesByProjectId(projectId: string): Message[] {
    const project = this.projectsRepository ? this.projectsRepository.findById(projectId) : null;
    const baseList = this.messagesByProjectId.get(String(projectId)) || this.messages.filter((msg) => msg.projectId === projectId);
    return baseList
      .map((msg) => {
        const user = this.usersRepository.findById(msg.senderId) || this.usersRepository.findAll(true).find(u => String(u.id) === String(msg.senderId) || String((u as any).uid || '') === String(msg.senderId));
        const isDeletedUser = Boolean((user as any)?.isDeleted || (user as any)?.deletedAt || msg.senderName === 'Deleted user');
        const senderName = isDeletedUser
          ? 'Deleted user'
          : (user ? (user.name || user.profile?.fullName || 'Unknown user') : (msg.senderName || 'Unknown user'));

        // Dynamically compute role from project membership
        const projectRole = project ? getProjectRole(project, msg.senderId) : null;
        const roleLabel = projectRole || (project && Array.isArray(project.removedUsers) && project.removedUsers.some((r: any) => String(r.userId || r.id) === String(msg.senderId)) ? 'Former member' : null);

        return {
          ...msg,
          senderName,
          sender: senderName,
          ...(isDeletedUser ? { senderIsDeleted: true } : {}),
          role: roleLabel || undefined,
          senderRole: roleLabel || undefined,
          projectRole: roleLabel,
          content: msg.content,
          text: msg.text || msg.content,
          timestamp: msg.timestamp,
        };
      })
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  getMessagesBySender(senderId: string): Message[] {
    const uid = String(senderId || '');
    return this.messages.filter((m) => String(m.senderId) === uid);
  }

  anonymizeSender(senderId: string): number {
    const uid = String(senderId || '');
    let updated = 0;
    for (const msg of this.messages) {
      if (String(msg.senderId) === uid) {
        msg.senderName = 'Deleted user';
        msg.sender = 'Deleted user';
        updated += 1;
      }
    }
    return updated;
  }

  getAllMessages(): Message[] {
    return this.messages;
  }
}
