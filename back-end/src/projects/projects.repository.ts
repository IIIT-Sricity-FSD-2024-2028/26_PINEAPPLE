import { Injectable } from '@nestjs/common';
import { CreateProjectDto, ProjectStatus, ProjectDifficulty } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

export interface RemovedUserRecord {
  userId: string;
  userName?: string;
  reason: string;
  removedAt: string;
}

export interface Project {
  id: string;
  ownerId: string;
  owner?: string;
  title: string;
  name?: string;
  description: string;
  desc?: string;
  objectives?: string;
  difficulty: ProjectDifficulty | string;
  requiredSkills: string[];
  skills?: string[];
  duration: string;
  maxCollaborators?: number;
  status: ProjectStatus | string;
  progress?: number;
  collaborators: any[];
  isCompleted?: boolean;
  completedAt?: Date | string;
  finalLink?: string;
  finishedLink?: string;
  finalProjectUrl?: string;
  projectLink?: string;
  mentorId?: string;
  mentor?: any;
  members?: any[];
  removedUsers?: RemovedUserRecord[];
}

@Injectable()
export class ProjectsRepository {
  private projects: Project[] = [];

  constructor() {
    // Seed test data. We deliberately set ownerId '1' to match our Phase 2 dummy user "Priya Patel"
    this.projects.push({
      id: 'proj-1',
      ownerId: '1',
      title: 'AI Study Planner',
      description: 'An intelligent study scheduling app that adapts to student learning patterns.',
      difficulty: ProjectDifficulty.Hard,
      requiredSkills: ['React', 'Python', 'ML'],
      duration: '3 Months',
      status: ProjectStatus.Open,
      mentorId: '3',
      mentor: 'Kiran Bose',
      collaborators: [
        { id: '2', name: 'Arjun Sharma', role: 'Collaborator' },
        { id: '8', name: 'Vikram Nair', role: 'Collaborator' }
      ],
    });

    this.projects.push({
      id: 'proj-2',
      ownerId: '2', // Arjun Sharma
      title: 'Campus Events App',
      description: 'Discover and organize campus events with real-time updates and RSVP management.',
      difficulty: ProjectDifficulty.Medium,
      requiredSkills: ['React', 'Node.js', 'Firebase'],
      duration: '2 Months',
      status: ProjectStatus.InProgress,
      mentorId: '4',
      mentor: 'Rohan Mehta',
      collaborators: [
        { id: '6', name: 'Aditya Sai', role: 'Collaborator' },
        { id: '8', name: 'Vikram Nair', role: 'Collaborator' }
      ],
    });

    this.projects.push({
      id: 'proj-3',
      ownerId: '3', // Kiran Bose
      title: 'Smart City Traffic Optimizer',
      description: 'An IoT and AI based platform to analyze traffic flow and optimize signal timings dynamically.',
      difficulty: ProjectDifficulty.Hard,
      requiredSkills: ['Python', 'IoT', 'Data Science'],
      duration: '4 Months',
      status: ProjectStatus.Completed,
      isCompleted: true,
      completedAt: new Date('2026-03-01T00:00:00.000Z'),
      finalLink: 'https://github.com/teamforge/traffic-optimizer',
      finishedLink: 'https://github.com/teamforge/traffic-optimizer',
      mentorId: '7',
      mentor: 'Neha Gupta',
      collaborators: [
        { id: '2', name: 'Arjun Sharma', role: 'Collaborator' },
        { id: '6', name: 'Aditya Sai', role: 'Collaborator' }
      ],
    });

    this.projects.push({
      id: 'proj-4',
      ownerId: '4', // TeamForge User
      title: 'FinTech Dashboard',
      description: 'A modern financial dashboard for tracking expenses, managing portfolios, and crypto assets.',
      difficulty: ProjectDifficulty.Medium,
      requiredSkills: ['Angular', 'TypeScript', 'TailwindCSS'],
      duration: '1.5 Months',
      status: ProjectStatus.Open,
      collaborators: [],
    });

    this.projects.push({
      id: 'proj-5',
      ownerId: '1', // Priya Patel
      title: 'Health Tracking App',
      description: 'A cross-platform mobile application for tracking daily steps, hydration, and sleep cycles.',
      difficulty: ProjectDifficulty.Easy,
      requiredSkills: ['Flutter', 'Dart', 'Firebase'],
      duration: '2 Months',
      status: ProjectStatus.InProgress,
      collaborators: [
        { id: '2', name: 'Arjun Sharma', role: 'Contributor' },
        { id: '5', name: 'Vikram Nair', role: 'Contributor' }
      ],
    });

    this.projects.push({
      id: 'proj-6',
      ownerId: '6', // Aditya Sai
      title: 'Decentralized Voting System',
      description: 'A blockchain-based platform for secure and transparent voting using smart contracts.',
      difficulty: ProjectDifficulty.Hard,
      requiredSkills: ['Solidity', 'Vue', 'Node.js'],
      duration: '3 Months',
      status: ProjectStatus.Open,
      collaborators: [
        { id: '8', name: 'Vikram Nair', role: 'Contributor' }
      ],
    });

    this.projects.push({
      id: 'proj-7',
      ownerId: '7', // Neha Gupta
      title: 'Climate Data Analyzer',
      description: 'An AI-powered tool to analyze and visualize global climate change datasets.',
      difficulty: ProjectDifficulty.Medium,
      requiredSkills: ['Python', 'TensorFlow', 'Data Science'],
      duration: '2.5 Months',
      status: ProjectStatus.InProgress,
      collaborators: [
        { id: '6', name: 'Aditya Sai', role: 'Contributor' },
        { id: '2', name: 'Arjun Sharma', role: 'Contributor' }
      ],
    });

    this.projects.push({
      id: 'proj-8',
      ownerId: '8', // Vikram Nair
      title: 'E-commerce API Engine',
      description: 'A scalable REST and GraphQL backend engine for rapid e-commerce deployment.',
      difficulty: ProjectDifficulty.Medium,
      requiredSkills: ['Java', 'Spring Boot', 'SQL'],
      duration: '1 Month',
      status: ProjectStatus.Completed,
      isCompleted: true,
      completedAt: new Date('2026-03-05T00:00:00.000Z'),
      finalLink: 'https://github.com/teamforge/ecommerce-api-engine',
      finishedLink: 'https://github.com/teamforge/ecommerce-api-engine',
      collaborators: [
        { id: '1', name: 'Priya Patel', role: 'Contributor' }
      ],
    });
  }

