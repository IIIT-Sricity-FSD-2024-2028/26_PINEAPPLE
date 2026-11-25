import { Injectable, Optional } from '@nestjs/common';
import { UsersRepository, User } from './users.repository';
import { AuditService } from '../audit/audit.service';

export interface DuplicateGroupUserSummary {
  id: string;
  name: string;
  username?: string;
  email: string;
  normalizedEmail: string;
  phone?: string;
  normalizedPhone?: string;
  phoneVerified: boolean;
  emailVerified: boolean;
  role: string;
  status: string;
  createdAt?: string;
}

export interface DuplicateAccountGroup {
  key: string;
  type: 'email' | 'phone';
  normalizedValue: string;
  reason: string;
  users: DuplicateGroupUserSummary[];
}

const GMAIL_STYLE_DOMAINS = new Set(['gmail.com', 'googlemail.com']);
const PLUS_TAG_PROVIDERS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'icloud.com',
  'me.com',
  'proton.me',
  'protonmail.com',
  'yahoo.com',
]);

@Injectable()
export class DuplicateDetectionService {
  constructor(
    private readonly usersRepository: UsersRepository,
    @Optional()
    private readonly auditService?: AuditService,
  ) {}

  normalizeEmail(rawEmail?: string): string {
    const trimmed = String(rawEmail || '').trim().toLowerCase();
    const atIndex = trimmed.lastIndexOf('@');
    if (atIndex <= 0) return trimmed;

    let local = trimmed.slice(0, atIndex);
    let domain = trimmed.slice(atIndex + 1);

    if (domain === 'googlemail.com') {
      domain = 'gmail.com';
    }

    if (PLUS_TAG_PROVIDERS.has(domain)) {
      const plusIdx = local.indexOf('+');
      if (plusIdx !== -1) {
        local = local.slice(0, plusIdx);
      }
    }

    if (GMAIL_STYLE_DOMAINS.has(domain)) {
      local = local.replace(/\./g, '');
    }

    return `${local}@${domain}`;
  }

  normalizePhone(rawPhone?: string): string {
    const raw = String(rawPhone || '').trim();
    if (!raw) return '';
    const hasPlus = raw.startsWith('+');
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 7) return '';
    return hasPlus ? `+${digits}` : digits;
  }

  private isEligibleUser(u: User): boolean {
    return !u.isDeleted && !u.deletedAt && !u.isHidden && !u.isDuplicate;
  }

  private toSummary(u: User): DuplicateGroupUserSummary {
    const rawPhone = u.phone || u.profile?.phone || '';
    const phoneVerified = Boolean(u.phoneVerified || u.profile?.phoneVerified);
    return {
      id: String(u.id),
      name: u.name || '',
      username: u.username || u.profile?.username,
      email: u.email || '',
      normalizedEmail: this.normalizeEmail(u.email),
      phone: rawPhone || undefined,
      normalizedPhone: phoneVerified ? this.normalizePhone(rawPhone) || undefined : undefined,
      phoneVerified,
      emailVerified: u.emailVerified !== false,
      role: String(u.role || 'Collaborator'),
      status: String(u.status || 'active'),
      createdAt: u.createdAt,
    };
  }

  computeDuplicateGroups(): {
    groups: DuplicateAccountGroup[];
    reasonsByUserId: Map<string, string[]>;
  } {
    const users = this.usersRepository.getAllRawUsers().filter((u) => this.isEligibleUser(u));

    const byNormalizedEmail = new Map<string, User[]>();
    const byVerifiedPhone = new Map<string, User[]>();

    for (const u of users) {
      const normEmail = this.normalizeEmail(u.email);
      if (normEmail) {
        if (!byNormalizedEmail.has(normEmail)) {
          byNormalizedEmail.set(normEmail, []);
        }
        byNormalizedEmail.get(normEmail)!.push(u);
      }

      const isPhoneVerified = Boolean(u.phoneVerified || u.profile?.phoneVerified);
      const rawPhone = u.phone || u.profile?.phone || '';
      const normPhone = isPhoneVerified ? this.normalizePhone(rawPhone) : '';
      if (normPhone) {
        if (!byVerifiedPhone.has(normPhone)) {
          byVerifiedPhone.set(normPhone, []);
        }
        byVerifiedPhone.get(normPhone)!.push(u);
      }
    }

    const groups: DuplicateAccountGroup[] = [];
    const reasonsByUserId = new Map<string, string[]>();

    const recordReason = (userId: string, reason: string) => {
      if (!reasonsByUserId.has(userId)) {
        reasonsByUserId.set(userId, []);
      }
      const list = reasonsByUserId.get(userId)!;
      if (!list.includes(reason)) {
        list.push(reason);
      }
    };

    for (const [normPhone, groupUsers] of byVerifiedPhone.entries()) {
      if (groupUsers.length < 2) continue;
      const reason = 'Shared verified phone number';
      groups.push({
        key: `phone:${normPhone}`,
        type: 'phone',
        normalizedValue: normPhone,
        reason,
        users: groupUsers.map((u) => this.toSummary(u)),
      });
      for (const u of groupUsers) {
        recordReason(String(u.id), reason);
      }
    }

    for (const [normEmail, groupUsers] of byNormalizedEmail.entries()) {
      if (groupUsers.length < 2) continue;
      const reason = 'Shared normalized email address';
      groups.push({
        key: `email:${normEmail}`,
        type: 'email',
        normalizedValue: normEmail,
        reason,
        users: groupUsers.map((u) => this.toSummary(u)),
      });
      for (const u of groupUsers) {
        recordReason(String(u.id), reason);
      }
    }

    return { groups, reasonsByUserId };
  }

  scanAndFlag(triggerUserId?: string, actor = 'System'): DuplicateAccountGroup[] {
    const { groups, reasonsByUserId } = this.computeDuplicateGroups();
    const allUsers = this.usersRepository.getAllRawUsers();

    for (const u of allUsers) {
      const uid = String(u.id);
      const nextReasons = reasonsByUserId.get(uid) || [];
      const prevFlag = Boolean(u.duplicateFlag);
      const prevReasons = Array.isArray(u.duplicateReasons) ? u.duplicateReasons : [];

      if (nextReasons.length > 0) {
        u.duplicateFlag = true;
        u.duplicateReasons = [...nextReasons];

        const hasNewReason =
          !prevFlag || nextReasons.some((r) => !prevReasons.includes(r));
        if (hasNewReason && (!triggerUserId || uid === String(triggerUserId))) {
          try {
            this.auditService?.log({
              action: 'duplicate-account-flagged',
              actor,
              target: u.name || u.email || `User #${uid}`,
              entityType: 'user',
              entityId: uid,
              event: `Possible duplicate account flagged for user "${u.username || u.email}" (${nextReasons.join(', ')})`,
              details: {
                userId: uid,
                reasons: nextReasons,
              },
            });
          } catch {
            // Non-blocking audit logging
          }
        }
      } else if (prevFlag) {
        u.duplicateFlag = false;
        u.duplicateReasons = [];
      }
    }

    return groups;
  }

  getDuplicateGroups(): {
    groups: DuplicateAccountGroup[];
    totalGroups: number;
    totalFlaggedUsers: number;
  } {
    const { groups, reasonsByUserId } = this.computeDuplicateGroups();
    return {
      groups,
      totalGroups: groups.length,
      totalFlaggedUsers: reasonsByUserId.size,
    };
  }
}
