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
  // Hackathon linkage (nullable — an ordinary project is unaffected).
  // Section 6.1: PROJECT gains sponsorship_id + team support via nullable FKs.
  hackathonId?: string;
  teamId?: string;
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

  findByHackathonId(hackathonId: string): Project[] {
    return this.projects.filter((project) => project.hackathonId === hackathonId);
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

  // Creates a hackathon team's backing project — same shape as an ordinary
  // project, just pre-linked to its hackathon/team so the existing
  // workspace UI (owned-workspace.js / collaborator-workspace.js) and the
  // existing tasks/ module (keyed by projectId) work completely unmodified.
  createForTeam(params: {
    ownerId: string;
    title: string;
    description: string;
    hackathonId: string;
    teamId: string;
  }): Project {
    const newProject: Project = {
      id: `proj-${Date.now()}`,
      ownerId: params.ownerId,
      title: params.title,
      description: params.description,
      difficulty: ProjectDifficulty.Medium,
      requiredSkills: [],
      duration: '',
      status: ProjectStatus.Open,
      hackathonId: params.hackathonId,
      teamId: params.teamId,
    };
    this.projects.push(newProject);
    return newProject;
  }

  // Team lead → Project Owner handoff (the literal "submit" action). Not
  // exposed via UpdateProjectDto since ownerId must never be client-settable
  // on an ordinary project update — only through this explicit transfer.
  transferOwnership(id: string, newOwnerId: string, status: ProjectStatus): Project | undefined {
    const index = this.projects.findIndex((project) => project.id === id);
    if (index === -1) return undefined;
    this.projects[index] = { ...this.projects[index], ownerId: newOwnerId, status };
    return this.projects[index];
  }

  // Hackathon submission: the team lead is already the Project Owner from
  // the moment the team's workspace was created (createForTeam), so this is
  // a pure status flip, not an ownership change.
  setStatus(id: string, status: ProjectStatus): Project | undefined {
    const index = this.projects.findIndex((project) => project.id === id);
    if (index === -1) return undefined;
    this.projects[index] = { ...this.projects[index], status };
    return this.projects[index];
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
