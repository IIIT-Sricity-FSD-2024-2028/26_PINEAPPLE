import { ModuleRef } from '@nestjs/core';
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
  OnModuleInit,
  Inject,
  forwardRef,
  Optional,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { UsersRepository, User } from './users.repository';
import { GamificationRepository } from '../gamification/gamification.repository';
import { InternalCreateUserInput, UserRole, UserStatus } from './dto/create-user.dto';
import { InternalUpdateUserInput } from './dto/update-user.dto';
import { SuperUserCreateUserDto } from './dto/superuser-create-user.dto';
import { SelfUpdateUserDto, findDisallowedSelfUpdateFields } from './dto/self-update-user.dto';
import { serializeSafeUser } from './user-serializer';
import { normalizeRole, getProjectRole } from '../common/utils/role.util';
import { isProfileComplete } from '../common/utils/profile.util';
import { FirebaseService } from '../firebase/firebase.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { assertSafeHttpUrl } from '../common/utils/url.util';
import { ClockService } from '../common/services/clock.service';
import { ContentFilterService } from '../common/services/content-filter.service';
import { DuplicateDetectionService } from './duplicate-detection.service';
import { DigestService } from '../notifications/digest.service';
import { ReputationService } from '../moderation/reputation.service';

export interface OtpChallengeState {
  phone?: string;
  codeHash?: string;
  codeVoid: boolean;
  wrongAttempts: number;
  lockedUntilMs?: number;
  expiresAtMs?: number;
}

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);
  private readonly phoneVerifyAttempts = new Map<string, number[]>();
  private readonly otpChallenges = new Map<string, OtpChallengeState>();
  private readonly MAX_OTP_WRONG_ATTEMPTS = 5;
  private readonly OTP_LOCK_DURATION_MS = 15 * 60 * 1000;
  private readonly OTP_EXPIRY_MS = 10 * 60 * 1000;

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly gamificationRepository: GamificationRepository,
    private readonly moduleRef: ModuleRef,
    private readonly firebaseService: FirebaseService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    @Optional()
    private readonly clockService?: ClockService,
    @Optional()
    private readonly contentFilterService?: ContentFilterService,
    @Optional()
    private readonly duplicateDetectionService?: DuplicateDetectionService,
    @Optional()
    @Inject(forwardRef(() => ReputationService))
    private readonly reputationService?: ReputationService,
  ) {}

  private getReputationService(): ReputationService | undefined {
    if (this.reputationService) return this.reputationService;
    try {
      return this.moduleRef?.get(ReputationService, { strict: false });
    } catch {
      return undefined;
    }
  }

  onModuleInit() {
    this.scanAndFlagDuplicateUsernames();
  }

  normalizeUsername(uname?: string): string {
    return (uname || '').trim().toLowerCase();
  }

  scanAndFlagDuplicateUsernames(): void {
    const allUsers = this.usersRepository.findAll();
    const map = new Map<string, string[]>();

    for (const u of allUsers) {
      const uname = this.normalizeUsername(u.username || u.profile?.username);
      if (uname) {
        if (!map.has(uname)) {
          map.set(uname, []);
        }
        map.get(uname)!.push(String(u.id));
      }
    }

    for (const [uname, userIds] of map.entries()) {
      if (userIds.length > 1) {
        console.warn(
          `⚠️ Duplicate username "${uname}" detected across user IDs [${userIds.join(', ')}]`,
        );
        for (let i = 1; i < userIds.length; i++) {
          const dupUser = this.usersRepository.findById(userIds[i]);
          if (dupUser && dupUser.profile) {
            (dupUser.profile as any).needsUsernameChange = true;
          }
        }
      }
    }
  }

  isUsernameAvailable(rawUsername: string, excludeUserId?: string): boolean {
    const target = this.normalizeUsername(rawUsername);
    if (!target) return false;

    const allUsers = this.usersRepository.findAll();
    const collision = allUsers.some((u) => {
      if (excludeUserId && String(u.id) === String(excludeUserId)) {
        return false;
      }
      const u1 = this.normalizeUsername(u.username);
      const u2 = this.normalizeUsername(u.profile?.username);
      return u1 === target || u2 === target;
    });

    return !collision;
  }

  isEmailAvailable(rawEmail: string, excludeUserId?: string): boolean {
    const target = (rawEmail || '').trim().toLowerCase();
    if (!target) return false;

    const allUsers = this.usersRepository.findAll();
    return !allUsers.some((u) => {
      if (excludeUserId && String(u.id) === String(excludeUserId)) {
        return false;
      }
      return u.email && u.email.trim().toLowerCase() === target;
    });
  }

  findOrCreateFromAuth(
    uid: string,
    email?: string,
    role?: string,
    name?: string,
    username?: string,
  ): User {
    const existing =
      this.usersRepository.findById(uid) ||
      (email ? this.usersRepository.findByEmail(email) : undefined);
    const user = this.usersRepository.findOrCreateFromAuth(
      uid,
      email,
      role,
      name,
      username,
    );
    if (!existing && user?.id) {
      try {
        this.getReputationService()?.recordInitial(String(user.id));
      } catch (err: any) {
        console.warn('[users.service] Initial rep ledger sync notice:', err?.message || err);
      }
    }
    return this.toSafeUser(user);
  }

  findAll(): any[] {
    const users = this.usersRepository.findAll();
    return users.map((u) => this.toSafeUser(u));
  }

  private async getMarketplaceService(): Promise<any | null> {
    if ((this as any).mentorMarketplaceService) {
      return (this as any).mentorMarketplaceService;
    }
    try {
      const { MentorMarketplaceService } = await import(
        '../mentor-marketplace/mentor-marketplace.service'
      );
      return this.moduleRef
        ? this.moduleRef.get(MentorMarketplaceService, { strict: false })
        : null;
    } catch {
      return null;
    }
  }

  async getLiveMentoredProjects(
    userId: string,
    options?: { completedOnly?: boolean },
  ): Promise<any[]> {
    if (!userId) return [];
    const marketplace = await this.getMarketplaceService();
    if (!marketplace) return [];
    try {
      const res =
        typeof marketplace.getMentoredProjectsForUser === 'function'
          ? marketplace.getMentoredProjectsForUser(String(userId), options)
          : marketplace.getMentoredProjects?.(String(userId));
      const items = Array.isArray(res?.items) ? res.items : [];
      if (options?.completedOnly) {
        return items.filter(
          (item: any) =>
            String(item.status || '').toLowerCase() === 'completed',
        );
      }
      return items;
    } catch {
      return [];
    }
  }

  findById(id: string): any {
    const user = this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }
    const hasBadges =
      Array.isArray(user.data?.mentorRecommendations) &&
      user.data.mentorRecommendations.length > 0;
    if (user.profile) {
      user.profile.hasMentorBadge = Boolean(
        user.profile.hasMentorBadge || hasBadges,
      );
    }
    return this.toSafeUser(user);
  }

  findUserSafe(id: string): any | undefined {
    const user = this.usersRepository.findById(id);
    if (!user) return undefined;
    if (user && user.profile) {
      const hasBadges =
        Array.isArray(user.data?.mentorRecommendations) &&
        user.data.mentorRecommendations.length > 0;
      user.profile.hasMentorBadge = Boolean(
        user.profile.hasMentorBadge || hasBadges,
      );
    }
    return this.toSafeUser(user);
  }

  findRawUserById(id: string): User | undefined {
    return this.usersRepository.findById(id);
  }

  findRawUserByEmail(email: string): User | undefined {
    return this.usersRepository.findByEmail(email);
  }

  findRawUserByUsername(username: string): User | undefined {
    const clean = String(username || '').trim().toLowerCase();
    if (!clean) return undefined;
    const byRepo = this.usersRepository.findByUsername(clean);
    if (byRepo) return byRepo;
    return this.usersRepository.findAll(true).find(
      (u) => !u.isDeleted && !u.deletedAt && String(u.username || '').toLowerCase() === clean,
    );
  }

  /**
   * Updates user's lastActiveAt timestamp in-memory, throttled to at most once per 10 minutes
   * unless force=true (e.g., explicit login).
   */
  touchLastActive(userId: string, nowMs?: number, nowIso?: string, force = false): void {
    if (!userId) return;
    const user = this.usersRepository.findById(String(userId));
    if (!user) return;
    const currentMs = typeof nowMs === 'number' && !isNaN(nowMs) ? nowMs : Date.now();
    const currentIso = nowIso || new Date(currentMs).toISOString();
    const existingMs = user.lastActiveAt ? new Date(user.lastActiveAt).getTime() : 0;
    const TEN_MINUTES_MS = 10 * 60 * 1000;

    if (!force && existingMs > 0 && currentMs >= existingMs && currentMs - existingMs < TEN_MINUTES_MS) {
      return;
    }

    user.lastActiveAt = currentIso;
    try {
      this.usersRepository.update(String(user.id), { lastActiveAt: currentIso } as any);
    } catch {}
  }

  completeSocialProfile(
    userId: string,
    email: string | undefined,
    data: { name: string; username: string; role?: string; university?: string },
  ): any {
    let user = this.usersRepository.findById(userId);
    if (!user && email) {
      user = this.usersRepository.findByEmail(email);
    }

    const existingUsername = user?.username || user?.profile?.username;
    if (existingUsername && String(existingUsername).trim()) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'USERNAME_ALREADY_SET',
        message: 'Username is already set and cannot be changed.',
      });
    }

    const cleanUsername = this.normalizeUsername(data.username);

    if (user) {
      user.name = data.name.trim();
      user.username = cleanUsername;
      if (data.university !== undefined) {
        user.university = data.university.trim();
      }
      user.profileComplete = true;
      user.usernameAutoGenerated = false;
      if (user.profile) {
        user.profile.fullName = data.name.trim();
        user.profile.username = cleanUsername;
        if (data.university) {
          (user.profile as any).uni = data.university.trim();
          (user.profile as any).university = data.university.trim();
        }
      }
      this.usersRepository.reindexUser(user);
    } else {
      user = this.usersRepository.findOrCreateFromAuth(
        userId,
        email,
        data.role,
        data.name,
        cleanUsername,
      );
      if (data.university) {
        user.university = data.university.trim();
        if (user.profile) {
          (user.profile as any).uni = data.university.trim();
          (user.profile as any).university = data.university.trim();
        }
      }
      user.profileComplete = true;
      user.usernameAutoGenerated = false;
      this.usersRepository.reindexUser(user);

      // Record initial reputation for new social user via ReputationService
      try {
        if (user?.id) {
          this.getReputationService()?.recordInitial(String(user.id));
        }
      } catch (err: any) {
        console.warn('[users.service] Initial rep ledger sync notice:', err?.message || err);
      }
    }

    return {
      ...this.findById(user.id),
      id: user.id,
      uid: user.id,
      email: user.email,
      name: user.name,
      username: user.username,
      profileComplete: true,
      needsUsernameConfirmation: Boolean(user.usernameAutoGenerated),
    };
  }

  confirmOrChangeUsername(userId: string, body: { username?: string; confirm?: boolean }): any {
    const user = this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found.`);
    }

    if (body.confirm === true) {
      user.usernameAutoGenerated = false;
      return {
        ...this.findById(userId),
        id: user.id,
        uid: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        profileComplete: true,
        needsUsernameConfirmation: false,
      };
    }

    const existingUsername = user.username || user.profile?.username;
    if (existingUsername && String(existingUsername).trim()) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'USERNAME_IMMUTABLE',
        message: "Your username can't be changed.",
      });
    }

    const rawUsername = body.username;
    if (!rawUsername || typeof rawUsername !== 'string' || !rawUsername.trim()) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'USERNAME_REQUIRED',
        message: 'Username is required.',
      });
    }

    this.contentFilterService?.assertClean(
      { username: rawUsername },
      ['username'],
      { actorId: String(userId), entityType: 'user', entityId: String(userId) },
    );

    const trimmed = this.normalizeUsername(rawUsername);
    if (!/^[a-zA-Z0-9_-]{3,30}$/.test(trimmed)) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'BAD_REQUEST',
        message: 'Username must be 3-30 characters long and can contain letters, numbers, underscores, and hyphens.',
      });
    }

    if (!this.isUsernameAvailable(trimmed, userId)) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'USERNAME_TAKEN',
        message: 'This username is already taken.',
      });
    }

    user.username = trimmed;
    if (user.profile) {
      user.profile.username = trimmed;
    }
    user.usernameAutoGenerated = false;
    this.usersRepository.reindexUser(user);

    return {
      ...this.findById(userId),
      id: user.id,
      uid: user.id,
      email: user.email,
      name: user.name,
      username: user.username,
      profileComplete: true,
      needsUsernameConfirmation: false,
    };
  }

  searchUsers(
    query: string,
    callerId: string,
  ): Array<{ id: string; name: string; username: string; university: string; matchField?: string }> {
    if (!query || query.trim().length < 2) return [];
    const q = query.trim().toLowerCase();
    const users = this.usersRepository.findAll();
    const scored: Array<{
      rank: number;
      user: { id: string; name: string; username: string; university: string; matchField?: string };
    }> = [];

    for (const u of users) {
      if (String(u.id) === String(callerId)) continue;
      const roleLower = String(u.role || '').toLowerCase();
      if (
        roleLower === 'admin' ||
        roleLower === 'administrator' ||
        roleLower === 'superuser' ||
        roleLower === 'super-user'
      ) {
        continue;
      }
      if (u.status === UserStatus.Suspended || u.status === UserStatus.Inactive) continue;
      if (!isProfileComplete(u)) continue;

      const rawUsername = String(u.username || u.profile?.username || '').trim();
      const usernameLower = rawUsername.toLowerCase();
      const nameLower = String(u.name || '').toLowerCase();

      const exactUsername = Boolean(usernameLower && usernameLower === q);
      const prefixUsername = Boolean(usernameLower && usernameLower.startsWith(q));
      const otherUsername = Boolean(usernameLower && usernameLower.includes(q));
      const prefixName = Boolean(nameLower && nameLower.startsWith(q));
      const otherName = Boolean(nameLower && nameLower.includes(q));

      if (!exactUsername && !prefixUsername && !otherUsername && !prefixName && !otherName) {
        continue;
      }

      // Exact username -> username prefix -> name prefix -> other substring match
      let rank = 4;
      let matchField: 'username' | 'name' = 'name';
      if (exactUsername) {
        rank = 0;
        matchField = 'username';
      } else if (prefixUsername) {
        rank = 1;
        matchField = 'username';
      } else if (prefixName) {
        rank = 2;
        matchField = 'name';
      } else if (otherUsername) {
        rank = 3;
        matchField = 'username';
      } else {
        rank = 4;
        matchField = 'name';
      }

      scored.push({
        rank,
        user: {
          id: String(u.id),
          name: u.name,
          username: rawUsername,
          university: u.university || (u as any).data?.university || '',
          matchField,
        },
      });
    }

    scored.sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      const aLen = (a.user.username || '').length;
      const bLen = (b.user.username || '').length;
      if (aLen !== bLen) return aLen - bLen;
      const uCmp = (a.user.username || '').localeCompare(b.user.username || '');
      if (uCmp !== 0) return uCmp;
      return (a.user.name || '').localeCompare(b.user.name || '');
    });

    return scored.slice(0, 10).map((s) => s.user);
  }

  findByEmail(email: string): any | undefined {
    const user = this.usersRepository.findByEmail(email);
    return user ? this.toSafeUser(user) : undefined;
  }

  findByUsername(username: string): any | undefined {
    const user = this.usersRepository.findByUsername(username);
    return user ? this.toSafeUser(user) : undefined;
  }

  findByIdentifier(identifier: string): any | undefined {
    const user = this.usersRepository.findByIdentifier(identifier);
    return user ? this.toSafeUser(user) : undefined;
  }

  create(createUserDto: InternalCreateUserInput, customId?: string): any {
    const rawUsername = createUserDto.username;
    const allowBlankForIncompleteProfile = createUserDto.profileComplete === false;
    let normalized = '';

    if (rawUsername && typeof rawUsername === 'string' && rawUsername.trim()) {
      normalized = this.normalizeUsername(rawUsername);
      if (!/^[a-zA-Z0-9_-]{3,30}$/.test(normalized)) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          code: 'BAD_REQUEST',
          message: 'Username must be 3-30 characters long and can contain letters, numbers, underscores, and hyphens.',
        });
      }

      if (!this.isUsernameAvailable(normalized)) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          code: 'USERNAME_TAKEN',
          message: 'This username is already taken.',
        });
      }
    } else if (!allowBlankForIncompleteProfile) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'USERNAME_REQUIRED',
        message: 'Username is required.',
      });
    }

    if (createUserDto.email && !this.isEmailAvailable(createUserDto.email)) {
      throw new ConflictException('An account with this email already exists');
    }

    const created = this.usersRepository.create(
      {
        name: createUserDto.name,
        email: createUserDto.email,
        username: normalized,
        password: createUserDto.password,
        role: createUserDto.role,
        skills: createUserDto.skills,
        linkedIn: createUserDto.linkedIn,
        university: createUserDto.university,
        phone: createUserDto.phone,
        phoneVerified: createUserDto.phoneVerified,
        phoneVerifiedAt: createUserDto.phoneVerifiedAt,
        avatar: createUserDto.avatar,
        links: createUserDto.links,
        status: createUserDto.status,
        flags: createUserDto.flags,
        emailVerified: createUserDto.emailVerified,
        emailVerifiedAt: createUserDto.emailVerifiedAt,
        profileComplete: createUserDto.profileComplete,
        usernameAutoGenerated: createUserDto.usernameAutoGenerated,
        profile: createUserDto.profile,
      },
      customId,
    );

    // Policy plan: new accounts start at 100 reputation in ReputationService
    try {
      if (created?.id) {
        this.getReputationService()?.recordInitial(String(created.id));
      }
    } catch (err: any) {
      console.warn('[users.service] Suppressed non-critical error adding initial rep ledger:', err?.message || err);
    }

    return this.toSafeUser(created);
  }

  private resolveSuperUserRoleInput(rawRole?: string): UserRole {
    if (!rawRole) return UserRole.Collaborator;
    const norm = normalizeRole(rawRole);
    if (norm === 'superuser') return UserRole.SuperUser;
    if (norm === 'admin') return UserRole.Administrator;
    if (norm === 'mentor') return UserRole.Mentor;
    if (norm === 'project-owner') return UserRole.ProjectOwner;
    if (norm === 'collaborator') return UserRole.Collaborator;
    throw new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      code: 'INVALID_ROLE',
      message: `Invalid role specified: ${rawRole}`,
    });
  }

  private generateUniqueUsernameFromEmail(email: string): string {
    const localPart = String(email || 'user')
      .split('@')[0]
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .slice(0, 22);
    let base = localPart.length >= 3 ? localPart : `${localPart || 'user'}__`.slice(0, 3);
    if (!/^[a-zA-Z0-9_-]{3,30}$/.test(base)) {
      base = 'user_acct';
    }
    let candidate = base;
    let suffix = 1;
    while (!this.isUsernameAvailable(candidate)) {
      candidate = `${base.slice(0, 24)}_${suffix++}`;
    }
    return candidate;
  }

  async createBySuperUser(dto: SuperUserCreateUserDto, actorId?: string): Promise<any> {
    const cleanEmail = String(dto.email || '').trim().toLowerCase();
    const cleanName = String(dto.name || '').trim();
    if (!cleanName || !cleanEmail) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'BAD_REQUEST',
        message: 'Name and email are required.',
      });
    }

    const desiredRole = this.resolveSuperUserRoleInput(dto.role);
    const username = dto.username
      ? this.normalizeUsername(dto.username)
      : this.generateUniqueUsernameFromEmail(cleanEmail);

    if (dto.linkedIn) {
      assertSafeHttpUrl(dto.linkedIn, 'linkedIn', actorId || 'superuser', this.auditService);
    }

    this.contentFilterService?.assertClean(
      {
        name: cleanName,
        username,
        bio: dto.bio,
        university: dto.university,
        skills: dto.skills,
      },
      ['name', 'username', 'bio', 'university', 'skills'],
      { actorId: String(actorId || 'superuser'), entityType: 'user', entityId: username },
    );

    const internalRandomPassword = crypto.randomBytes(24).toString('base64url');
    const created = this.create({
      name: cleanName,
      email: cleanEmail,
      username,
      password: internalRandomPassword,
      role: desiredRole,
      skills: Array.isArray(dto.skills) ? dto.skills : [],
      university: dto.university || '',
      linkedIn: dto.linkedIn,
      emailVerified: false,
      profileComplete: true,
      profile: {
        fullName: cleanName,
        username,
        bio: dto.bio || '',
        university: dto.university || '',
        uni: dto.university || '',
        linkedin: dto.linkedIn,
        skills: Array.isArray(dto.skills) ? dto.skills : [],
        xp: 0,
        mentorUnlocked: desiredRole === UserRole.Mentor,
        tasksCount: 0,
      },
    });

    try {
      const authService = this.moduleRef.get<any>('AUTH_SERVICE', { strict: false });
      await authService?.issuePasswordSetupLink?.({
        id: String(created.id),
        email: created.email,
        name: created.name,
        role: desiredRole,
      });
    } catch (err: any) {
      this.logger.warn(`Failed to issue password setup link for ${created.email}: ${err?.message || err}`);
    }

    this.auditService?.log({
      action: 'USER_CREATED_BY_SUPERUSER',
      actor: String(actorId || 'superuser'),
      performedBy: String(actorId || 'superuser'),
      target: `User #${String(created.id)} (${created.email})`,
      entityType: 'user',
      entityId: String(created.id),
      event: `Super User created account for ${created.email} with role ${desiredRole}`,
      details: {
        userId: String(created.id),
        email: created.email,
        role: desiredRole,
        passwordResetSent: true,
      },
    });

    return serializeSafeUser(
      {
        ...created,
        passwordResetSent: true,
      },
      this.gamificationRepository,
    );
  }

  update(id: string, updateUserDto: InternalUpdateUserInput): any {
    const existingUser = this.usersRepository.findById(id);
    if (!existingUser) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }

    const newUsername =
      updateUserDto.username || updateUserDto.profile?.username;
    if (newUsername !== undefined && newUsername !== null) {
      const trimmedNew = this.normalizeUsername(newUsername);
      const current1 = this.normalizeUsername(existingUser.username);
      const current2 = this.normalizeUsername(existingUser.profile?.username);

      if ((current1 || current2) && trimmedNew !== current1 && trimmedNew !== current2) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          code: 'USERNAME_IMMUTABLE',
          message: "Your username can't be changed.",
        });
      }
    }

    if (
      updateUserDto.email &&
      updateUserDto.email.trim().toLowerCase() !==
        existingUser.email?.trim().toLowerCase()
    ) {
      if (!this.isEmailAvailable(updateUserDto.email, id)) {
        throw new ConflictException('An account with this email already exists');
      }
    }

    const rawUni =
      (updateUserDto as any).university !== undefined
        ? (updateUserDto as any).university
        : (updateUserDto.profile as any)?.university !== undefined
        ? (updateUserDto.profile as any)?.university
        : (updateUserDto.profile as any)?.uni;
    if (rawUni !== undefined && rawUni !== null) {
      const trimmedUni = String(rawUni).trim();
      if (trimmedUni !== '') {
        if (trimmedUni.length < 2 || trimmedUni.length > 100) {
          throw new BadRequestException('University must be between 2 and 100 characters');
        }
        const UNIVERSITY_REGEX = /^[a-zA-Z0-9\s.,&\-'()]+$/;
        if (!UNIVERSITY_REGEX.test(trimmedUni)) {
          throw new BadRequestException("University contains invalid characters. Use letters, numbers, spaces, and common punctuation (. , & - ' ( ))");
        }
      }
      (updateUserDto as any).university = trimmedUni;
      if (updateUserDto.profile) {
        (updateUserDto.profile as any).university = trimmedUni;
        (updateUserDto.profile as any).uni = trimmedUni;
      }
    }

    // Validate any user-supplied URLs (linkedIn, portfolio, website)
    const rawLinkedin = updateUserDto.linkedIn || (updateUserDto as any).linkedin || updateUserDto.profile?.linkedin || updateUserDto.profile?.linkedIn;
    if (rawLinkedin) {
      assertSafeHttpUrl(rawLinkedin, 'linkedIn', id, this.auditService);
    }
    const rawPortfolio = (updateUserDto as any).portfolio || updateUserDto.profile?.portfolio;
    if (rawPortfolio) {
      assertSafeHttpUrl(rawPortfolio, 'portfolio', id, this.auditService);
    }
    const rawWebsite = (updateUserDto as any).website || updateUserDto.profile?.website;
    if (rawWebsite) {
      assertSafeHttpUrl(rawWebsite, 'website', id, this.auditService);
    }

    // Phase 16: Filter user-editable profile text fields before applying changes
    this.contentFilterService?.assertClean(
      {
        name: updateUserDto.name ?? updateUserDto.profile?.fullName,
        username: updateUserDto.username ?? updateUserDto.profile?.username,
        bio: (updateUserDto as any).bio ?? updateUserDto.profile?.bio,
        title: (updateUserDto as any).title ?? updateUserDto.profile?.title,
        university: rawUni,
        skills: updateUserDto.skills ?? updateUserDto.profile?.skills,
      },
      ['name', 'username', 'bio', 'title', 'university', 'skills'],
      { actorId: String(id), entityType: 'user', entityId: String(id) },
    );

    // Strip any client attempts to set phoneVerified or phoneVerifiedAt directly
    delete (updateUserDto as any).phoneVerified;
    delete (updateUserDto as any).phoneVerifiedAt;
    if (updateUserDto.profile) {
      delete (updateUserDto.profile as any).phoneVerified;
      delete (updateUserDto.profile as any).phoneVerifiedAt;
    }

    // Enforce verified phone invariant: phone number cannot be added or changed directly via update
    const rawReqPhone =
      (updateUserDto as any).phone !== undefined
        ? (updateUserDto as any).phone
        : (updateUserDto.profile as any)?.phone;
    if (rawReqPhone !== undefined && rawReqPhone !== null) {
      const cleanExistingPhone = String(existingUser.phone || existingUser.profile?.phone || '').trim();
      const cleanReqPhone = String(rawReqPhone).trim();
      if (cleanReqPhone !== '' && cleanReqPhone !== cleanExistingPhone) {
        throw new BadRequestException(
          'Phone number can only be added or changed after verification with Firebase OTP. Use the verified phone endpoint.',
        );
      }
      if (cleanReqPhone === '' && cleanExistingPhone !== '') {
        throw new BadRequestException(
          'To remove your phone number, use DELETE /users/me/phone.',
        );
      }
    }

    const updatedUser = this.usersRepository.update(id, updateUserDto);
    if (!updatedUser) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }
    return this.toSafeUser(updatedUser);
  }

  async selfUpdate(
    id: string,
    body: SelfUpdateUserDto | Record<string, any>,
    context: { callerId: string; jti?: string; refreshToken?: string; ip?: string },
  ): Promise<any> {
    if (!context?.callerId || String(context.callerId) !== String(id)) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'NOT_YOUR_ACCOUNT',
        message: 'You can only update your own account.',
      });
    }

    const rejectedFields = findDisallowedSelfUpdateFields(body);
    if (rejectedFields.length > 0) {
      this.auditService?.log({
        action: 'USER_UPDATE_REJECTED_FIELD',
        actor: String(context.callerId),
        performedBy: String(context.callerId),
        target: `User #${String(id)}`,
        entityType: 'user',
        entityId: String(id),
        event: `Rejected disallowed field(s) in self-update: ${rejectedFields.join(', ')}`,
        details: { rejectedFields },
      });
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'FIELD_NOT_ALLOWED',
        message: `Field(s) not allowed: ${rejectedFields.join(', ')}`,
        rejectedFields,
      });
    }

    const existingUser = this.usersRepository.findById(String(id));
    if (!existingUser || existingUser.isDeleted || existingUser.deletedAt) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }

    if (body?.links && typeof body.links === 'object') {
      for (const [linkKey, linkVal] of Object.entries(body.links)) {
        if (typeof linkVal === 'string' && linkVal.trim()) {
          assertSafeHttpUrl(linkVal, `links.${linkKey}`, String(id), this.auditService);
        }
      }
    }

    let normalizedNewEmail: string | undefined;
    let emailChanged = false;
    if (body?.email !== undefined) {
      normalizedNewEmail = String(body.email).trim().toLowerCase();
      if (!normalizedNewEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedNewEmail)) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          code: 'INVALID_EMAIL',
          message: 'Please provide a valid email address.',
        });
      }
      const existingNormalizedEmail = String(existingUser.email || '').trim().toLowerCase();
      if (normalizedNewEmail !== existingNormalizedEmail) {
        if (!this.isEmailAvailable(normalizedNewEmail, String(id))) {
          throw new ConflictException({
            statusCode: 409,
            error: 'Conflict',
            code: 'EMAIL_TAKEN',
            message: 'An account with this email already exists',
          });
        }
        emailChanged = true;
      }
    }

    const rawBody: any = body;
    const rawProfile: Record<string, any> =
      rawBody?.profile && typeof rawBody.profile === 'object' ? { ...rawBody.profile } : {};

    const existingUsername = existingUser.username || existingUser.profile?.username;
    const requestedUsername =
      rawBody?.username !== undefined
        ? this.normalizeUsername(rawBody.username)
        : rawProfile.username !== undefined
        ? this.normalizeUsername(rawProfile.username)
        : undefined;

    if (
      requestedUsername !== undefined &&
      existingUsername &&
      requestedUsername !== this.normalizeUsername(existingUsername)
    ) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'USERNAME_IMMUTABLE',
        message: "Your username can't be changed.",
      });
    }

    const resolvedName = rawBody?.name !== undefined ? rawBody.name : rawProfile.fullName;
    const resolvedBio = rawBody?.bio !== undefined ? rawBody.bio : rawProfile.bio;
    const resolvedTitle = rawBody?.title !== undefined ? rawBody.title : rawProfile.title;
    const resolvedUni =
      rawBody?.university !== undefined ? rawBody.university : rawProfile.university;
    const resolvedAvatar =
      rawBody?.avatar !== undefined
        ? rawBody.avatar
        : rawBody?.avatarUrl !== undefined
        ? rawBody.avatarUrl
        : rawProfile.avatar !== undefined
        ? rawProfile.avatar
        : rawProfile.avatarUrl;
    const resolvedSkills = rawBody?.skills !== undefined ? rawBody.skills : rawProfile.skills;
    const resolvedLinkedIn =
      rawBody?.linkedIn !== undefined
        ? rawBody.linkedIn
        : rawBody?.linkedin !== undefined
        ? rawBody.linkedin
        : rawProfile.linkedIn !== undefined
        ? rawProfile.linkedIn
        : rawProfile.linkedin;
    const resolvedPortfolio =
      rawBody?.portfolio !== undefined ? rawBody.portfolio : rawProfile.portfolio;
    const resolvedWebsite =
      rawBody?.website !== undefined ? rawBody.website : rawProfile.website;

    const allowedUpdate: InternalUpdateUserInput = {};
    if (resolvedName !== undefined) allowedUpdate.name = resolvedName;
    if (normalizedNewEmail !== undefined) allowedUpdate.email = normalizedNewEmail;
    if (resolvedUni !== undefined) allowedUpdate.university = resolvedUni;
    if (resolvedAvatar !== undefined) allowedUpdate.avatar = resolvedAvatar;
    if (resolvedSkills !== undefined) allowedUpdate.skills = resolvedSkills;
    if (resolvedLinkedIn !== undefined) allowedUpdate.linkedIn = resolvedLinkedIn;
    if (body?.links !== undefined) allowedUpdate.links = body.links;
    if (body?.settings !== undefined && typeof body.settings === 'object') {
      allowedUpdate.settings = {
        ...((existingUser as any).settings || {}),
        ...body.settings,
      };
    }

    const nextProfile: Record<string, any> = {};
    if (resolvedName !== undefined) nextProfile.fullName = resolvedName;
    if (resolvedBio !== undefined) nextProfile.bio = resolvedBio;
    if (resolvedTitle !== undefined) nextProfile.title = resolvedTitle;
    if (resolvedUni !== undefined) {
      nextProfile.university = resolvedUni;
      nextProfile.uni = resolvedUni;
    }
    if (resolvedAvatar !== undefined) nextProfile.avatar = resolvedAvatar;
    if (resolvedSkills !== undefined) nextProfile.skills = resolvedSkills;
    if (resolvedLinkedIn !== undefined) {
      nextProfile.linkedin = resolvedLinkedIn;
      nextProfile.linkedIn = resolvedLinkedIn;
    }
    if (resolvedPortfolio !== undefined) nextProfile.portfolio = resolvedPortfolio;
    if (resolvedWebsite !== undefined) nextProfile.website = resolvedWebsite;

    if (Object.keys(nextProfile).length > 0) {
      allowedUpdate.profile = nextProfile;
    }

    this.update(String(id), allowedUpdate);

    if (
      body?.digestEnabled !== undefined ||
      body?.digestHour !== undefined ||
      body?.utcOffsetMinutes !== undefined
    ) {
      this.updateDigestSettings(String(id), {
        digestEnabled: body.digestEnabled,
        digestHour: body.digestHour,
        utcOffsetMinutes: body.utcOffsetMinutes,
      });
    }

    if (emailChanged) {
      const updatedRaw = this.usersRepository.findById(String(id));
      if (updatedRaw) {
        updatedRaw.emailVerified = false;
        updatedRaw.emailVerifiedAt = undefined;
        const keepRefreshHash = context.refreshToken
          ? crypto.createHash('sha256').update(context.refreshToken).digest('hex')
          : undefined;
        this.usersRepository.revokeOtherSessions(String(id), context.jti, keepRefreshHash);

        try {
          const authService = this.moduleRef.get<any>('AUTH_SERVICE', { strict: false });
          await authService?.issueEmailVerificationForUser?.(updatedRaw);
        } catch (err: any) {
          this.logger.warn(
            `Failed to send verification email after email change for ${id}: ${err?.message || err}`,
          );
        }

        try {
          this.duplicateDetectionService?.scanAndFlag?.(
            String(id),
            updatedRaw.name || updatedRaw.username || updatedRaw.email,
          );
        } catch {
          // Non-critical duplicate scan
        }

        this.auditService?.log({
          action: 'USER_EMAIL_CHANGED',
          actor: String(context.callerId),
          performedBy: String(context.callerId),
          target: `User #${String(id)}`,
          entityType: 'user',
          entityId: String(id),
          event: `User #${String(id)} changed email and invalidated verification + other sessions`,
          details: { userId: String(id), newEmail: normalizedNewEmail },
        });
      }
    }

    const finalRaw = this.usersRepository.findById(String(id));
    return this.toSafeUser(finalRaw!);
  }

  switchRole(userId: string, requestedRole: string): { role: string } {
    const user = this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found.`);
    }

    const normalizedReq = normalizeRole(requestedRole);

    // Super User and Admin roles can NEVER be obtained via switch-role
    if (normalizedReq === 'admin' || normalizedReq === 'superuser') {
      throw new ForbiddenException('Admin roles cannot be assumed via role switch.');
    }

    let targetRole: UserRole;
    if (normalizedReq === 'project-owner') {
      targetRole = UserRole.ProjectOwner;
    } else if (normalizedReq === 'collaborator') {
      targetRole = UserRole.Collaborator;
    } else if (normalizedReq === 'mentor') {
      const isApproved = Boolean(
        user.profile?.mentorUnlocked ||
          (user.data as any)?.mentorUnlocked ||
          user.role === UserRole.Mentor,
      );
      if (!isApproved) {
        throw new ForbiddenException(
          'Mentor role requires an approved mentor application.',
        );
      }
      targetRole = UserRole.Mentor;
    } else {
      throw new BadRequestException(`Invalid role requested: ${requestedRole}`);
    }

    user.role = targetRole;
    if (user.profile) {
      if (targetRole === UserRole.Mentor) {
        user.profile.mentorUnlocked = true;
      }
    }

    return { role: targetRole };
  }

  bumpTokenVersion(id: string): number {
    return this.usersRepository.bumpTokenVersion(id);
  }

  addRefreshToken(
    id: string,
    tokenHash: string,
    expiresAt: Date,
    device?: string,
  ): void {
    this.usersRepository.addRefreshToken(id, tokenHash, expiresAt, device);
  }

  revokeRefreshToken(id: string, tokenHash: string): boolean {
    return this.usersRepository.revokeRefreshToken(id, tokenHash);
  }

  revokeAllRefreshTokens(id: string): void {
    this.usersRepository.revokeAllRefreshTokens(id);
  }

  toSafeUser(user: User): any {
    return serializeSafeUser(user, this.gamificationRepository, this.getReputationService());
  }

  async getPublicProfile(targetUserId: string, callerId?: string, callerRole?: string): Promise<any> {
    const user = this.usersRepository.findById(targetUserId);
    if (!user || user.isDeleted || user.deletedAt) {
      throw new NotFoundException(`User with ID ${targetUserId} not found.`);
    }

    const { ProjectsService } = await import('../projects/projects.service');
    const { JoinRequestsService } = await import('../join-requests/join-requests.service');
    const { TasksService } = await import('../tasks/tasks.service');
    const projectsService = (this as any).projectsService || (this.moduleRef ? this.moduleRef.get(ProjectsService, { strict: false }) : null);
    const joinRequestsService = (this as any).joinRequestsService || (this.moduleRef ? this.moduleRef.get(JoinRequestsService, { strict: false }) : null);
    const tasksService = (this as any).tasksService || (this.moduleRef ? this.moduleRef.get(TasksService, { strict: false }) : null);

    const isSelf = callerId && String(callerId) === String(targetUserId);
    const normalizedRole = normalizeRole(callerRole || '');
    const isAdmin = normalizedRole === 'admin' || normalizedRole === 'superuser';
    let isAuthorized = Boolean(isSelf || isAdmin);

    if (!isAuthorized && callerId) {
      // Find all projects owned by callerId
      const callerProjects = (projectsService ? projectsService.findAll('all') : []).filter(
        (p) => String(p.ownerId) === String(callerId) || (typeof p.owner === 'object' && String((p.owner as any)?.id) === String(callerId)),
      );
      const callerProjectIds = new Set(callerProjects.map((p) => String(p.id)));

      if (callerProjectIds.size > 0) {
        // Check if target user has a join request for any of these projects
        const allRequests = joinRequestsService.findAll();
        const hasEligibleRequest = allRequests.some((req) => {
          const matchesApplicant =
            String(req.userId) === String(targetUserId) ||
            (req.userName && req.userName.toLowerCase() === (user.name || '').toLowerCase());
          const matchesProject = callerProjectIds.has(String(req.projectId));
          const isPendingOrApproved = ['pending', 'approved', 'accepted'].includes(
            String(req.status || '').toLowerCase(),
          );
          return matchesApplicant && matchesProject && isPendingOrApproved;
        });

        // Check if target user is an accepted collaborator on any of caller's projects
        const isCollaborator = callerProjects.some((p) => {
          const collabs = Array.isArray(p.collaborators) ? p.collaborators : [];
          return collabs.some((c: any) => {
            if (typeof c === 'string') return String(c) === String(targetUserId);
            return String(c.id || c.userId) === String(targetUserId);
          });
        });

        // Check if target user is an assigned or completed mentor on any of caller's projects
        const isMentor = callerProjects.some((p: any) => {
          const mid = String(p.mentorId || (typeof p.mentor === 'object' && p.mentor ? (p.mentor.id || p.mentor.userId) : '') || '');
          const compMid = String(p.completedMentorUserId || p.mentorUserId || '');
          return mid === String(targetUserId) || compMid === String(targetUserId);
        });

        if (hasEligibleRequest || isCollaborator || isMentor) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      throw new ForbiddenException("You do not have permission to view this applicant's profile.");
    }

    // Ledger totals
    const ledgerEntries = this.gamificationRepository.findByUserId(targetUserId) || [];
    const totalXp = ledgerEntries.reduce((s, e) => s + (Number(e.xp) || 0), 0);
    const repSvc = this.getReputationService();
    const totalRep = repSvc ? repSvc.getTotal(String(targetUserId)) : 0;
    const tasksCompletedCount = ledgerEntries.filter((e) => Boolean(e.taskId)).length;

    // Completed projects with link
    const allProjects = projectsService ? projectsService.findAll('all') : [];
    const userProjects = allProjects.filter((p: any) => {
      const role = getProjectRole(p, targetUserId);
      return role === 'Owner' || role === 'Mentor' || role === 'Collaborator';
    });

    const targetIdStr = String(targetUserId);
    const targetName = String(user.name || (user.profile as any)?.fullName || '').toLowerCase().trim();
    const targetUsername = String(user.username || (user.profile as any)?.username || '').toLowerCase().trim();
    const targetEmail = String(user.email || '').toLowerCase().trim();

    const completedProjects = userProjects
      .filter((p: any) => {
        if (!p) return false;
        // Skip any with deletedAt, deletionScheduledAt, or status === 'deleted'
        if (p.deletedAt || p.deletionScheduledAt || String(p.status || '').toLowerCase() === 'deleted') {
          return false;
        }

        const isCompleted = p.isCompleted === true || p.is_completed === true || String(p.status || '').toLowerCase() === 'completed';
        if (!isCompleted) return false;

        const role = getProjectRole(p, targetUserId);
        // Always include projects where role is 'Owner' or 'Mentor'
        if (role === 'Owner' || role === 'Mentor') {
          return true;
        }

        // For 'Collaborator', require at least one completed task in this project
        if (role === 'Collaborator') {
          if (tasksService && typeof tasksService.findAllByProjectId === 'function') {
            try {
              const tasks = tasksService.findAllByProjectId(p.id) || [];
              return tasks.some((t: any) => {
                const aId = String(t.assigneeId || (typeof t.assignee === 'object' && t.assignee ? (t.assignee.id || t.assignee.userId) : '') || '');
                const aStr = typeof t.assignee === 'string' ? t.assignee.toLowerCase().trim() : '';
                const aAssignedTo = typeof t.assignedTo === 'string' ? t.assignedTo.toLowerCase().trim() : '';
                const aName = typeof t.assigneeName === 'string' ? t.assigneeName.toLowerCase().trim() : '';

                const matchesUser =
                  (aId && aId === targetIdStr) ||
                  (aStr && (aStr === targetIdStr || (targetUsername && aStr === targetUsername) || (targetName && aStr === targetName) || (targetEmail && aStr === targetEmail))) ||
                  (aAssignedTo && (aAssignedTo === targetIdStr || (targetName && aAssignedTo === targetName))) ||
                  (aName && (aName === targetIdStr || (targetName && aName === targetName)));

                if (!matchesUser) return false;

                const st = String(t.status || '').toLowerCase().trim();
                return st === 'completed' || st === 'approved' || st === 'done';
              });
            } catch {
              return false;
            }
          }
          return false;
        }

        return false;
      })
      .map((p: any) => {
        const projectRole = getProjectRole(p, targetUserId) || 'Collaborator';
        return {
          id: p.id,
          title: p.title || p.name || 'Untitled Project',
          description: p.description || p.desc || '',
          role: projectRole,
          projectRole,
          link: p.finalLink || p.finishedLink || p.deliverableUrl || null,
          completedAt: p.completedAt || p.updatedAt || p.dueDate || null,
        };
      });

    // Recommendation badges
    const badges =
      user.data?.mentorRecommendations ||
      (user.profile as any)?.mentorRecommendations ||
      (user.profile as any)?.badges ||
      [];

    // Contribution history
    const contributionHistory = ledgerEntries.map((e) => ({
      id: e.id,
      date: e.date,
      reason: e.reason,
      xp: e.xp,
      taskId: e.taskId || null,
      projectId: e.projectId || null,
    }));

    const mentoredProjects = await this.getLiveMentoredProjects(targetUserId, {
      completedOnly: true,
    });

    const profile = (user.profile as any) || {};
    const userAny = user as any;
    const effectiveUni = user.university || profile.university || profile.uni || null;
    const effectiveJoined = user.createdAt || profile.joined || null;

    return {
      id: user.id,
      name: user.name || profile.fullName || profile.name || 'Anonymous User',
      username: user.username || profile.username || '',
      avatar: userAny.avatar || profile.avatar || null,
      role: user.role,
      university: effectiveUni,
      bio: profile.bio || userAny.bio || '',
      skills: profile.skills || user.skills || [],
      memberSince: effectiveJoined,
      xp: totalXp,
      rep: totalRep,
      projectsCount: userProjects.length,
      tasksCompleted: tasksCompletedCount,
      recommendationBadges: badges,
      completedProjects,
      mentoredProjects,
      contributionHistory,
      linkedIn: profile.linkedin || profile.linkedIn || user.linkedIn || profile.socialLinks?.linkedIn || null,
      // Strictly NO: email, phone, warnings, suspensions, flagControls, recentActivity
    };
  }

  getApplicantProfile(targetUserId: string, callerId?: string, callerRole?: string) {
    return this.getPublicProfile(targetUserId, callerId, callerRole);
  }

  delete(id: string): void {
    const isDeleted = this.usersRepository.delete(id);
    if (!isDeleted) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Phone Verification with Firebase OTP (Phase 3)
  // ─────────────────────────────────────────────────────────────────────────

  private getNowMs(): number {
    return this.clockService ? this.clockService.now().getTime() : Date.now();
  }

  private normalizePhoneForComparison(rawPhone?: string): string {
    if (this.duplicateDetectionService) {
      return this.duplicateDetectionService.normalizePhone(rawPhone);
    }
    const raw = String(rawPhone || '').trim();
    if (!raw) return '';
    const hasPlus = raw.startsWith('+');
    const digits = raw.replace(/\D/g, '');
    return digits.length >= 7 ? (hasPlus ? `+${digits}` : digits) : '';
  }

  private assertPhoneNotUsedByOtherNonDeleted(phoneNumber: string, excludeUserId: string): void {
    const targetNorm = this.normalizePhoneForComparison(phoneNumber) || phoneNumber.trim();
    const allUsers = this.usersRepository.getAllRawUsers();
    const existing = allUsers.find((u) => {
      if (String(u.id) === String(excludeUserId)) return false;
      if (u.isDeleted || u.deletedAt || u.isHidden || u.isDuplicate) return false;
      const verified = u.phoneVerified === true || u.profile?.phoneVerified === true;
      if (!verified) return false;
      const existingRaw = u.phone || u.profile?.phone || '';
      const existingNorm = this.normalizePhoneForComparison(existingRaw) || String(existingRaw).trim();
      return existingRaw === phoneNumber || (Boolean(targetNorm) && existingNorm === targetNorm);
    });
    if (existing) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'PHONE_ALREADY_USED',
        message: 'This phone number is already linked to another account',
      });
    }
  }

  private completePhoneVerification(userId: string, phoneNumber: string): any {
    const existingUser = this.usersRepository.findById(userId);
    if (!existingUser) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const nowDate = this.clockService ? this.clockService.now() : new Date();
    const verifiedAt = nowDate.toISOString();
    existingUser.phone = phoneNumber;
    existingUser.phoneVerified = true;
    existingUser.phoneVerifiedAt = verifiedAt;
    if (!existingUser.profile) {
      existingUser.profile = {} as any;
    }
    existingUser.profile.phone = phoneNumber;
    existingUser.profile.phoneVerified = true;
    existingUser.profile.phoneVerifiedAt = verifiedAt;

    this.usersRepository.update(userId, {
      phone: phoneNumber,
      phoneVerified: true,
      phoneVerifiedAt: verifiedAt,
      profile: {
        ...existingUser.profile,
        phone: phoneNumber,
        phoneVerified: true,
        phoneVerifiedAt: verifiedAt,
      } as any,
    });

    this.otpChallenges.delete(String(userId));
    this.duplicateDetectionService?.scanAndFlag(String(userId), existingUser.email || existingUser.name);

    this.auditService.log({
      action: 'phone-verified',
      performedBy: existingUser.email || existingUser.name,
      target: `Phone number verified for ${existingUser.name} (${existingUser.id})`,
      entityId: existingUser.id,
      entityType: 'user',
      details: {
        userId,
        phone: phoneNumber,
        phoneVerifiedAt: verifiedAt,
      },
    });

    try {
      this.notificationsService.create({
        userId,
        type: 'PHONE_VERIFIED',
        title: 'Phone Number Verified',
        message: `Your phone number ${phoneNumber} has been verified successfully.`,
      });
    } catch (err: any) {
      this.logger.warn(`Could not create notification for phone verification: ${err?.message}`);
    }

    return this.toSafeUser(existingUser);
  }

  private assertOtpNotLocked(userId: string): void {
    const state = this.otpChallenges.get(String(userId));
    if (!state?.lockedUntilMs) return;
    const nowMs = this.getNowMs();
    if (nowMs < state.lockedUntilMs) {
      const remainingSeconds = Math.max(1, Math.ceil((state.lockedUntilMs - nowMs) / 1000));
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          code: 'OTP_LOCKED',
          message: 'Too many incorrect OTP attempts. Please try again after the lockout expires.',
          retryAt: new Date(state.lockedUntilMs).toISOString(),
          cooldownSeconds: remainingSeconds,
          wrongAttempts: state.wrongAttempts,
          attemptsRemaining: 0,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    // Lock expired; clear stale lock while preserving challenge emptiness
    state.lockedUntilMs = undefined;
    state.wrongAttempts = 0;
  }

  getOtpStatus(userId: string) {
    const nowMs = this.getNowMs();
    const state = this.otpChallenges.get(String(userId));
    if (state?.lockedUntilMs && nowMs >= state.lockedUntilMs) {
      state.lockedUntilMs = undefined;
      state.wrongAttempts = 0;
    }
    const locked = Boolean(state?.lockedUntilMs && nowMs < state.lockedUntilMs);
    const wrongAttempts = state?.wrongAttempts || 0;
    const remainingSeconds = locked && state?.lockedUntilMs
      ? Math.max(1, Math.ceil((state.lockedUntilMs - nowMs) / 1000))
      : 0;
    return {
      locked,
      wrongAttempts,
      maxAttempts: this.MAX_OTP_WRONG_ATTEMPTS,
      attemptsRemaining: locked ? 0 : Math.max(0, this.MAX_OTP_WRONG_ATTEMPTS - wrongAttempts),
      codeVoid: Boolean(state?.codeVoid),
      retryAt: locked && state?.lockedUntilMs ? new Date(state.lockedUntilMs).toISOString() : null,
      remainingSeconds,
      phone: state?.phone || null,
    };
  }

  requestPhoneOtp(userId: string, rawPhone: string): any {
    const existingUser = this.usersRepository.findById(userId);
    if (!existingUser) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    const phone = String(rawPhone || '').trim();
    if (!phone || this.normalizePhoneForComparison(phone) === '') {
      throw new BadRequestException({
        statusCode: 400,
        code: 'INVALID_PHONE',
        message: 'A valid phone number is required.',
      });
    }

    this.assertOtpNotLocked(String(userId));
    this.assertPhoneNotUsedByOtherNonDeleted(phone, String(userId));

    const nowMs = this.getNowMs();
    const code = String(crypto.randomInt(100000, 999999));
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    this.otpChallenges.set(String(userId), {
      phone,
      codeHash,
      codeVoid: false,
      wrongAttempts: 0,
      expiresAtMs: nowMs + this.OTP_EXPIRY_MS,
    });

    if (process.env.NODE_ENV !== 'test') {
      this.logger.log(`[OTP] Generated phone verification challenge for user ${userId}`);
    }

    return {
      message: 'Verification OTP generated successfully.',
      phone,
      expiresAt: new Date(nowMs + this.OTP_EXPIRY_MS).toISOString(),
      maxAttempts: this.MAX_OTP_WRONG_ATTEMPTS,
      attemptsRemaining: this.MAX_OTP_WRONG_ATTEMPTS,
    };
  }

  setOtpChallengeForTest(userId: string, phone: string, code: string): void {
    const nowMs = this.getNowMs();
    const codeHash = crypto.createHash('sha256').update(String(code).trim()).digest('hex');
    this.otpChallenges.set(String(userId), {
      phone,
      codeHash,
      codeVoid: false,
      wrongAttempts: 0,
      expiresAtMs: nowMs + this.OTP_EXPIRY_MS,
    });
  }

  recordFailedOtpAttempt(userId: string): never {
    const uid = String(userId);
    this.assertOtpNotLocked(uid);
    const nowMs = this.getNowMs();
    const state: OtpChallengeState = this.otpChallenges.get(uid) || {
      codeVoid: false,
      wrongAttempts: 0,
    };
    state.wrongAttempts += 1;

    if (state.wrongAttempts >= this.MAX_OTP_WRONG_ATTEMPTS) {
      state.codeVoid = true;
      state.codeHash = undefined;
      state.lockedUntilMs = nowMs + this.OTP_LOCK_DURATION_MS;
      this.otpChallenges.set(uid, state);

      const retryAt = new Date(state.lockedUntilMs).toISOString();
      try {
        this.auditService.log({
          action: 'otp-locked',
          actor: uid,
          target: `User #${uid}`,
          entityId: uid,
          entityType: 'user',
          event: `Phone OTP verification locked for 15 minutes after ${this.MAX_OTP_WRONG_ATTEMPTS} failed attempts`,
          details: { userId: uid, retryAt, wrongAttempts: state.wrongAttempts },
        });
      } catch {}

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          code: 'OTP_LOCKED',
          message: 'Too many wrong OTP attempts. Code invalidated and verification locked for 15 minutes.',
          retryAt,
          cooldownSeconds: Math.ceil(this.OTP_LOCK_DURATION_MS / 1000),
          wrongAttempts: state.wrongAttempts,
          attemptsRemaining: 0,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.otpChallenges.set(uid, state);
    const attemptsRemaining = this.MAX_OTP_WRONG_ATTEMPTS - state.wrongAttempts;
    throw new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      code: 'INVALID_OTP',
      message: `Invalid OTP code. ${attemptsRemaining} attempt(s) remaining.`,
      wrongAttempts: state.wrongAttempts,
      attemptsRemaining,
    });
  }

  verifyPhoneOtp(userId: string, code: string, phoneOverride?: string): any {
    const uid = String(userId);
    this.assertOtpNotLocked(uid);

    const state = this.otpChallenges.get(uid);
    const nowMs = this.getNowMs();
    if (!state || state.codeVoid || !state.codeHash) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'OTP_VOID_OR_MISSING',
        message: 'No active OTP challenge. Please request a new code.',
      });
    }
    if (state.expiresAtMs && nowMs > state.expiresAtMs) {
      state.codeVoid = true;
      state.codeHash = undefined;
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'OTP_EXPIRED',
        message: 'OTP code has expired. Please request a new code.',
      });
    }

    const incomingHash = crypto.createHash('sha256').update(String(code || '').trim()).digest('hex');
    if (incomingHash !== state.codeHash) {
      this.recordFailedOtpAttempt(uid);
    }

    const phone = (phoneOverride || state.phone || '').trim();
    if (!phone) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'INVALID_PHONE',
        message: 'Phone number is required.',
      });
    }

    this.assertPhoneNotUsedByOtherNonDeleted(phone, uid);
    return this.completePhoneVerification(uid, phone);
  }

  checkPhoneVerifyRateLimit(userId: string): void {
    const now = this.getNowMs();
    const windowMs = 60 * 60 * 1000; // 1 hour
    const attempts = (this.phoneVerifyAttempts.get(userId) || []).filter((ts) => now - ts < windowMs);
    if (attempts.length >= 5) {
      throw new HttpException(
        'Too many verification attempts. At most 5 verify attempts per user per hour are allowed.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    attempts.push(now);
    this.phoneVerifyAttempts.set(userId, attempts);
  }

  resetPhoneVerifyRateLimitForTesting(userId?: string): void {
    if (userId) {
      this.phoneVerifyAttempts.delete(userId);
      this.otpChallenges.delete(String(userId));
    } else {
      this.phoneVerifyAttempts.clear();
      this.otpChallenges.clear();
    }
  }

  async verifyPhone(userId: string, idToken: string): Promise<any> {
    if (!idToken || typeof idToken !== 'string') {
      throw new BadRequestException('idToken is required');
    }

    // Check OTP lockout before processing token
    this.assertOtpNotLocked(String(userId));

    // 1. Rate limiting: max 5 verify attempts per user per hour (429)
    this.checkPhoneVerifyRateLimit(userId);

    // 2. Check if firebase-admin is configured (503 if not)
    if (!this.firebaseService.isConfigured()) {
      throw new HttpException('Phone verification is not configured', HttpStatus.SERVICE_UNAVAILABLE);
    }

    // 3. Verify ID token via firebase-admin
    let decodedToken: any;
    try {
      decodedToken = await this.firebaseService.verifyIdToken(idToken);
    } catch (err: any) {
      this.logger.warn(`Firebase ID token verification failed for user ${userId}: ${err?.message}`);
      if (err?.code === 'app/no-credential' || String(err?.message || '').includes('credential')) {
        throw new HttpException('Phone verification is not configured', HttpStatus.SERVICE_UNAVAILABLE);
      }
      throw new BadRequestException('Invalid or expired phone verification token');
    }

    // 4. Validate sign-in provider and phone_number claim
    const signInProvider = decodedToken.firebase?.sign_in_provider;
    if (signInProvider !== 'phone') {
      throw new BadRequestException('ID token was not issued by the phone sign-in provider');
    }

    const phoneNumber = decodedToken.phone_number;
    if (!phoneNumber) {
      throw new BadRequestException('No phone number found in token claims');
    }

    // 5. Ensure the number is not already verified by another non-deleted user (409 Conflict)
    this.assertPhoneNotUsedByOtherNonDeleted(phoneNumber, userId);

    // 6. Persist verified phone, reset OTP challenge, scan duplicates, audit & notify
    return this.completePhoneVerification(userId, phoneNumber);
  }

  deletePhone(userId: string): any {
    const existingUser = this.usersRepository.findById(userId);
    if (!existingUser) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    existingUser.phone = undefined;
    existingUser.phoneVerified = false;
    existingUser.phoneVerifiedAt = undefined;
    if (existingUser.profile) {
      existingUser.profile.phone = undefined;
      existingUser.profile.phoneVerified = false;
      existingUser.profile.phoneVerifiedAt = undefined;
    }

    this.usersRepository.update(userId, {
      phone: undefined,
      phoneVerified: false,
      phoneVerifiedAt: undefined,
      profile: {
        ...existingUser.profile,
        phone: undefined,
        phoneVerified: false,
        phoneVerifiedAt: undefined,
      } as any,
    });

    this.auditService.log({
      action: 'phone-removed',
      performedBy: existingUser.email || existingUser.name,
      target: `Phone number removed for ${existingUser.name} (${existingUser.id})`,
      entityId: existingUser.id,
      entityType: 'user',
      details: { userId },
    });

    return this.toSafeUser(existingUser);
  }

  getDigestSettings(userId: string): {
    digestEnabled: boolean;
    digestHour: number;
    utcOffsetMinutes: number;
  } {
    const user: any = this.usersRepository.findById(String(userId));
    if (!user || user.isDeleted || user.deletedAt) {
      throw new NotFoundException(`User with ID ${userId} not found.`);
    }
    return {
      digestEnabled: user.digestEnabled !== false,
      digestHour:
        Number.isInteger(user.digestHour) && user.digestHour >= 0 && user.digestHour <= 23
          ? user.digestHour
          : 9,
      utcOffsetMinutes: Number.isInteger(user.utcOffsetMinutes) ? user.utcOffsetMinutes : 0,
    };
  }

  updateDigestSettings(
    userId: string,
    dto: { digestEnabled?: any; digestHour?: any; utcOffsetMinutes?: any },
  ): {
    digestEnabled: boolean;
    digestHour: number;
    utcOffsetMinutes: number;
  } {
    const user: any = this.usersRepository.findById(String(userId));
    if (!user || user.isDeleted || user.deletedAt) {
      throw new NotFoundException(`User with ID ${userId} not found.`);
    }

    const prevEnabled = user.digestEnabled !== false;

    if (dto.digestEnabled !== undefined) {
      if (typeof dto.digestEnabled !== 'boolean') {
        throw new BadRequestException({
          statusCode: 400,
          code: 'INVALID_DIGEST_SETTINGS',
          message: 'digestEnabled must be a boolean.',
        });
      }
      user.digestEnabled = dto.digestEnabled;
    }

    if (dto.digestHour !== undefined) {
      const numHour = Number(dto.digestHour);
      if (
        typeof dto.digestHour !== 'number' ||
        !Number.isInteger(numHour) ||
        numHour < 0 ||
        numHour > 23
      ) {
        throw new BadRequestException({
          statusCode: 400,
          code: 'INVALID_DIGEST_HOUR',
          message: 'digestHour must be an integer between 0 and 23.',
        });
      }
      user.digestHour = numHour;
    }

    if (dto.utcOffsetMinutes !== undefined) {
      const numOff = Number(dto.utcOffsetMinutes);
      if (
        typeof dto.utcOffsetMinutes !== 'number' ||
        !Number.isInteger(numOff) ||
        numOff < -720 ||
        numOff > 840
      ) {
        throw new BadRequestException({
          statusCode: 400,
          code: 'INVALID_UTC_OFFSET',
          message: 'utcOffsetMinutes must be an integer between -720 and 840.',
        });
      }
      user.utcOffsetMinutes = numOff;
    }

    const nextEnabled = user.digestEnabled !== false;
    if (prevEnabled && !nextEnabled) {
      try {
        const digestService = this.moduleRef.get(DigestService, { strict: false });
        digestService?.flushBufferAsImmediate?.(String(user.id));
      } catch {}
    }

    return this.getDigestSettings(userId);
  }
}
