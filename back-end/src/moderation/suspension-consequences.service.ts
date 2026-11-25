import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ProjectsService } from '../projects/projects.service';
import { TasksService } from '../tasks/tasks.service';
import { MentorMarketplaceService } from '../mentor-marketplace/mentor-marketplace.service';
import { AuditService } from '../audit/audit.service';
import { UsersRepository } from '../users/users.repository';

@Injectable()
export class SuspensionConsequencesService {
  private readonly logger = new Logger(SuspensionConsequencesService.name);

  constructor(
    @Inject(forwardRef(() => ProjectsService))
    private readonly projectsService: any,
    @Inject(forwardRef(() => TasksService))
    private readonly tasksService: any,
    @Inject(forwardRef(() => MentorMarketplaceService))
    private readonly mentorMarketplaceService: any,
    private readonly auditService: AuditService,
    @Inject(forwardRef(() => UsersRepository))
    private readonly usersRepository: UsersRepository,
  ) {}

  /**
   * Main entry point when a user is suspended (manual or auto-suspend).
   * Executes all three consequences (collaborator, owner, mentor) idempotently.
   */
  async handleSuspension(userId: string, reason: string): Promise<void> {
    const uid = String(userId);
    this.logger.log(`Executing suspension consequences for user ${uid}. Reason: ${reason}`);

    // 1. Collaborator consequence
    this.handleCollaboratorSuspension(uid);

    // 2. Owner consequence
    this.handleOwnerSuspension(uid, reason);

    // 3. Mentor consequence
    this.handleMentorSuspension(uid);

    // Record central audit entry
    try {
      this.auditService.create({
        userId: uid,
        action: 'user-suspended',
        details: `Account suspended. Reason: ${reason}`,
      });
    } catch (err: any) {
      this.logger.warn(`Failed to write suspension audit: ${err?.message}`);
    }
  }

  /**
   * Case 1: Collaborator suspended
   * - Open and In-Progress tasks return to Unassigned & Open (ToDo).
   * - Tasks already In Review stay.
   * - Membership stays; approved work and XP stay.
   * - Project owner is notified with the list of released tasks.
   * - Idempotent: running twice changes nothing.
   */
  handleCollaboratorSuspension(userId: string): void {
    try {
      if (this.tasksService?.releaseCollaboratorTasks) {
        const result = this.tasksService.releaseCollaboratorTasks(userId);
        if (result?.releasedTasks?.length > 0) {
          this.logger.log(
            `Released ${result.releasedTasks.length} tasks for suspended collaborator ${userId}`,
          );
        }
      }
    } catch (err: any) {
      this.logger.warn(`Error releasing collaborator tasks: ${err?.message}`);
    }
  }

  /**
   * Case 2: Project Owner suspended
   * - Every project they own that is not Completed or Closed becomes Closed with closedReason "Owner suspended".
   * - Closed projects are read-only and locked.
   * - Pending join requests become system_closed (not counted against applicants).
   * - Active mentor session is paid out to the mentor from escrow (full session price to mentor, platform fee as revenue).
   * - Session not yet accepted is refunded in full.
   * - Collaborators and mentors of each project are notified.
   * - Idempotent: running twice changes nothing.
   */
  handleOwnerSuspension(ownerUserId: string, reason = 'Owner suspended'): void {
    try {
      if (this.projectsService?.handleOwnerSuspension) {
        const closed = this.projectsService.handleOwnerSuspension(ownerUserId);
        this.logger.log(`Closed ${closed.length} owned projects for suspended owner ${ownerUserId}`);
      }
    } catch (err: any) {
      this.logger.warn(`Error handling owner suspension projects: ${err?.message}`);
    }
  }

  /**
   * Case 3: Mentor suspended
   * - Sessions not yet accepted are refunded in full.
   * - Active sessions are refunded in full and the project's mentor slot is freed.
   * - Owners and collaborators are notified.
   * - Idempotent: running twice changes nothing.
   */
  handleMentorSuspension(mentorUserId: string): void {
    try {
      if (this.mentorMarketplaceService?.handleMentorSuspension) {
        this.mentorMarketplaceService.handleMentorSuspension(mentorUserId);
        this.logger.log(`Handled mentor sessions and freed slot for suspended mentor ${mentorUserId}`);
      }
    } catch (err: any) {
      this.logger.warn(`Error handling mentor suspension: ${err?.message}`);
    }
  }
}
