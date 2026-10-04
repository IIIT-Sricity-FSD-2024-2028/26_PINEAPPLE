import { Injectable } from '@nestjs/common';
import { CreateUserDto, UserRole, UserStatus } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

export interface MentorRecommendation {
  project: string;
  mentor: string;
  note: string;
}

export interface MentoredProject {
  name: string;
  owner: string;
  status: string;
  contribution: string;
}

export interface UserProfile {
  fullName: string;
  username: string;
  bio?: string;
  linkedin?: string;
  phone?: string;
  xp: number;
  rep: number;
  skills: string[];
  mentorUnlocked: boolean;
  title?: string;
  uni?: string;
  joined?: string;
  tasksCount: number;
}

export interface UserData {
  projects: any[];
  notifications: any[];
  requests: any[];
  warnings?: any[];
  mentorRecommendations?: MentorRecommendation[];
  mentoredProjects?: MentoredProject[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  skills: string[];
  linkedIn?: string;
  status: UserStatus;
  flags: boolean;
  profile: UserProfile;
  data: UserData;
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
      profile: {
        fullName: 'Priya Patel',
        username: 'priyapatel',
        bio: 'Platform Administrator & Full-Stack Developer',
        xp: 1240,
        rep: 92,
        skills: ['React', 'NestJS', 'System Architecture'],
        mentorUnlocked: true,
        title: 'Platform Administrator',
        uni: 'IIT Bombay',
        joined: 'Jan 15, 2024',
        tasksCount: 42,
      },
      data: {
        projects: [],
        notifications: [],
        requests: [],
      }
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
      profile: {
        fullName: 'Arjun Sharma',
        username: 'arjunsharma',
        bio: 'Passionate about AI and building scalable web applications. Always open to collaborating on open-source projects and mentoring peers.',
        xp: 2450,
        rep: 87,
        skills: ['React', 'Python', 'Node.js', 'MongoDB', 'TypeScript', 'Machine Learning'],
        mentorUnlocked: true,
        title: 'Full-stack Developer',
        uni: 'IIT Delhi',
        joined: 'Mar 31, 2026',
        tasksCount: 34,
      },
      data: {
        projects: [
          { name: "TeamForge", role: "Frontend Lead", contribution: "Dashboard React Migration", status: "Active" },
          { name: "Smart Grocery App", role: "Full-stack", contribution: "Auth & Database", status: "Active" },
          { name: "AI Portfolio", role: "Solo Developer", contribution: "Built entirely from scratch", status: "Completed", finalLink: "#" }
        ],
        notifications: [],
        requests: [],
        mentorRecommendations: [
          { project: "Smart Grocery App", mentor: "Sarah J.", note: "Exceptional work on the authentication flow." }
        ],
        mentoredProjects: [
          { name: "Data Viz Dashboard", owner: "Rohan D.", status: "Completed", contribution: "Guided the team on best practices for React component composition." }
        ]
      }
    });

    this.users.push({
      id: '3',
      name: 'Kiran Bose',
      email: 'kiran.bose@teamforge.io',
      role: UserRole.Mentor,
      skills: ['TypeScript', 'Supabase'],
      linkedIn: 'https://linkedin.com/in/kiranbose',
      status: UserStatus.Active,
      flags: false,
      profile: {
        fullName: 'Kiran Bose',
        username: 'kiranbose',
        bio: 'TypeScript Developer',
        xp: 320,
        rep: 28,
        skills: ['TypeScript', 'Supabase'],
        mentorUnlocked: true,
        title: 'Backend Developer',
        uni: 'NIT Trichy',
        joined: 'May 10, 2025',
        tasksCount: 15,
      },
      data: {
        projects: [],
        notifications: [],
        requests: [],
      }
    });

    this.users.push({
      id: '4',
      name: 'Rohan Mehta',
      email: 'rohan.mehta@teamforge.io',
      role: UserRole.Mentor,
      skills: ['UI/UX', 'Figma', 'React'],
      linkedIn: 'https://linkedin.com/in/rohanmehta',
      status: UserStatus.Active,
      flags: false,
      profile: {
        fullName: 'Rohan Mehta',
        username: 'rohanmehta',
        bio: 'UI/UX Designer',
        xp: 950,
        rep: 88,
        skills: ['UI/UX', 'Figma', 'React'],
        mentorUnlocked: true,
        title: 'Lead Designer',
        uni: 'NID Ahmedabad',
        joined: 'Aug 22, 2025',
        tasksCount: 27,
      },
      data: {
        projects: [],
        notifications: [],
        requests: [],
      }
    });

    this.users.push({
      id: '5',
      name: 'Sneha Iyer',
      email: 'sneha.iyer@teamforge.io',
      role: UserRole.Mentor,
      skills: ['DevOps', 'AWS', 'Docker'],
      linkedIn: 'https://linkedin.com/in/snehaiyer',
      status: UserStatus.Active,
      flags: false,
      profile: {
        fullName: 'Sneha Iyer',
        username: 'snehaiyer',
        bio: 'Cloud Architect',
        xp: 780,
        rep: 71,
        skills: ['DevOps', 'AWS', 'Docker'],
        mentorUnlocked: true,
        title: 'Cloud Architect',
        uni: 'BITS Pilani',
        joined: 'Feb 14, 2026',
        tasksCount: 19,
      },
      data: {
        projects: [],
        notifications: [],
        requests: [],
      }
    });

    this.users.push({
      id: '6',
      name: 'Aditya Sai',
      email: 'aditya.sai@teamforge.io',
      role: UserRole.Collaborator,
      skills: ['Vue', 'Node.js', 'MongoDB'],
      linkedIn: 'https://linkedin.com/in/adityasai',
      status: UserStatus.Active,
      flags: false,
      profile: {
        fullName: 'Aditya Sai',
        username: 'adityasai',
        bio: 'Full-Stack Developer',
        xp: 450,
        rep: 40,
        skills: ['Vue', 'Node.js', 'MongoDB'],
        mentorUnlocked: false,
        title: 'Web Developer',
        uni: 'VIT Vellore',
        joined: 'Nov 05, 2025',
        tasksCount: 11,
      },
      data: {
        projects: [],
        notifications: [],
        requests: [],
      }
    });

    this.users.push({
      id: '7',
      name: 'Neha Gupta',
      email: 'neha.gupta@teamforge.io',
      role: UserRole.Mentor,
      skills: ['Data Science', 'Python', 'TensorFlow'],
      linkedIn: 'https://linkedin.com/in/nehagupta',
      status: UserStatus.Active,
      flags: false,
      profile: {
        fullName: 'Neha Gupta',
        username: 'nehagupta',
        bio: 'Data Scientist & Mentor',
        xp: 1100,
        rep: 85,
        skills: ['Data Science', 'Python', 'TensorFlow'],
        mentorUnlocked: true,
        title: 'Senior Data Scientist',
        uni: 'IIIT Hyderabad',
        joined: 'Sep 30, 2024',
        tasksCount: 45,
      },
      data: {
        projects: [],
        notifications: [],
        requests: [],
      }
    });

    this.users.push({
      id: '8',
      name: 'Vikram Nair',
      email: 'vikram.nair@teamforge.io',
      role: UserRole.Collaborator,
      skills: ['Java', 'Spring Boot', 'SQL'],
      linkedIn: 'https://linkedin.com/in/vikramnair',
      status: UserStatus.Active,
      flags: false,
      profile: {
        fullName: 'Vikram Nair',
        username: 'vikramnair',
        bio: 'Backend Developer',
        xp: 200,
        rep: 15,
        skills: ['Java', 'Spring Boot', 'SQL'],
        mentorUnlocked: false,
        title: 'Backend Engineer',
        uni: 'SRM University',
        joined: 'Jan 12, 2026',
        tasksCount: 6,
      },
      data: {
        projects: [],
        notifications: [],
        requests: [],
      }
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
      profile: {
        fullName: createUserDto.name,
        username: createUserDto.name.toLowerCase().replace(/\s/g, ''),
        bio: '',
        xp: 0,
        rep: 0,
        skills: createUserDto.skills || [],
        mentorUnlocked: false,
        tasksCount: 0,
        ...(createUserDto.profile || {})
      },
      data: {
        projects: [],
        notifications: [],
        requests: [],
        mentorRecommendations: [],
        mentoredProjects: []
      }
    };
    this.users.push(newUser);
    return newUser;
  }

  update(id: string, updateUserDto: UpdateUserDto): User | undefined {
    const userIndex = this.users.findIndex((user) => user.id === id);
    if (userIndex === -1) {
      return undefined;
    }

    // Deep merge to ensure profile updates don't obliterate other nested properties
    const existingUser = this.users[userIndex];
    
    this.users[userIndex] = {
      ...existingUser,
      ...updateUserDto,
      profile: {
        ...existingUser.profile,
        ...(updateUserDto.profile || {})
      },
      // Keep data intact since updating data usually happens via separate endpoints
    };

    return this.users[userIndex];
  }

  delete(id: string): boolean {
    const initialLength = this.users.length;
    this.users = this.users.filter((user) => user.id !== id);
    return this.users.length < initialLength;
  }
}
