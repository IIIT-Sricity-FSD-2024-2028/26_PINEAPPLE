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
      profile: { xp: 1240, rep: 92, bio: 'Platform Administrator & Full-Stack Developer', username: 'priyapatel' },
    } as any);
    this.users.push({
      id: '2',
      name: 'Arjun Sharma',
      email: 'arjun.sharma@teamforge.io',
      role: UserRole.Collaborator,
      skills: ['React', 'Python', 'ML'],
      linkedIn: 'https://linkedin.com/in/arjunsharma',
      status: UserStatus.Active,
      flags: false,
      profile: { xp: 850, rep: 67, bio: 'ML Engineer & React Developer', username: 'arjunsharma' },
    } as any);
    this.users.push({
      id: '3',
      name: 'Kiran Bose',
      email: 'kiran.bose@teamforge.io',
      role: UserRole.Mentor,
      skills: ['TypeScript', 'Supabase'],
      linkedIn: 'https://linkedin.com/in/kiranbose',
      status: UserStatus.Active,
      flags: false,
      profile: { xp: 320, rep: 28, bio: 'TypeScript Developer', username: 'kiranbose' },
    } as any);
    this.users.push({
      id: '4',
      name: 'Rohan Mehta',
      email: 'rohan.mehta@teamforge.io',
      role: UserRole.Mentor,
      skills: ['UI/UX', 'Figma', 'React'],
      linkedIn: 'https://linkedin.com/in/rohanmehta',
      status: UserStatus.Active,
      flags: false,
      profile: { xp: 950, rep: 88, bio: 'UI/UX Designer', username: 'rohanmehta' },
    } as any);
    this.users.push({
      id: '5',
      name: 'Sneha Iyer',
      email: 'sneha.iyer@teamforge.io',
      role: UserRole.Mentor,
      skills: ['DevOps', 'AWS', 'Docker'],
      linkedIn: 'https://linkedin.com/in/snehaiyer',
      status: UserStatus.Active,
      flags: false,
      profile: { xp: 780, rep: 71, bio: 'Cloud Architect', username: 'snehaiyer' },
    } as any);
    this.users.push({
      id: '6',
      name: 'Aditya Sai',
      email: 'aditya.sai@teamforge.io',
      role: UserRole.Collaborator,
      skills: ['Vue', 'Node.js', 'MongoDB'],
      linkedIn: 'https://linkedin.com/in/adityasai',
      status: UserStatus.Active,
      flags: false,
      profile: { xp: 450, rep: 40, bio: 'Full-Stack Developer', username: 'adityasai' },
    } as any);
    this.users.push({
      id: '7',
      name: 'Neha Gupta',
      email: 'neha.gupta@teamforge.io',
      role: UserRole.Mentor,
      skills: ['Data Science', 'Python', 'TensorFlow'],
      linkedIn: 'https://linkedin.com/in/nehagupta',
      status: UserStatus.Active,
      flags: false,
      profile: { xp: 1100, rep: 85, bio: 'Data Scientist & Mentor', username: 'nehagupta' },
    } as any);
    this.users.push({
      id: '8',
      name: 'Vikram Nair',
      email: 'vikram.nair@teamforge.io',
      role: UserRole.Collaborator,
      skills: ['Java', 'Spring Boot', 'SQL'],
      linkedIn: 'https://linkedin.com/in/vikramnair',
      status: UserStatus.Active,
      flags: false,
      profile: { xp: 200, rep: 15, bio: 'Backend Developer', username: 'vikramnair' },
    } as any);
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