  findAll(): Project[] {
    return this.projects;
  }

  findById(id: string): Project | undefined {
    return this.projects.find((project) => String(project.id) === String(id));
  }

  findByOwnerId(ownerId: string): Project[] {
    return this.projects.filter((project) => String(project.ownerId) === String(ownerId));
  }

  create(ownerId: string, createProjectDto: CreateProjectDto, status: ProjectStatus): Project {
    const newProject: Project = {
      id: `proj-${Date.now()}`,
      ownerId,
      ...createProjectDto,
      requiredSkills: createProjectDto.requiredSkills || createProjectDto.skills || [],
      duration: createProjectDto.duration || '1 month',
      difficulty: createProjectDto.difficulty || ProjectDifficulty.Medium,
      status: (createProjectDto.status as any) || status,
      collaborators: createProjectDto.collaborators || [],
      isCompleted: createProjectDto.isCompleted ?? false,
      completedAt: createProjectDto.completedAt,
      finalLink: createProjectDto.finalLink || createProjectDto.finishedLink,
      finishedLink: createProjectDto.finishedLink || createProjectDto.finalLink,
      removedUsers: (createProjectDto as any).removedUsers || [],
    };
    this.projects.push(newProject);
    return newProject;
  }

  update(id: string, updateProjectDto: UpdateProjectDto): Project | undefined {
    const index = this.projects.findIndex((project) => String(project.id) === String(id));
    if (index === -1) {
      return undefined;
    }

    this.projects[index] = {
      ...this.projects[index],
      ...updateProjectDto,
    };

    return this.projects[index];
  }

  addCollaborator(projectId: string, collaborator: { id: string; name: string; role: string }): Project | undefined {
    const project = this.findById(projectId);
    if (!project) {
      return undefined;
    }
    const existing = Array.isArray(project.collaborators) ? project.collaborators : [];
    const exists = existing.some((c: any) =>
      typeof c === 'string' ? c === collaborator.id || c === collaborator.name : c.id === collaborator.id
    );
    if (!exists) {
      existing.push(collaborator);
      project.collaborators = existing;
    }
    return project;
  }

  delete(id: string): boolean {
    const initialLength = this.projects.length;
    this.projects = this.projects.filter((project) => project.id !== id);
    return this.projects.length < initialLength;
  }
}
