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
