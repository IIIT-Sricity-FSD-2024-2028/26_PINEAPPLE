import { BadRequestException } from '@nestjs/common';
import { MentorApplicationsService } from './mentor-applications.service';
import { PlatformConfigService } from '../platform-config/platform-config.service';

describe('Mentor Applications Validation & Platform Config Tenure (Phase 4)', () => {
  let mentorAppsService: MentorApplicationsService;
  let platformConfigService: PlatformConfigService;

  beforeEach(() => {
    platformConfigService = new PlatformConfigService();

    const mockUsersService: any = {
      findById: (id: string) => ({ id, name: 'Test User', role: 'collaborator' }),
      findUserSafe: (id: string) => ({ id, name: 'Test User', role: 'collaborator' }),
      findAll: () => [],
      update: () => {},
    };

    const mockAuditService: any = {
      log: () => {},
    };

    const mockNotificationsService: any = {
      create: () => {},
    };

    mentorAppsService = new MentorApplicationsService(
      mockUsersService,
      mockAuditService,
      platformConfigService,
      mockNotificationsService,
      {} as any,
      {} as any,
    );
  });

  const createDto = (userId: string, years: any) => ({
    userId,
    name: `Dr. Jane Mentor ${userId}`,
    email: `jane-${userId}@example.com`,
    expertise: ['AI', 'Python'],
    certificates: [{ name: 'PhD CS', status: 'verified', holderName: `Dr. Jane Mentor ${userId}` }],
    cvFileName: 'resume.pdf',
    years,
  });

  describe('Years of Experience Validation (whole number 5 to 40)', () => {

    it('rejects years = 4 (below minimum 5)', () => {
      expect(() => {
        mentorAppsService.create(createDto('user-1', 4) as any);
      }).toThrow(BadRequestException);
    });

    it('accepts years = 5 (boundary minimum)', () => {
      const app = mentorAppsService.create(createDto('user-2', 5) as any);
      expect(app).toBeDefined();
      expect(app.years).toBe(5);
    });

    it('accepts years = 40 (boundary maximum)', () => {
      const app = mentorAppsService.create(createDto('user-3', 40) as any);
      expect(app).toBeDefined();
      expect(app.years).toBe(40);
    });

    it('rejects years = 41 (above maximum 40)', () => {
      expect(() => {
        mentorAppsService.create(createDto('user-4', 41) as any);
      }).toThrow(BadRequestException);
    });

    it('rejects non-integer years = 5.5', () => {
      expect(() => {
        mentorAppsService.create(createDto('user-5', 5.5) as any);
      }).toThrow(BadRequestException);
    });

    it('rejects non-numeric string years = "abc"', () => {
      expect(() => {
        mentorAppsService.create(createDto('user-6', 'abc') as any);
      }).toThrow(BadRequestException);
    });

    it('rejects null/undefined years', () => {
      expect(() => {
        mentorAppsService.create(createDto('user-7', null) as any);
      }).toThrow(BadRequestException);
    });
  });

  describe('Platform Config Tenure Validation', () => {
    it('defaults minimum tenure to 5', () => {
      const config = platformConfigService.getConfig();
      expect(config.mentorMinYearsExperience).toBe(5);
      expect(config.minimumTenure).toBe(5);
    });

    it('allows raising minimum tenure from 5 to 7', () => {
      const updated = platformConfigService.updateConfig({ minimumTenure: 7 });
      expect(updated.mentorMinYearsExperience).toBe(7);
      expect(updated.minimumTenure).toBe(7);
    });

    it('rejects lowering minimum tenure from 7 back to 5', () => {
      platformConfigService.updateConfig({ minimumTenure: 7 });
      expect(() => {
        platformConfigService.updateConfig({ minimumTenure: 5 });
      }).toThrow(BadRequestException);
    });

    it('rejects minimum tenure above 40 (e.g. 45)', () => {
      expect(() => {
        platformConfigService.updateConfig({ minimumTenure: 45 });
      }).toThrow(BadRequestException);
    });

    it('rejects fractional minimum tenure (e.g. 6.5)', () => {
      expect(() => {
        platformConfigService.updateConfig({ minimumTenure: 6.5 });
      }).toThrow(BadRequestException);
    });

    it('uses dynamic raised config tenure when evaluating applications', () => {
      // Raise config to 8
      platformConfigService.updateConfig({ minimumTenure: 8 });

      // An applicant with 7 years now fails
      expect(() => {
        mentorAppsService.create(createDto('user-dynamic-7', 7) as any);
      }).toThrow(BadRequestException);

      // An applicant with 8 years succeeds
      const app = mentorAppsService.create(createDto('user-dynamic-8', 8) as any);
      expect(app.years).toBe(8);
    });
  });
});
