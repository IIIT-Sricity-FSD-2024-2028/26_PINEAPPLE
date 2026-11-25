import { Injectable } from '@nestjs/common';
import { CreateProjectDto, ProjectStatus, ProjectDifficulty } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { isVisibleProject } from './project-visibility.util';

export interface RemovedUserRecord {
  userId: string;
  userName?: string;
  reason: string;
  removedAt: string;
}

export interface BlockedUserRecord {
  userId: string;
  blockedAt: string;
  reason?: string;
}

export interface DeadlineChangeRecord {
  previousDueDate: string;
  newDueDate: string;
  reason: string;
  changedBy: string;
  changedAt: string;
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
  category?: string;
  dueDate?: string;
  maxCollaborators?: number;
  teamSize?: number;
  tasks?: any[];
  requests?: any[];
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
  mentorUserId?: string | null;
  completedMentorUserId?: string | null;
  completedMemberIds?: string[];
  mentor?: any;
  members?: any[];
  removedUsers?: RemovedUserRecord[];
  blockedUsers?: BlockedUserRecord[];
  closureReason?: string;
  deadlineHistory?: DeadlineChangeRecord[];
  closedAt?: string;
  deletedAt?: string;
  deletedBy?: string;
  restoredAt?: string;
  restoredBy?: string;
  deletionScheduledAt?: string;
  deletionRequestedBy?: string;
  previousStatus?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  day4ReminderSentAt?: string;
  pendingReviewReminderSentAt?: string;
  pausedAt?: string;
  pendingReviewGraceExpiresAt?: string;
  lastOwnerActionAt?: string;
  ownerInactive14dNotifiedAt?: string;
  ownerInactive30d?: boolean;
  ownerInactive30dFlaggedAt?: string;
  closeRequestedAt?: string;
  closeRequestedBy?: string;
  closeRequestTicketId?: string;
  memberActivity?: Record<
    string,
    {
      lastActivityAt?: string;
      joinedAt?: string;
      inactivityNotifiedAt?: string;
    }
  >;
}

@Injectable()
export class ProjectsRepository {
  private projects: Project[] = [];
  private projectsById = new Map<string, Project>();
  private projectsByOwnerId = new Map<string, Project[]>();

  private indexProject(p: Project): void {
    if (!p) return;
    this.projectsById.set(String(p.id), p);
    const ownerId = String(p.ownerId);
    if (!this.projectsByOwnerId.has(ownerId)) {
      this.projectsByOwnerId.set(ownerId, []);
    }
    const list = this.projectsByOwnerId.get(ownerId)!;
    const existingIdx = list.findIndex((item) => String(item.id) === String(p.id));
    if (existingIdx !== -1) {
      list[existingIdx] = p;
    } else {
      list.push(p);
    }
  }

  private rebuildIndexes(): void {
    this.projectsById.clear();
    this.projectsByOwnerId.clear();
    for (const p of this.projects) {
      this.indexProject(p);
    }
  }

  constructor() {
    this.initSeeds();
  }

  private initSeeds(): void {
    // Seed test data. We deliberately set ownerId '1' to match our Phase 2 dummy user "Priya Patel"
    this.projects.push({
      id: 'proj-1',
      ownerId: '1',
      title: 'AI Study Planner',
      description: 'An intelligent study scheduling app that adapts to student learning patterns.',
      difficulty: ProjectDifficulty.Hard,
      requiredSkills: ['React', 'Python', 'ML'],
      dueDate: '2027-02-28T00:00:00.000Z',
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
      dueDate: '2027-05-15T00:00:00.000Z',
      status: ProjectStatus.InProgress,
      mentorId: '4',
      mentor: 'Rohan Mehta',
      collaborators: [
        { id: '6', name: 'Aditya Sai', role: 'Collaborator' },
        { id: '8', name: 'Vikram Nair', role: 'Collaborator' }
      ],
    });

    this.projects.push({
      id: 'proj-4',
      ownerId: '4', // TeamForge User
      title: 'FinTech Dashboard',
      description: 'A modern financial dashboard for tracking expenses, managing portfolios, and crypto assets.',
      difficulty: ProjectDifficulty.Medium,
      requiredSkills: ['Angular', 'TypeScript', 'TailwindCSS'],
      dueDate: '2027-04-15T00:00:00.000Z',
      status: ProjectStatus.Open,
      collaborators: [],
    });

    this.projects.push({
      id: 'proj-5',
      ownerId: '1', // Priya Patel
      title: 'Fitness Tracking App',
      description: 'A cross-platform mobile application for tracking daily steps, hydration, and sleep cycles.',
      difficulty: ProjectDifficulty.Easy,
      requiredSkills: ['Flutter', 'Dart', 'Firebase'],
      dueDate: '2027-06-30T00:00:00.000Z',
      status: ProjectStatus.InProgress,
      collaborators: [
        { id: '5', name: 'Sneha Iyer', role: 'Contributor' }
      ],
    });

    this.projects.push({
      id: 'proj-6',
      ownerId: '6', // Aditya Sai
      title: 'Decentralized Voting System',
      description: 'A blockchain-based platform for secure and transparent voting using smart contracts.',
      difficulty: ProjectDifficulty.Hard,
      requiredSkills: ['Solidity', 'Vue', 'Node.js'],
      dueDate: '2027-07-31T00:00:00.000Z',
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
      dueDate: '2027-08-31T00:00:00.000Z',
      status: ProjectStatus.InProgress,
      collaborators: [
        { id: '6', name: 'Aditya Sai', role: 'Contributor' },
        { id: '2', name: 'Arjun Sharma', role: 'Contributor' }
      ],
    });
    this.rebuildIndexes();
  }

