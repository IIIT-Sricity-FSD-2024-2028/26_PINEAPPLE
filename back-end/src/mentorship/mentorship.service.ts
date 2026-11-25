import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { MentorshipRepository, RecommendationBadge } from './mentorship.repository';
import { IssueBadgeDto } from './dto/issue-badge.dto';
import { UsersService } from '../users/users.service';
import { ProjectsService } from '../projects/projects.service';
import { MentorMarketplaceService } from '../mentor-marketplace/mentor-marketplace.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class MentorshipService {
  constructor(
    private readonly mentorshipRepository: MentorshipRepository,
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => ProjectsService))
    private readonly projectsService: any,
    @Inject(forwardRef(() => MentorMarketplaceService))
    private readonly mentorMarketplaceService: any,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  issueBadge(mentorId: string, dto: IssueBadgeDto, callerRole?: string): RecommendationBadge {
    if (!mentorId) {
      throw new UnauthorizedException('Authentication required.');
    }

    const mentorUser = this.usersService.findUserSafe(mentorId);
    const mentorName = mentorUser?.name || 'Mentor';

    const targetRecipientId = (dto.recipientId || dto.collaboratorId || '').trim();
    if (!targetRecipientId) {
      throw new BadRequestException('Recipient ID is required.');
    }

    // 1. A mentor cannot award themselves
    if (targetRecipientId === mentorId || (mentorUser && mentorUser.name?.toLowerCase() === targetRecipientId.toLowerCase())) {
      throw new BadRequestException('A mentor cannot award a recommendation badge to themselves.');
    }

    const projectId = (dto.projectId || '').trim();
    if (!projectId) {
      throw new BadRequestException('projectId is required.');
    }

    // 2. Fetch project
    const project = this.projectsService.findById(projectId);
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found.`);
    }
    const projectTitle = project.title || project.name || 'Project';

    // 3. Only the approved mentor of that project can award (or Administrator)
    const isAdmin = ['admin', 'administrator', 'superuser'].includes(String(callerRole || '').toLowerCase());
    const isProjectMentor =
      String(project.mentorId) === String(mentorId) ||
      (typeof project.mentor === 'string' && (project.mentor === mentorId || (mentorUser && project.mentor.toLowerCase() === mentorUser.name?.toLowerCase()))) ||
      (typeof project.mentor === 'object' && project.mentor !== null &&
        (String((project.mentor as any).id) === String(mentorId) ||
         String((project.mentor as any).userId) === String(mentorId) ||
         (mentorUser && (project.mentor as any).name && (project.mentor as any).name.toLowerCase() === mentorUser.name?.toLowerCase())));

    let hasActiveSession = false;
    try {
      const sessions = this.mentorMarketplaceService.getSessionsByProject(projectId);
      hasActiveSession = sessions.some(
        (s) =>
          (s.status === 'active' || s.status === 'completed') &&
          (String(s.mentorId) === String(mentorId) ||
           this.mentorMarketplaceService.findProfileById(s.mentorId)?.userId === mentorId)
      );
    } catch (err: any) {
        console.warn('[mentorship.service] Suppressed non-critical error:', err?.message || err);
      }

    if (!isProjectMentor && !hasActiveSession && !isAdmin) {
      throw new ForbiddenException('Only the approved mentor of this project can award recommendation badges.');
    }

    // 4. Resolve recipient user & verify membership
    let recipientUser = this.usersService.findUserSafe(targetRecipientId);
    if (!recipientUser) {
      recipientUser = this.usersService.findAll().find(
        (u) =>
          (u.name && u.name.toLowerCase() === targetRecipientId.toLowerCase()) ||
          (u.username && u.username.toLowerCase() === targetRecipientId.toLowerCase()),
      );
    }
    const canonicalRecipientId = recipientUser ? recipientUser.id : targetRecipientId;
    const recipientName = recipientUser ? recipientUser.name : targetRecipientId;

    if (canonicalRecipientId === mentorId) {
      throw new BadRequestException('A mentor cannot award a recommendation badge to themselves.');
    }

    const collabs = Array.isArray(project.collaborators) ? project.collaborators : [];
    const isCollab = collabs.some((c: any) => {
      if (typeof c === 'string') {
        return c === canonicalRecipientId || (recipientName && c.toLowerCase() === recipientName.toLowerCase());
      }
      return (
        String(c.id) === canonicalRecipientId ||
        String(c.userId) === canonicalRecipientId ||
        (recipientName && c.name && c.name.toLowerCase() === recipientName.toLowerCase())
      );
    });
    const isOwner =
      project.ownerId === canonicalRecipientId ||
      (recipientName && project.owner && (
        (typeof project.owner === 'string' && project.owner.toLowerCase() === recipientName.toLowerCase()) ||
        (typeof project.owner === 'object' && (project.owner as any)?.name && (project.owner as any).name.toLowerCase() === recipientName.toLowerCase())
      ));

    if (!isCollab && !isOwner) {
      throw new BadRequestException('The badge recipient must be a member of this project.');
    }

    // 5. No second badge from the same mentor to the same person for the same project
    const alreadyAwarded = this.mentorshipRepository.findExistingBadge(mentorId, canonicalRecipientId, projectId);
    if (alreadyAwarded) {
      throw new BadRequestException('You have already awarded a recommendation badge to this member for this project.');
    }

    const badgeName = (dto.badgeName || dto.badgeType || 'Technical Excellence').trim();
    const comment = (dto.comment || dto.note || 'Demonstrated exceptional technical skill and problem-solving.').trim();

    // 6. Create badge record
    const newBadge: RecommendationBadge = {
      id: `badge-${Date.now()}-${randomUUID().slice(0, 8)}`,
      recipientId: canonicalRecipientId,
      recipientName,
      mentorId,
      mentorName,
      badgeName,
      projectId,
      projectTitle,
      comment,
      awardedAt: new Date().toISOString(),
      collaboratorId: canonicalRecipientId,
      badgeType: badgeName,
      timestamp: new Date(),
    };
    this.mentorshipRepository.saveBadge(newBadge);
    this.mentorMarketplaceService?.recordMentorActivity?.(
      projectId,
      String(mentorId),
      'badge_awarded',
    );

    // 7. Badges are recognition only: do NOT mint new XP or Reputation
    // 8. Update recipient profile hasMentorBadge and mentorRecommendations
    if (recipientUser) {
      if (!recipientUser.profile) recipientUser.profile = {} as any;
      recipientUser.profile.hasMentorBadge = true;
      if (!recipientUser.data) recipientUser.data = { projects: [], notifications: [], requests: [] };
      if (!Array.isArray(recipientUser.data.mentorRecommendations)) recipientUser.data.mentorRecommendations = [];
      recipientUser.data.mentorRecommendations.unshift({
        id: newBadge.id,
        project: projectTitle,
        mentor: mentorName,
        note: comment,
        badgeName,
        awardedAt: newBadge.awardedAt,
      } as any);
      try {
        this.usersService.update(canonicalRecipientId, {
          profile: recipientUser.profile,
          data: recipientUser.data,
        } as any);
      } catch (err: any) {
        console.warn('[mentorship.service] Suppressed non-critical error:', err?.message || err);
      }
    }

    // 9. Send notification to collaborator (recipient only)
    try {
      this.notificationsService.create({
        userId: canonicalRecipientId,
        type: 'MENTOR_BADGE_AWARDED',
        title: 'New Recommendation Badge!',
        message: `Mentor ${mentorName} gave you the badge ${badgeName} on ${projectTitle}`,
        readStatus: false,
        referenceId: newBadge.id,
      });
    } catch (err: any) {
        console.warn('[mentorship.service] Suppressed non-critical error:', err?.message || err);
      }

    // 10. Audit log
    try {
      this.auditService.log({
        action: 'badge-awarded',
        actor: mentorName,
        target: recipientName,
        entityType: 'badge',
        entityId: newBadge.id,
        event: `Mentor ${mentorName} awarded badge "${badgeName}" to ${recipientName} on project "${projectTitle}"`,
        details: { badgeName, projectId, projectTitle, recipientId: canonicalRecipientId, mentorId },
      });
    } catch (err: any) {
        console.warn('[mentorship.service] Suppressed non-critical error:', err?.message || err);
      }

    return newBadge;
  }

  getBadgesByUserId(userId: string): RecommendationBadge[] {
    const badges = this.mentorshipRepository.getBadgesByUserId(userId);
    try {
      const user = this.usersService.findUserSafe(userId);
      if (user) {
        if (!user.profile) user.profile = {} as any;
        user.profile.hasMentorBadge = badges.length > 0;
        if (!user.data) user.data = { projects: [], notifications: [], requests: [] };
        user.data.mentorRecommendations = badges.map((b) => ({
          id: b.id,
          project: b.projectTitle,
          mentor: b.mentorName,
          note: b.comment || b.badgeName,
          badgeName: b.badgeName,
          awardedAt: b.awardedAt,
        }));
      }
    } catch (err: any) {
        console.warn('[mentorship.service] Suppressed non-critical error:', err?.message || err);
      }
    return badges;
  }

  getBadgesByProjectId(projectId: string): RecommendationBadge[] {
    return this.mentorshipRepository.getBadgesByProjectId(projectId);
  }
}
