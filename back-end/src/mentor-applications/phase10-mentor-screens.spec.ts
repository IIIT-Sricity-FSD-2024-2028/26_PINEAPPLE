import { BadRequestException } from '@nestjs/common';
import { MentorApplicationsService } from './mentor-applications.service';
import { PlatformConfigService } from '../platform-config/platform-config.service';
import { MentorMarketplaceService } from '../mentor-marketplace/mentor-marketplace.service';
import { EscrowService } from '../escrow/escrow.service';

describe('Phase 10: Mentor Screens Backend Specification', () => {
  describe('Part C: University in Mentor Applications', () => {
    let mentorAppsService: MentorApplicationsService;
    let mockUsers: Map<string, any>;

    beforeEach(() => {
      mockUsers = new Map();
      mockUsers.set('user-vit', {
        id: 'user-vit',
        name: 'Rehen',
        email: 'rehen@example.com',
        university: 'vit',
        profile: { fullName: 'Rehen', university: 'vit' },
      });
      mockUsers.set('user-empty-uni', {
        id: 'user-empty-uni',
        name: 'No Uni User',
        email: 'nouni@example.com',
        university: '',
        profile: { fullName: 'No Uni User', university: '' },
      });
      mockUsers.set('user-no-profile-uni', {
        id: 'user-no-profile-uni',
        name: 'Undefined Uni User',
        email: 'undefined@example.com',
      });

      const mockUsersService: any = {
        findById: (id: string) => mockUsers.get(id),
        findUserSafe: (id: string) => mockUsers.get(id),
        findAll: () => Array.from(mockUsers.values()),
        update: () => {},
      };

      const mockAuditService: any = { log: () => {} };
      const mockNotificationsService: any = { create: () => {} };
      const platformConfigService = new PlatformConfigService();

      mentorAppsService = new MentorApplicationsService(
        mockUsersService,
        mockAuditService,
        platformConfigService,
        mockNotificationsService,
        {} as any,
        {} as any,
      );
    });

    const createDto = (userId: string, name: string, university?: string) => ({
      userId,
      name,
      email: `${userId}@example.com`,
      expertise: ['React', 'NestJS'],
      certificates: [{ name: 'Certified Architect', status: 'verified', holderName: name }],
      cvFileName: 'cv.pdf',
      years: 8,
      ...(university !== undefined ? { university } : {}),
    });

    it('applying copies the profile institution into the application when not passed', () => {
      const app = mentorAppsService.create(createDto('user-vit', 'Rehen') as any);
      expect(app).toBeDefined();
      expect(app.university).toBe('vit');
    });

    it('applying preserves an explicitly passed university', () => {
      const app = mentorAppsService.create(createDto('user-vit', 'Rehen', 'VIT Chennai') as any);
      expect(app).toBeDefined();
      expect(app.university).toBe('VIT Chennai');
    });

    it('an empty profile value returns empty, not an error', () => {
      const app = mentorAppsService.create(createDto('user-empty-uni', 'No Uni User') as any);
      expect(app).toBeDefined();
      expect(app.university).toBeUndefined();

      const app2 = mentorAppsService.create(createDto('user-no-profile-uni', 'Undefined Uni User') as any);
      expect(app2).toBeDefined();
      expect(app2.university).toBeUndefined();
    });

    it('admin list (findAll) and findOne return the university and older applications fall back to the profile value', () => {
      // Create application directly into items without university (simulating older pre-fix record)
      const olderAppId = 'app-legacy-1';
      (mentorAppsService as any).items.push({
        id: olderAppId,
        userId: 'user-vit',
        name: 'Rehen',
        status: 'pending',
        years: 7,
        university: undefined,
        createdAt: '2026-01-01T00:00:00.000Z',
      });

      // Reading via findOne populates university from user profile
      const found = mentorAppsService.findOne(olderAppId);
      expect(found).toBeDefined();
      expect(found.university).toBe('vit');

      // Reading via findAll populates university from user profile
      const allApps = mentorAppsService.findAll();
      const legacyInList = allApps.find((a) => a.id === olderAppId);
      expect(legacyInList).toBeDefined();
      expect(legacyInList?.university).toBe('vit');
    });
  });

  describe('Part A: Project Due Date on Mentor Sessions', () => {
    it('session enrichment includes projectDueDate for the mentor and follows a project deadline change', () => {
      const mockProject = {
        id: 'proj-101',
        title: 'Project Title Alpha',
        name: 'Project Title Alpha',
        dueDate: '2026-11-29T00:00:00.000Z',
      };

      const mockProjectsRepository: any = {
        findById: (id: string) => (id === 'proj-101' ? mockProject : null),
      };

      const mockUsersService: any = {
        findUserSafe: (id: string) => ({ id, name: 'Student Owner' }),
      };

      // Mock mentor marketplace service and test enrichSession
      const mockSession: any = {
        id: 'session-101',
        mentorId: 'mentor-profile-1',
        studentId: 'user-owner-1',
        projectId: 'proj-101',
        agreedPrice: 1500,
        status: 'escrow_funded',
      };

      const marketplaceService = new MentorMarketplaceService(
        new EscrowService(),
        {} as any,
        mockUsersService,
        {} as any,
        {} as any,
        {} as any,
        mockProjectsRepository,
        {} as any,
        {} as any,
        undefined,
        undefined,
      );

      // 1. Initial read includes projectDueDate from the project
      const enriched = marketplaceService.enrichSession(mockSession);
      expect(enriched.projectDueDate).toBe('2026-11-29T00:00:00.000Z');

      // 2. Project owner updates deadline
      mockProject.dueDate = '2026-12-15T00:00:00.000Z';

      // 3. Subsequent read dynamically returns the updated projectDueDate
      const updatedEnriched = marketplaceService.enrichSession(mockSession);
      expect(updatedEnriched.projectDueDate).toBe('2026-12-15T00:00:00.000Z');
    });
  });
});