  findAll(includeDeleted = false): Project[] {
    if (includeDeleted) {
      return this.projects;
    }
    return this.projects.filter((p) => isVisibleProject(p));
  }

  findById(id: string): Project | undefined {
    return this.projectsById.get(String(id)) || this.projects.find((project) => String(project.id) === String(id));
  }

  findByOwnerId(ownerId: string, includeDeleted = false): Project[] {
    const list = this.projectsByOwnerId.get(String(ownerId)) ||
      this.projects.filter((project) => String(project.ownerId) === String(ownerId));
    if (includeDeleted) return list;
    return list.filter((p) => isVisibleProject(p));
  }

  getOwnerDeletionsInWindow(ownerId: string, windowMs = 24 * 60 * 60 * 1000, nowMs?: number): number {
    const currentMs = nowMs ?? Date.now();
    const cutoff = currentMs - windowMs;
    const all = this.findAll(true);
    return all.filter((p) => {
      const isOwnerDel = (String(p.ownerId) === String(ownerId) || String(p.deletedBy) === String(ownerId));
      if (!isOwnerDel || !p.deletedAt) return false;
      const delMs = new Date(p.deletedAt).getTime();
      return !Number.isNaN(delMs) && delMs >= cutoff;
    }).length;
  }

  create(ownerId: string, createProjectDto: CreateProjectDto, status: ProjectStatus): Project {
    const createdIso = (createProjectDto as any)?.createdAt || new Date().toISOString();
    const {
      starterTaskKeys: _starterKeys,
      starterTaskOverrides: _starterOverrides,
      ...persistableDto
    } = createProjectDto as any;
    const newProject: Project = {
      id: (createProjectDto as any)?.id || `proj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ...persistableDto,
      ownerId,
      requiredSkills: createProjectDto.requiredSkills || createProjectDto.skills || [],
      category: createProjectDto.category || 'General',
      difficulty: createProjectDto.difficulty || ProjectDifficulty.Medium,
      status: (createProjectDto.status as any) || status,
      collaborators: createProjectDto.collaborators || [],
      dueDate: createProjectDto.dueDate,
      createdAt: createdIso,
      lastOwnerActionAt: (createProjectDto as any)?.lastOwnerActionAt || createdIso,
      isCompleted: createProjectDto.isCompleted ?? false,
      completedAt: createProjectDto.completedAt,
      finalLink: createProjectDto.finalLink || createProjectDto.finishedLink,
      finishedLink: createProjectDto.finishedLink || createProjectDto.finalLink,
      removedUsers: (createProjectDto as any).removedUsers || [],
      memberActivity: (createProjectDto as any).memberActivity || {},
    };
    this.projects.push(newProject);
    this.indexProject(newProject);
    return newProject;
  }

  update(id: string, updateProjectDto: Partial<Project>): Project | undefined {
    const index = this.projects.findIndex((project) => String(project.id) === String(id));
    if (index === -1) {
      return undefined;
    }

    this.projects[index] = {
      ...this.projects[index],
      ...updateProjectDto,
    };

    this.indexProject(this.projects[index]);
    return this.projects[index];
  }

  addCollaborator(
    projectId: string,
    collaborator: { id: string; name: string; role: string; joinedAt?: string; lastActivityAt?: string },
    nowIso?: string,
  ): Project | undefined {
    const project = this.findById(projectId);
    if (!project) {
      return undefined;
    }
    const existing = Array.isArray(project.collaborators) ? project.collaborators : [];
    const exists = existing.some((c: any) =>
      typeof c === 'string' ? c === collaborator.id || c === collaborator.name : c.id === collaborator.id
    );
    const activityTs = nowIso || collaborator.lastActivityAt || collaborator.joinedAt || new Date().toISOString();
    if (!project.memberActivity) {
      project.memberActivity = {};
    }
    if (!exists) {
      const collabEntry = {
        ...collaborator,
        joinedAt: collaborator.joinedAt || activityTs,
        lastActivityAt: collaborator.lastActivityAt || activityTs,
      };
      existing.push(collabEntry);
      project.collaborators = existing;
      project.memberActivity[String(collaborator.id)] = {
        ...(project.memberActivity[String(collaborator.id)] || {}),
        joinedAt: collabEntry.joinedAt,
        lastActivityAt: collabEntry.lastActivityAt,
      };
      this.indexProject(project);
    }
    return project;
  }

  resetToSeed(): void {
    this.projects = [];
    this.projectsById.clear();
    this.projectsByOwnerId.clear();
    this.initSeeds();
  }

  reset(): void {
    if (process.env.NODE_ENV !== 'test' && !process.env.ALLOW_STORE_RESET) return;
    this.resetToSeed();
  }

  hardDelete(id: string): boolean {
    const pid = String(id || '');
    const before = this.projects.length;
    this.projects = this.projects.filter((p) => String(p.id) !== pid);
    if (this.projects.length < before) {
      this.rebuildIndexes();
      return true;
    }
    return false;
  }
}
