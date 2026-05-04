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
  mentorId: string;
  collaboratorId: string;
  badgeType: BadgeType;
  comment: string;
  timestamp: Date;
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

    // Seed test badge issued by User '1' (Priya/Admin) to User '2' (Arjun)
    this.badges.push({
      id: 'badge-1',
      mentorId: '1',
      collaboratorId: '2',
      badgeType: BadgeType.TechnicalExcellence,
      comment: 'Arjun demonstrated exceptional problem-solving during the database schema design phase.',
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 5), // 5 hours ago
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

  issueBadge(mentorId: string, dto: IssueBadgeDto): RecommendationBadge {
    const newBadge: RecommendationBadge = {
      id: `badge-${Date.now()}`,
      mentorId,
      collaboratorId: dto.collaboratorId,
      badgeType: dto.badgeType,
      comment: dto.comment,
      timestamp: new Date(),
    };
    this.badges.push(newBadge);
    return newBadge;
  }

  getBadgesByUserId(userId: string): RecommendationBadge[] {
    return this.badges
      .filter((badge) => badge.collaboratorId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()); // Reverse Chronological
  }
}
