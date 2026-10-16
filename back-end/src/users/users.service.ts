import { Injectable, NotFoundException, ForbiddenException, UnauthorizedException, ConflictException, OnModuleInit } from '@nestjs/common';
import { UsersRepository, User } from './users.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(private readonly usersRepository: UsersRepository) {}

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
        console.warn(`⚠️ Duplicate username "${uname}" detected across user IDs [${userIds.join(', ')}]`);
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

  login(credentials: { email?: string; username?: string; password?: string }): User {
    const users = this.findAll();
    const ident = this.normalizeUsername(credentials.email || credentials.username);
    const user = users.find(
      (u) =>
        (u.email && u.email.toLowerCase().trim() === ident) ||
        (u.username && this.normalizeUsername(u.username) === ident) ||
        (u.profile?.username && this.normalizeUsername(u.profile.username) === ident) ||
        (u.name && u.name.toLowerCase().trim() === ident),
    );
    if (!user) {
      throw new NotFoundException('No account matches that username or email.');
    }
    if ((user.status || '').toLowerCase() === 'suspended') {
      throw new ForbiddenException('This account is suspended. Contact support.');
    }
    if (user.password && credentials.password && user.password !== credentials.password) {
      throw new UnauthorizedException('Incorrect password. Please try again.');
    }
    return user;
  }

  findAll(): User[] {
    return this.usersRepository.findAll();
  }

  findById(id: string): User {
    const user = this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }
    const hasBadges = Array.isArray(user.data?.mentorRecommendations) && user.data.mentorRecommendations.length > 0;
    if (user.profile) {
      user.profile.hasMentorBadge = Boolean(user.profile.hasMentorBadge || hasBadges);
    }
    return user;
  }

  findUserSafe(id: string): User | undefined {
    const user = this.usersRepository.findById(id);
    if (user && user.profile) {
      const hasBadges = Array.isArray(user.data?.mentorRecommendations) && user.data.mentorRecommendations.length > 0;
      user.profile.hasMentorBadge = Boolean(user.profile.hasMentorBadge || hasBadges);
    }
    return user;
  }

  create(createUserDto: CreateUserDto): User {
    const desiredUsername = createUserDto.username || createUserDto.profile?.username || createUserDto.name;
    const normalized = this.normalizeUsername(desiredUsername);

    if (normalized) {
      if (!this.isUsernameAvailable(normalized)) {
        throw new ConflictException('This username is already taken');
      }
    }

    console.log(`📝 Creating new user: ${createUserDto.name} (${createUserDto.email})`);
    return this.usersRepository.create({
      ...createUserDto,
      username: (createUserDto.username || desiredUsername || '').trim(),
    });
  }

  update(id: string, updateUserDto: UpdateUserDto): User {
    const existingUser = this.usersRepository.findById(id);
    if (!existingUser) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }

    const newUsername = updateUserDto.username || updateUserDto.profile?.username;
    if (newUsername !== undefined && newUsername !== null) {
      const trimmedNew = this.normalizeUsername(newUsername);
      const current1 = this.normalizeUsername(existingUser.username);
      const current2 = this.normalizeUsername(existingUser.profile?.username);

      // Only check collision if username changed from existing username
      if (trimmedNew !== current1 && trimmedNew !== current2) {
        if (!this.isUsernameAvailable(trimmedNew, id)) {
          throw new ConflictException('This username is already taken');
        }
      }
    }

    const updatedUser = this.usersRepository.update(id, updateUserDto);
    if (!updatedUser) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }
    return updatedUser;
  }

  delete(id: string): void {
    const isDeleted = this.usersRepository.delete(id);
    if (!isDeleted) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }
  }
}
