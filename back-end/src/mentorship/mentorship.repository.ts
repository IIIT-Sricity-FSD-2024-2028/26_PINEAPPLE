import { Injectable } from '@nestjs/common';
import { CreateApplicationDto, ApplicationStatus } from './dto/create-application.dto';
import { IssueBadgeDto, BadgeType } from './dto/issue-badge.dto';

export interface MentorApplication {
  id: string;
  userId: string;
  linkedinURL: string;
  experienceYears: number;
  motivation: string;
  status: ApplicationStatus;
  timestamp: Date;
}

export interface RecommendationBadge {
  id: string;
  recipientId: string;
  recipientName: string;
  mentorId: string;
  mentorName: string;
  badgeName: string;
  projectId: string;
  projectTitle: string;
  comment?: string;
  awardedAt: string;
  collaboratorId?: string;
  badgeType?: string;
  timestamp?: Date;
}

@Injectable()
export class MentorshipRepository {
  private applications: MentorApplication[] = [];
  private badges: RecommendationBadge[] = [];

  constructor() {
    const now = new Date();

    // Seed test application for User '3' (Kiran Bose)
    this.applications.push({
      id: 'app-1',
      userId: '3',
      linkedinURL: 'https://linkedin.com/in/kiranbose',
      experienceYears: 2,
      motivation: 'I want to mentor freshers in full-stack development.',
      status: ApplicationStatus.Pending,
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 48), // 2 days ago
    });

    // Seed test badge issued by User '1' (Priya Patel) to User '2' (Arjun Sharma)
    this.badges.push({
      id: 'badge-1',
      recipientId: '2',
      recipientName: 'Arjun Sharma',
      mentorId: '1',
      mentorName: 'Priya Patel',
      badgeName: 'Technical Excellence',
      projectId: 'proj-1',
      projectTitle: 'AI Study Planner',
      comment: 'Arjun demonstrated exceptional problem-solving during the database schema design phase.',
      awardedAt: new Date(now.getTime() - 1000 * 60 * 60 * 5).toISOString(),
      collaboratorId: '2',
      badgeType: 'Technical Excellence',
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 5),
    });

    this.applications.push({
      id: 'app-2',
      userId: '7', // Neha Gupta
      linkedinURL: 'https://linkedin.com/in/nehagupta',
      experienceYears: 5,
      motivation: 'Passionate about teaching machine learning and data science concepts.',
      status: ApplicationStatus.Approved,
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30), // 30 days ago
    });

    // Seed test badge issued by User '7' (Neha Gupta) to User '6' (Aditya Sai)
    this.badges.push({
      id: 'badge-2',
      recipientId: '6',
      recipientName: 'Aditya Sai',
      mentorId: '7',
      mentorName: 'Neha Gupta',
      badgeName: 'Team Player',
      projectId: 'proj-1',
      projectTitle: 'AI Study Planner',
      comment: 'Aditya is an excellent team player, always helping others debug their issues.',
      awardedAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 2).toISOString(),
      collaboratorId: '6',
      badgeType: 'Team Player',
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 2),
    });
  }

  createApplication(userId: string, dto: CreateApplicationDto, initialStatus: ApplicationStatus): MentorApplication {
    const newApp: MentorApplication = {
      id: `app-${Date.now()}`,
      userId,
      ...dto,
      status: initialStatus,
      timestamp: new Date(),
    };
    this.applications.push(newApp);
    return newApp;
  }

  getApplicationByUserId(userId: string): MentorApplication | undefined {
    return this.applications.find((app) => app.userId === userId);
  }

  updateApplicationStatus(applicationId: string, status: ApplicationStatus): MentorApplication | undefined {
    const index = this.applications.findIndex((app) => app.id === applicationId);
    if (index === -1) {
      return undefined;
    }
    this.applications[index].status = status;
    return this.applications[index];
  }

  saveBadge(badge: RecommendationBadge): RecommendationBadge {
    this.badges.unshift(badge);
    return badge;
  }

  getBadgesByUserId(userId: string): RecommendationBadge[] {
    const target = String(userId || '').trim().toLowerCase();
    return this.badges
      .filter((b) =>
        String(b.recipientId || '').toLowerCase() === target ||
        String(b.collaboratorId || '').toLowerCase() === target ||
        String(b.recipientName || '').toLowerCase() === target
      )
      .sort((a, b) => new Date(b.awardedAt || b.timestamp || 0).getTime() - new Date(a.awardedAt || a.timestamp || 0).getTime());
  }

  getBadgesByProjectId(projectId: string): RecommendationBadge[] {
    const target = String(projectId || '').trim().toLowerCase();
    return this.badges
      .filter((b) => String(b.projectId || '').toLowerCase() === target)
      .sort((a, b) => new Date(b.awardedAt || b.timestamp || 0).getTime() - new Date(a.awardedAt || a.timestamp || 0).getTime());
  }

  findExistingBadge(mentorId: string, recipientId: string, projectId: string): RecommendationBadge | undefined {
    const mTarget = String(mentorId || '').trim().toLowerCase();
    const rTarget = String(recipientId || '').trim().toLowerCase();
    const pTarget = String(projectId || '').trim().toLowerCase();
    return this.badges.find((b) => {
      const matchMentor = String(b.mentorId || '').toLowerCase() === mTarget;
      const matchRecipient =
        String(b.recipientId || '').toLowerCase() === rTarget ||
        String(b.collaboratorId || '').toLowerCase() === rTarget ||
        String(b.recipientName || '').toLowerCase() === rTarget;
      const matchProject = String(b.projectId || '').toLowerCase() === pTarget;
      return matchMentor && matchRecipient && matchProject;
    });
  }

  getAllBadges(): RecommendationBadge[] {
    return [...this.badges];
  }
}
