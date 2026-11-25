import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  HttpStatus,
} from '@nestjs/common';
import { DeletionPolicyService } from './deletion-policy.service';
import { ProjectsService } from './projects.service';
import { ProjectsRepository, Project } from './projects.repository';
import { ClockService } from '../common/services/clock.service';
import { PlatformConfigService } from '../platform-config/platform-config.service';
import { ActionFeedbackRepository } from '../feedback/feedback.repository';
import { FeedbackService } from '../feedback/feedback.service';
import { isProjectLocked, isVisibleProject, isLiveProject } from './project-visibility.util';

describe('Enhanced Project Deletion Conditions', () => {
  let fakeClock: ClockService;
  let projectsRepo: ProjectsRepository;
  let feedbackService: FeedbackService;
  let tasksService: any;
  let mentorService: any;
  let joinRequestsService: any;
  let invitesService: any;
  let notificationsService: any;
  let auditService: any;
  let deletionPolicyService: DeletionPolicyService;
  let projectsService: ProjectsService;

  let auditLogs: any[];
  let notifications: any[];
  let allTasks: any[];
  let allSessions: any[];
  let allRequests: any[];
  let allInvites: any[];

  beforeEach(() => {
    fakeClock = new ClockService();
    fakeClock.setTime('2026-11-14T10:00:00.000Z');

    auditLogs = [];
    notifications = [];
    allTasks = [];
    allSessions = [];
    allRequests = [];
    allInvites = [];

    projectsRepo = new ProjectsRepository();
    // Clear out seed projects for clean isolated testing
    (projectsRepo as any).projects = [];
    (projectsRepo as any).rebuildIndexes();

    tasksService = {
      findAllByProjectId: (pId: string) =>
        allTasks.filter((t) => String(t.projectId) === String(pId)),
      releaseMemberTasksOnDeparture: (opts: any) => {
        const released = allTasks.filter(
          (t) =>
            String(t.projectId) === String(opts.projectId) &&
            String(t.assigneeId || t.assignedTo) === String(opts.userId) &&
            !['completed', 'approved'].includes(String(t.status).toLowerCase()),
        );
        released.forEach((t) => {
          t.assigneeId = null;
          t.assignedTo = null;
          t.status = 'open';
        });
        return { releasedTasks: released };
      },
    };

    mentorService = {
      findAllSessions: () => allSessions,
      hasOpenDispute: (sId: string) =>
        allSessions.some((s) => s.id === sId && s.status === 'disputed'),
      handleProjectClosed: (pId: string, reason: string) => {
        allSessions
          .filter(
            (s) =>
              String(s.projectId) === String(pId) &&
              ['escrow_funded', 'payment_pending', 'pending'].includes(s.status),
          )
          .forEach((s) => {
            s.status = 'refunded';
          });
      },
    };

    joinRequestsService = {
      findByProject: (pId: string) =>
        allRequests.filter((r) => String(r.projectId) === String(pId)),
      getMyRequestStatus: () => null,
      closePendingRequestsForProject: (pId: string) => {
        const pending = allRequests.filter(
          (r) => String(r.projectId) === String(pId) && r.status === 'pending',
        );
        pending.forEach((r) => {
          r.status = 'system_closed';
        });
        return pending.length;
      },
    };

    invitesService = {
      findByProject: (pId: string) =>
        allInvites.filter((i) => String(i.projectId) === String(pId)),
      cancelPendingForProject: (pId: string) => {
        const pending = allInvites.filter(
          (i) => String(i.projectId) === String(pId) && i.status === 'pending',
        );
        pending.forEach((i) => {
          i.status = 'cancelled';
        });
        return { cancelledCount: pending.length };
      },
    };

    notificationsService = {
      create: (n: any) => notifications.push(n),
    };

    auditService = {
      log: (a: any) => auditLogs.push(a),
    };

    const feedbackRepo = new ActionFeedbackRepository();
    feedbackService = new FeedbackService(feedbackRepo, auditService, fakeClock);

    deletionPolicyService = new DeletionPolicyService(
      projectsRepo,
      tasksService,
      mentorService,
      joinRequestsService,
      invitesService,
      fakeClock,
    );

    projectsService = new ProjectsService(
      projectsRepo,
      tasksService,
      joinRequestsService,
      notificationsService,
      mentorService,
      auditService,
      new PlatformConfigService(),
      { findUserSafe: (id: string) => ({ id, name: `User ${id}`, role: 'user' }) } as any,
      fakeClock,
      undefined,
      undefined,
      undefined,
      undefined,
      invitesService,
      undefined,
      feedbackService,
      deletionPolicyService,
    );
  });

  // =========================================================================
  // 1. DeletionPolicyService Unit Evaluation Tests
  // =========================================================================
  describe('DeletionPolicyService evaluation cases', () => {
    it('case 1: nobody involved -> immediate mode, noticeHours 0, requiresReason false, allowed true', () => {
      const proj = projectsRepo.create('owner-1', {
        title: 'Empty Project',
        description: 'No collaborators, no mentor, no requests.',
        requiredSkills: ['Node.js'],
      } as any, 'Open' as any);

      const res = deletionPolicyService.evaluate(proj.id, { id: 'owner-1', role: 'project-owner' });
      expect(res.allowed).toBe(true);
      expect(res.blockers).toHaveLength(0);
      expect(res.mode).toBe('immediate');
      expect(res.noticeHours).toBe(0);
      expect(res.requiresReason).toBe(false);
      expect(res.impact.activeCollaborators).toBe(0);
      expect(res.impact.mentorAssigned).toBe(false);
    });

    it('case 2: pending requests and invites only -> immediate mode, no notice, requiresReason false', () => {
      const proj = projectsRepo.create('owner-1', {
        title: 'Project with Applicants Only',
        description: 'Only join requests and invitations.',
        requiredSkills: ['React'],
      } as any, 'Open' as any);

      allRequests.push({ id: 'req-1', projectId: proj.id, userId: 'applicant-1', status: 'pending' });
      allInvites.push({ id: 'inv-1', projectId: proj.id, inviteeId: 'invitee-1', status: 'pending' });

      const res = deletionPolicyService.evaluate(proj.id, { id: 'owner-1', role: 'project-owner' });
      expect(res.allowed).toBe(true);
      expect(res.blockers).toHaveLength(0);
      expect(res.mode).toBe('immediate');
      expect(res.noticeHours).toBe(0);
      expect(res.requiresReason).toBe(false);
      expect(res.impact.pendingRequests).toBe(1);
      expect(res.impact.pendingInvites).toBe(1);
    });

    it('case 3: active collaborator involved -> scheduled mode (48h notice), requiresReason true', () => {
      const proj = projectsRepo.create('owner-1', {
        title: 'Team Project',
        description: 'Collaborator assigned.',
        requiredSkills: ['Python'],
      } as any, 'Open' as any);

      projectsRepo.update(proj.id, {
        members: [{ id: 'collab-1', name: 'Alice', role: 'Collaborator' }],
      } as any);

      const res = deletionPolicyService.evaluate(proj.id, { id: 'owner-1', role: 'project-owner' });
      expect(res.allowed).toBe(true);
      expect(res.blockers).toHaveLength(0);
      expect(res.mode).toBe('scheduled');
      expect(res.noticeHours).toBe(48);
      expect(res.requiresReason).toBe(true);
      expect(res.impact.activeCollaborators).toBe(1);
    });

    it('case 4: admin caller -> immediate mode, noticeHours 0, requiresReason true', () => {
      const proj = projectsRepo.create('owner-1', {
        title: 'Team Project for Admin Delete',
        description: 'Active collaborators present.',
        requiredSkills: ['Rust'],
      } as any, 'Open' as any);

      projectsRepo.update(proj.id, {
        members: [{ id: 'collab-1', name: 'Bob', role: 'Collaborator' }],
      } as any);

      const res = deletionPolicyService.evaluate(proj.id, { id: 'admin-1', role: 'admin' });
      expect(res.allowed).toBe(true);
      expect(res.mode).toBe('immediate');
      expect(res.noticeHours).toBe(0);
      expect(res.requiresReason).toBe(true);
    });

    it('case 5: hard blocker PROJECT_HAS_HISTORY from approved task, Completed project, or released session', () => {
      const p1 = projectsRepo.create('owner-1', { title: 'Project with Approved Task', requiredSkills: [] } as any, 'Open' as any);
      allTasks.push({ id: 't-1', projectId: p1.id, status: 'approved', title: 'Task Approved' });
      const res1 = deletionPolicyService.evaluate(p1.id, { id: 'owner-1', role: 'project-owner' });
      expect(res1.allowed).toBe(false);
      expect(res1.blockers.some((b) => b.code === 'PROJECT_HAS_HISTORY')).toBe(true);
      expect(res1.blockers[0].message).toContain('Close it instead');

      const p2 = projectsRepo.create('owner-1', { title: 'Completed Project', requiredSkills: [] } as any, 'Completed' as any);
      const res2 = deletionPolicyService.evaluate(p2.id, { id: 'owner-1', role: 'project-owner' });
      expect(res2.allowed).toBe(false);
      expect(res2.blockers.some((b) => b.code === 'PROJECT_HAS_HISTORY')).toBe(true);

      const p3 = projectsRepo.create('owner-1', { title: 'Project with Released Mentor Session', requiredSkills: [] } as any, 'Open' as any);
      allSessions.push({ id: 'sess-1', projectId: p3.id, status: 'released' });
      const res3 = deletionPolicyService.evaluate(p3.id, { id: 'owner-1', role: 'project-owner' });
      expect(res3.allowed).toBe(false);
      expect(res3.blockers.some((b) => b.code === 'PROJECT_HAS_HISTORY')).toBe(true);
    });

    it('case 6: hard blocker TASKS_IN_REVIEW prevents deleting unreviewed work', () => {
      const proj = projectsRepo.create('owner-1', { title: 'Review Pending Project', requiredSkills: [] } as any, 'Open' as any);
      allTasks.push({ id: 't-rev', projectId: proj.id, status: 'in review', title: 'Code review pending' });

      const res = deletionPolicyService.evaluate(proj.id, { id: 'owner-1', role: 'project-owner' });
      expect(res.allowed).toBe(false);
      expect(res.blockers.some((b) => b.code === 'TASKS_IN_REVIEW')).toBe(true);
    });

    it('case 7: hard blocker OPEN_DISPUTE blocks deletion', () => {
      const proj = projectsRepo.create('owner-1', { title: 'Disputed Project', requiredSkills: [] } as any, 'Open' as any);
      allSessions.push({ id: 'sess-disp', projectId: proj.id, status: 'disputed' });

      const res = deletionPolicyService.evaluate(proj.id, { id: 'owner-1', role: 'project-owner' });
      expect(res.allowed).toBe(false);
      expect(res.blockers.some((b) => b.code === 'OPEN_DISPUTE')).toBe(true);
    });

    it('case 8: hard blocker MENTOR_ENGAGEMENT_ACTIVE blocks deletion', () => {
      const proj = projectsRepo.create('owner-1', { title: 'Active Mentor Project', requiredSkills: [] } as any, 'Open' as any);
      projectsRepo.update(proj.id, { mentorId: 'm-1', members: [{ id: 'm-1', role: 'Mentor' }] } as any);
      allSessions.push({ id: 'sess-active', projectId: proj.id, mentorId: 'm-1', status: 'active' });

      const res = deletionPolicyService.evaluate(proj.id, { id: 'owner-1', role: 'project-owner' });
      expect(res.allowed).toBe(false);
      expect(res.blockers.some((b) => b.code === 'MENTOR_ENGAGEMENT_ACTIVE')).toBe(true);
    });

    it('case 9: all hard blockers together are ALL returned in the blockers list', () => {
      const proj = projectsRepo.create('owner-1', { title: 'Multi Blocker Project', requiredSkills: [] } as any, 'Open' as any);
      projectsRepo.update(proj.id, { mentorId: 'm-1', members: [{ id: 'm-1', role: 'Mentor' }] } as any);

      allTasks.push({ id: 't-comp', projectId: proj.id, status: 'completed' });
      allTasks.push({ id: 't-rev', projectId: proj.id, status: 'in review' });
      allSessions.push({ id: 's-act', projectId: proj.id, status: 'active' });
      allSessions.push({ id: 's-disp', projectId: proj.id, status: 'disputed' });

      const res = deletionPolicyService.evaluate(proj.id, { id: 'owner-1', role: 'project-owner' });
      expect(res.allowed).toBe(false);
      const codes = res.blockers.map((b) => b.code);
      expect(codes).toContain('PROJECT_HAS_HISTORY');
      expect(codes).toContain('TASKS_IN_REVIEW');
      expect(codes).toContain('OPEN_DISPUTE');
      expect(codes).toContain('MENTOR_ENGAGEMENT_ACTIVE');
      expect(res.blockers.length).toBeGreaterThanOrEqual(4);
    });
  });

  // =========================================================================
  // 2. ProjectsService Execution & Policy Enforcement
  // =========================================================================
  describe('ProjectsService Deletion, Confirmation, Notice & Tombstone', () => {
    it('refuses deletion by non-owner with 403 NOT_PROJECT_OWNER', () => {
      const proj = projectsRepo.create('owner-1', { title: 'Protected Project', requiredSkills: [] } as any, 'Open' as any);

      expect(() => {
        projectsService.softDeleteProject(proj.id, 'intruder-user', 'collaborator', {
          confirmTitle: 'Protected Project',
        });
      }).toThrow(ForbiddenException);
    });

    it('enforces exact typed title confirmation (case-sensitive) with 400 TITLE_MISMATCH', () => {
      const proj = projectsRepo.create('owner-1', { title: 'Exact Title Match', requiredSkills: [] } as any, 'Open' as any);

      expect(() => {
        projectsService.softDeleteProject(proj.id, 'owner-1', 'project-owner', {
          confirmTitle: 'wrong title',
        });
      }).toThrow(BadRequestException);
    });

    it('requires structured reason when collaborators are involved with 400 REASON_REQUIRED', () => {
      const proj = projectsRepo.create('owner-1', { title: 'Collaborator Project', requiredSkills: [] } as any, 'Open' as any);
      projectsRepo.update(proj.id, { members: [{ id: 'collab-1', role: 'Collaborator' }] } as any);

      expect(() => {
        projectsService.softDeleteProject(proj.id, 'owner-1', 'project-owner', {
          confirmTitle: 'Collaborator Project',
          reasons: [],
        });
      }).toThrow(BadRequestException);
    });

    it('schedules deletion with 48h notice, locks project, and notifies involved collaborators', () => {
      const proj = projectsRepo.create('owner-1', { title: 'Notice Project', requiredSkills: [] } as any, 'Open' as any);
      projectsRepo.update(proj.id, { members: [{ id: 'collab-1', role: 'Collaborator' }] } as any);

      const delRes = projectsService.softDeleteProject(proj.id, 'owner-1', 'project-owner', {
        confirmTitle: 'Notice Project',
        reasons: ['CHANGE_IN_PROJECT_DIRECTION'],
        explanation: 'Strategic realignment',
      });

      expect(delRes.mode).toBe('scheduled');
      expect(delRes.deletionScheduledAt).toBeDefined();

      const updatedProj = projectsRepo.findById(proj.id)!;
      expect(updatedProj.deletionScheduledAt).toBeDefined();
      expect(isProjectLocked(updatedProj)).toBe(true);
      expect(isVisibleProject(updatedProj)).toBe(false);
      expect(isLiveProject(updatedProj)).toBe(false);

      // Collaborator received notification
      const collabNotif = notifications.find((n) => n.userId === 'collab-1');
      expect(collabNotif).toBeDefined();
      expect(collabNotif.type).toBe('PROJECT_DELETION_SCHEDULED');

      // Audit entry written without free text
      const scheduledAudit = auditLogs.find((a) => a.action === 'PROJECT_DELETION_SCHEDULED');
      expect(scheduledAudit).toBeDefined();
      expect(scheduledAudit.details.reasonIds).toContain('CHANGE_IN_PROJECT_DIRECTION');
    });

    it('cancels scheduled deletion before deadline, unlocks project, and notifies members', () => {
      const proj = projectsRepo.create('owner-1', { title: 'Cancellable Project', requiredSkills: [] } as any, 'Open' as any);
      projectsRepo.update(proj.id, { members: [{ id: 'collab-1', role: 'Collaborator' }] } as any);

      projectsService.softDeleteProject(proj.id, 'owner-1', 'project-owner', {
        confirmTitle: 'Cancellable Project',
        reasons: ['PROJECT_NO_LONGER_REQUIRED'],
      });

      const cancelRes = projectsService.cancelDeletion(proj.id, 'owner-1', 'project-owner');
      expect(cancelRes.cancelled).toBe(true);
      expect(cancelRes.status).toBe('Open');

      const restoredProj = projectsRepo.findById(proj.id)!;
      expect(restoredProj.deletionScheduledAt).toBeUndefined();
      expect(isProjectLocked(restoredProj)).toBe(false);
      expect(isVisibleProject(restoredProj)).toBe(true);

      const cancelNotif = notifications.find((n) => n.userId === 'collab-1' && n.type === 'PROJECT_DELETION_CANCELLED');
      expect(cancelNotif).toBeDefined();
    });

    it('enforces 3 project deletions per 24 hours rate limit with 429 PROJECT_DELETE_LIMIT', () => {
      for (let i = 1; i <= 3; i++) {
        const p = projectsRepo.create('owner-limit', { title: `Proj ${i}`, requiredSkills: [] } as any, 'Open' as any);
        projectsService.softDeleteProject(p.id, 'owner-limit', 'project-owner', {
          confirmTitle: `Proj ${i}`,
        });
      }

      const p4 = projectsRepo.create('owner-limit', { title: 'Proj 4', requiredSkills: [] } as any, 'Open' as any);
      try {
        projectsService.softDeleteProject(p4.id, 'owner-limit', 'project-owner', {
          confirmTitle: 'Proj 4',
        });
        throw new Error('Should have thrown 429');
      } catch (err: any) {
        expect(err.getStatus ? err.getStatus() : err.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect(err.response?.code).toBe('PROJECT_DELETE_LIMIT');
      }
    });

    it('returns 410 PROJECT_DELETED tombstone for former members and 404 for strangers', () => {
      const proj = projectsRepo.create('owner-1', { title: 'Tombstone Project', requiredSkills: [] } as any, 'Open' as any);
      projectsRepo.update(proj.id, { members: [{ id: 'member-1', role: 'Collaborator' }] } as any);

      // Immediate delete by admin with reason
      projectsService.softDeleteProject(proj.id, 'admin-1', 'admin', {
        confirmTitle: 'Tombstone Project',
        reasons: ['LACK_OF_RESOURCES'],
        explanation: 'Budget discontinued for this platform initiative.',
      });

      // Former member gets 410 GONE with tombstone data
      try {
        projectsService.findById(proj.id, 'member-1');
        throw new Error('Expected 410');
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.GONE);
        expect(err.response.code).toBe('PROJECT_DELETED');
        expect(err.response.project.title).toBe('Tombstone Project');
        expect(err.response.project.reasons).toContain('LACK_OF_RESOURCES');
        expect(err.response.project.explanation).toContain('Budget discontinued');
      }

      // Stranger gets 404 NOT_FOUND
      try {
        projectsService.findById(proj.id, 'stranger-user');
        throw new Error('Expected 404');
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.NOT_FOUND);
      }
    });
  });

  // =========================================================================
  // 3. Hourly Job Finalization
  // =========================================================================
  describe('finalizeScheduledDeletions hourly job execution', () => {
    it('finalizes scheduled deletion after 48h notice, releases tasks, and closes requests/invites', async () => {
      const proj = projectsRepo.create('owner-1', { title: 'Finalize Target', requiredSkills: [] } as any, 'Open' as any);
      projectsRepo.update(proj.id, { members: [{ id: 'collab-1', role: 'Collaborator' }] } as any);

      allTasks.push({ id: 't-work', projectId: proj.id, assigneeId: 'collab-1', status: 'in-progress', title: 'Work In Progress' });
      allRequests.push({ id: 'req-wait', projectId: proj.id, status: 'pending' });
      allInvites.push({ id: 'inv-wait', projectId: proj.id, status: 'pending' });

      projectsService.softDeleteProject(proj.id, 'owner-1', 'project-owner', {
        confirmTitle: 'Finalize Target',
        reasons: ['CHANGE_IN_PROJECT_DIRECTION'],
      });

      // Advance clock past 48h
      fakeClock.advanceHours(49);

      // Call executeFinalDeletion through service/policy
      const evalBefore = deletionPolicyService.evaluate(proj.id, { id: 'owner-1', role: 'project-owner' });
      expect(evalBefore.allowed).toBe(true);

      const finalRes = projectsService.executeFinalDeletion(proj.id, 'owner-1');
      expect(finalRes.deletedAt).toBeDefined();

      // Tasks released to open
      const task = allTasks.find((t) => t.id === 't-work');
      expect(task.status).toBe('open');
      expect(task.assigneeId).toBeNull();

      // Requests closed
      const req = allRequests.find((r) => r.id === 'req-wait');
      expect(req.status).toBe('system_closed');

      // Invites cancelled
      const inv = allInvites.find((i) => i.id === 'inv-wait');
      expect(inv.status).toBe('cancelled');

      // Repeating is idempotent
      const finalRes2 = projectsService.executeFinalDeletion(proj.id, 'owner-1');
      expect(finalRes2.deletedAt).toBe(finalRes.deletedAt);
    });

    it('cancels scheduled deletion if a new blocker appears during the notice period', () => {
      const proj = projectsRepo.create('owner-1', { title: 'Blocker Appears Target', requiredSkills: [] } as any, 'Open' as any);
      projectsRepo.update(proj.id, { members: [{ id: 'collab-1', role: 'Collaborator' }] } as any);

      projectsService.softDeleteProject(proj.id, 'owner-1', 'project-owner', {
        confirmTitle: 'Blocker Appears Target',
        reasons: ['CHANGE_IN_PROJECT_DIRECTION'],
      });

      // Blocker appears: collaborator submits task for review!
      allTasks.push({ id: 't-new-rev', projectId: proj.id, status: 'in review', title: 'New submission' });

      // Advance clock past 48 hours
      fakeClock.advanceHours(49);

      const evalResult = deletionPolicyService.evaluate(proj.id, { id: 'owner-1', role: 'project-owner' });
      expect(evalResult.allowed).toBe(false);
      expect(evalResult.blockers[0].code).toBe('TASKS_IN_REVIEW');
    });
  });
});
