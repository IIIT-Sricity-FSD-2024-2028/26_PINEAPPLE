import { Injectable } from '@nestjs/common';
import { CreateUserDto, UserRole, UserStatus } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  skills: string[];
  linkedIn?: string;
  status: UserStatus;
  flags: boolean;
}

@Injectable()
export class UsersRepository {
  private users: User[] = [];

  constructor() {
    // Seed initial test data
    this.users.push({
      id: '1',
      name: 'Priya Patel',
      email: 'priya.patel@teamforge.io',
      role: UserRole.Administrator,
      skills: ['React', 'NestJS', 'System Architecture'],
      linkedIn: 'https://linkedin.com/in/priyapatel',
      status: UserStatus.Active,
      flags: false,
    });
    this.users.push({
      id: '2',
      name: 'Arjun Sharma',
      email: 'arjun.sharma@teamforge.io',
      role: UserRole.Collaborator,
      skills: ['React', 'Python', 'ML'],
      linkedIn: 'https://linkedin.com/in/arjunsharma',
      status: UserStatus.Active,
      flags: false,
    });
    this.users.push({
      id: '3',
      name: 'Kiran Bose',
      email: 'kiran.bose@teamforge.io',
      role: UserRole.Collaborator,
      skills: ['TypeScript', 'Supabase'],
      linkedIn: 'https://linkedin.com/in/kiranbose',
      status: UserStatus.Suspended,
      flags: true,
    });
  }

  findAll(): User[] {
    return this.users;
  }

  findById(id: string): User | undefined {
    return this.users.find((user) => user.id === id);
  }

  create(createUserDto: CreateUserDto): User {
    const newUser: User = {
      id: Date.now().toString(),
      ...createUserDto,
      skills: createUserDto.skills || [],
      status: createUserDto.status || UserStatus.Active,
      flags: createUserDto.flags || false,
    };
    this.users.push(newUser);
    return newUser;
  }

  update(id: string, updateUserDto: UpdateUserDto): User | undefined {
    const userIndex = this.users.findIndex((user) => user.id === id);
    if (userIndex === -1) {
      return undefined;
    }

    this.users[userIndex] = {
      ...this.users[userIndex],
      ...updateUserDto,
    };

    return this.users[userIndex];
  }

  delete(id: string): boolean {
    const initialLength = this.users.length;
    this.users = this.users.filter((user) => user.id !== id);
    return this.users.length < initialLength;
  }
}
