import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { MentorshipRepository, MentorApplication, RecommendationBadge } from './mentorship.repository';
import { CreateApplicationDto, ApplicationStatus } from './dto/create-application.dto';
import { IssueBadgeDto } from './dto/issue-badge.dto';
import { UsersService } from '../users/users.service';
import { GamificationService } from '../gamification/gamification.service';
import { CommunicationService } from '../communication/communication.service';

@Injectable()
export class MentorshipService {
  constructor(
    private readonly mentorshipRepository: MentorshipRepository,
    private readonly usersService: UsersService,
    private readonly gamificationService: GamificationService,
    private readonly communicationService: CommunicationService,
  ) {}

  applyForMentorship(userId: string, dto: CreateApplicationDto): MentorApplication {
    const existingApp = this.mentorshipRepository.getApplicationByUserId(userId);
    if (existingApp) {
      throw new BadRequestException('An application already exists for this user.');
    }
    return this.mentorshipRepository.createApplication(userId, dto, ApplicationStatus.Pending);
  }

  getApplicationByUserId(userId: string): MentorApplication {
    const app = this.mentorshipRepository.getApplicationByUserId(userId);
    if (!app) {
      throw new NotFoundException('Mentorship application not found.');
    }
    return app;
  }

  reviewApplication(applicationId: string, status: ApplicationStatus): MentorApplication {
    const updatedApp = this.mentorshipRepository.updateApplicationStatus(applicationId, status);
    if (!updatedApp) {
      throw new NotFoundException(`Application with ID ${applicationId} not found.`);
    }

    if (status === ApplicationStatus.Approved) {
      // Cross-Module: Upgrade the user's role to Mentor
      // Note: Cast is needed because our simplified update dto allows partial CreateUserDto fields
      this.usersService.update(updatedApp.userId, { role: 'Mentor' } as any); 
    }

    // Cross-Module: Notify the user of the decision
    this.communicationService.createNotification({
      userId: updatedApp.userId,
      title: 'Mentorship Application Update',
      message: `Your application has been marked as: ${status}.`,
    });

    return updatedApp;
  }

  issueBadge(mentorId: string, dto: IssueBadgeDto): RecommendationBadge {
    const newBadge = this.mentorshipRepository.issueBadge(mentorId, dto);

    // Cross-Module: Award 250 XP
    this.gamificationService.awardXp(
      dto.collaboratorId,
      250,
      `Received ${dto.badgeType} Badge`
    );

    // Cross-Module: Notify the collaborator
    this.communicationService.createNotification({
      userId: dto.collaboratorId,
      title: 'New Recommendation Badge!',
      message: `You received the ${dto.badgeType} badge from a Mentor. 250 XP awarded!`,
    });

    return newBadge;
  }

  getBadgesByUserId(userId: string): RecommendationBadge[] {
    return this.mentorshipRepository.getBadgesByUserId(userId);
  }
}
