import { Injectable } from '@nestjs/common';
import { CreateProjectDto, ProjectStatus, ProjectDifficulty } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

export interface Project {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  difficulty: ProjectDifficulty;
  requiredSkills: string[];
  duration: string;
  status: ProjectStatus;
  collaborators: any[];
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
      collaborators: [
        { id: '5', name: 'Vikram Nair', role: 'Contributor' },
        { id: '6', name: 'Priya Patel', role: 'Contributor' }
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
      collaborators: [
        { id: '3', name: 'Rohan Mehta', role: 'Contributor' },
        { id: '4', name: 'TeamForge User', role: 'Contributor' }
      ],
    });

    this.projects.push({
      id: 'proj-3',
      ownerId: '3', // Rohan Mehta
      title: 'Smart City Traffic Optimizer',
      description: 'An IoT and AI based platform to analyze traffic flow and optimize signal timings dynamically.',
      difficulty: ProjectDifficulty.Hard,
      requiredSkills: ['Python', 'IoT', 'Data Science'],
      duration: '4 Months',
      status: ProjectStatus.Completed,
      collaborators: [
        { id: '1', name: 'Priya Patel', role: 'Contributor' }
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
      collaborators: [
        { id: '1', name: 'Priya Patel', role: 'Contributor' }
      ],
    });
  }

  findAll(): Project[] {
    return this.projects;
  }

  findById(id: string): Project | undefined {
    return this.projects.find((project) => project.id === id);
  }

  findByOwnerId(ownerId: string): Project[] {
    return this.projects.filter((project) => project.ownerId === ownerId);
  }

  create(ownerId: string, createProjectDto: CreateProjectDto, status: ProjectStatus): Project {
    const newProject: Project = {
      id: `proj-${Date.now()}`,
      ownerId,
      ...createProjectDto,
      status,
      collaborators: [], // Default to empty array
    };
    this.projects.push(newProject);
    return newProject;
  }

  update(id: string, updateProjectDto: UpdateProjectDto): Project | undefined {
    const index = this.projects.findIndex((project) => project.id === id);
    if (index === -1) {
      return undefined;
    }

    this.projects[index] = {
      ...this.projects[index],
      ...updateProjectDto,
    };

    return this.projects[index];
  }

  delete(id: string): boolean {
    const initialLength = this.projects.length;
    this.projects = this.projects.filter((project) => project.id !== id);
    return this.projects.length < initialLength;
  }
}
