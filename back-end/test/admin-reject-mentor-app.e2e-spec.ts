import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import { createTestApp, TestAppContext } from './helpers/test-helpers';
import { ACTION_CONFIGS } from '../src/feedback/reason-config';
import { FeedbackService } from '../src/feedback/feedback.service';
import { MentorApplicationsService } from '../src/mentor-applications/mentor-applications.service';
import { NotificationsService } from '../src/notifications/notifications.service';

describe('ADMIN REJECT MENTOR APPLICATION & REASON CONTRACT TESTS', () => {
  let ctx: TestAppContext;
  let app: INestApplication;
  let server: any;
  let feedbackService: FeedbackService;
  let mentorAppsService: MentorApplicationsService;
  let notificationsService: NotificationsService;

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;
    server = app.getHttpServer();
    feedbackService = app.get(FeedbackService);
    mentorAppsService = app.get(MentorApplicationsService);
    notificationsService = app.get(NotificationsService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    ctx.resetStores();
  });

  function seedMentorApplication(applicantUserId = 'applicant-user-1', name = 'Priya Patel') {
    return mentorAppsService.create({
      userId: applicantUserId,
      name,
      email: `${applicantUserId}@teamforge.dev`,
      bio: 'Staff Software Engineer with 8 years building distributed microservices and mentoring juniors.',
      skills: ['TypeScript', 'Node.js', 'Go', 'Docker'],
      experience: '8 years software engineering',
      years: 8,
      linkedin: `https://linkedin.com/in/${applicantUserId}`,
      motivation: 'Passionate about mentoring the next generation of engineers.',
      cvFileName: 'test_mentor_cv.pdf',
      cvOriginalName: 'mentor_resume.pdf',
      cvFileSize: 102400,
      certificates: [
        {
          id: `cert-${applicantUserId}`,
          docType: 'DEGREE',
          title: 'B.Tech Computer Science',
          issuer: 'Tech Institute',
          holderName: name,
          verificationStatus: 'verified',
        },
      ],
    } as any);
  }

  describe('1. Universal Reason Contract Guards', () => {
    it('verifies feedbackService accepts every actionType and every configured reason.id in reason-config.ts', () => {
      const actionKeys = Object.keys(ACTION_CONFIGS);
      expect(actionKeys.length).toBeGreaterThan(0);

      for (const actionKey of actionKeys) {
        const config = ACTION_CONFIGS[actionKey];
        expect(config).toBeDefined();
        expect(config.reasons).toBeDefined();
        expect(Array.isArray(config.reasons)).toBe(true);

        for (const reasonObj of config.reasons) {
          expect(reasonObj.id).toBeDefined();
          expect(reasonObj.label).toBeDefined();

          // Construct valid payload according to action rules
          const explanation = reasonObj.id === 'OTHER' || config.explanationRequired
            ? 'Detailed explanation satisfying all feedback contract rules.'
            : undefined;

          const validated = feedbackService.validate(actionKey, {
            reasons: [reasonObj.id],
            explanation,
          });

          expect(validated).toBeDefined();
          expect(validated.valid).toBe(true);
          expect(validated.reasons).toContain(reasonObj.id);
        }
      }
    });

    it('guard test: scans the frontend source tree and asserts every actionType used exists in backend ACTION_CONFIGS', () => {
      function walk(dir: string): string[] {
        let results: string[] = [];
        if (!fs.existsSync(dir)) return results;
        for (const entry of fs.readdirSync(dir)) {
          const fullPath = path.join(dir, entry);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            if (entry !== 'node_modules') {
              results = results.concat(walk(fullPath));
            }
          } else if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
            results.push(fullPath);
          }
        }
        return results;
      }

      let frontendSrcDir = path.resolve(process.cwd(), '../React-Implementation/React-Implementation/src');
      if (!fs.existsSync(frontendSrcDir)) {
        frontendSrcDir = path.resolve(process.cwd(), 'React-Implementation/React-Implementation/src');
      }
      expect(fs.existsSync(frontendSrcDir)).toBe(true);

      const files = walk(frontendSrcDir);
      expect(files.length).toBeGreaterThan(0);

      const frontendActionTypes = new Set<string>();
      const actionTypePattern = /actionType\s*[:=]\s*['"]([A-Z0-9_]+)['"]/g;

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        let match: RegExpExecArray | null;
        while ((match = actionTypePattern.exec(content)) !== null) {
          frontendActionTypes.add(match[1]);
        }
      }

      expect(frontendActionTypes.size).toBeGreaterThan(0);

      const configuredActionTypes = new Set(Object.keys(ACTION_CONFIGS));

      for (const fActionType of frontendActionTypes) {
        expect(configuredActionTypes.has(fActionType)).toBe(true);
      }
    });
  });

  describe('2. ADMIN_REJECT_MENTOR_APP Valid Reasons', () => {
    const validReasonIds = [
      'CREDENTIAL_VERIFICATION_FAILED',
      'INSUFFICIENT_EXPERIENCE',
      'APPLICATION_INCOMPLETE',
      'PROFILE_QUALITY_BELOW_STANDARDS',
      'OTHER',
    ];

    for (const reasonId of validReasonIds) {
      it(`successfully rejects mentor application with reason ID "${reasonId}"`, async () => {
        const adminToken = ctx.loginAs('admin');
        const applicantId = `test-user-${reasonId.toLowerCase().replace(/_/g, '-')}`;
        const appRecord = seedMentorApplication(applicantId, `Applicant ${reasonId}`);

        const payload: any = {
          reasons: [reasonId],
          explanation: reasonId === 'OTHER'
            ? 'Applicant credentials could not be reconciled with repository contributions.'
            : `Testing rejection with tag ${reasonId}`,
        };

        const res = await request(server)
          .put(`/mentor-applications/${appRecord.id}/reject`)
          .set('Authorization', adminToken)
          .send(payload)
          .expect(200);

        expect(res.body).toBeDefined();
        expect(res.body.status).toBe('rejected');
        expect(res.body.rejectedAt).toBeDefined();

        // Check persisted state in service
        const updated = mentorAppsService.findOne(appRecord.id);
        expect(updated.status).toBe('rejected');
        expect(updated.rejectedAt).toBeDefined();
        expect(updated.reapplyCooldownUntil || updated.cooldownUntil).toBeDefined();

        // Check feedback history entry
        const history = feedbackService.findByEntity('MENTOR_APPLICATION', appRecord.id);
        expect(history.length).toBe(1);
        expect(history[0].actionType).toBe('ADMIN_REJECT_MENTOR_APP');
        expect(history[0].reasons).toContain(reasonId);
      });
    }
  });

  describe('3. Validation & Edge Cases for ADMIN_REJECT_MENTOR_APP', () => {
    it('fails with 400 when OTHER is selected without an explanation', async () => {
      const adminToken = ctx.loginAs('admin');
      const appRecord = seedMentorApplication('user-no-expl', 'No Explanation User');

      const res = await request(server)
        .put(`/mentor-applications/${appRecord.id}/reject`)
        .set('Authorization', adminToken)
        .send({
          reasons: ['OTHER'],
          explanation: '',
        })
        .expect(400);

      expect(res.body.message || res.body.error).toBeDefined();
    });

    it('fails with 400 when an unknown or invalid reason ID is sent', async () => {
      const adminToken = ctx.loginAs('admin');
      const appRecord = seedMentorApplication('user-invalid-id', 'Invalid Reason User');

      const res = await request(server)
        .put(`/mentor-applications/${appRecord.id}/reject`)
        .set('Authorization', adminToken)
        .send({
          reasons: ['INVALID_REASON_CODE_XYZ'],
          explanation: 'Testing invalid reason code.',
        })
        .expect(400);

      expect(res.body.message || res.body.error).toBeDefined();
    });

    it('returns 409 ConflictException when rejecting an already-rejected application and records no duplicate feedback', async () => {
      const adminToken = ctx.loginAs('admin');
      const appRecord = seedMentorApplication('user-double-reject', 'Double Reject User');

      // First rejection succeeds
      await request(server)
        .put(`/mentor-applications/${appRecord.id}/reject`)
        .set('Authorization', adminToken)
        .send({
          reasons: ['APPLICATION_INCOMPLETE'],
          explanation: 'First rejection reason.',
        })
        .expect(200);

      const historyBefore = feedbackService.findByEntity('MENTOR_APPLICATION', appRecord.id);
      expect(historyBefore.length).toBe(1);

      // Second rejection fails with 409
      const res = await request(server)
        .put(`/mentor-applications/${appRecord.id}/reject`)
        .set('Authorization', adminToken)
        .send({
          reasons: ['PROFILE_QUALITY_BELOW_STANDARDS'],
          explanation: 'Second rejection attempt.',
        })
        .expect(409);

      expect(res.body.message || res.body.error).toBeDefined();

      // No duplicate feedback recorded
      const historyAfter = feedbackService.findByEntity('MENTOR_APPLICATION', appRecord.id);
      expect(historyAfter.length).toBe(1);
      expect(historyAfter[0].reasons).toContain('APPLICATION_INCOMPLETE');
    });

    it('sets 14-day re-apply cooldown and prevents applicant from immediately reapplying', async () => {
      const adminToken = ctx.loginAs('admin');
      const applicantId = 'applicant-cooldown-check';
      const appRecord = seedMentorApplication(applicantId, 'Cooldown Check User');

      await request(server)
        .put(`/mentor-applications/${appRecord.id}/reject`)
        .set('Authorization', adminToken)
        .send({
          reasons: ['INSUFFICIENT_EXPERIENCE'],
          explanation: 'Applicant does not meet minimum 4 years requirement.',
        })
        .expect(200);

      const cooldown = mentorAppsService.getCooldownInfo(applicantId);
      expect(cooldown.inCooldown).toBe(true);
      expect(cooldown.cooldownDays).toBe(14);
      expect(cooldown.availableAt).toBeDefined();

      const diffDays = Math.round(
        (new Date(cooldown.availableAt!).getTime() - new Date(cooldown.rejectedAt!).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      expect(diffDays).toBe(14);

      // Attempting to reapply during cooldown throws 409
      expect(() => {
        mentorAppsService.create({
          userId: applicantId,
          name: 'Cooldown Check User',
          email: `${applicantId}@teamforge.dev`,
          bio: 'Reapplying too soon.',
          skills: ['TypeScript'],
          experience: '4 years',
        } as any);
      }).toThrow();
    });

    it('creates an in-app notification for the applicant containing the reason tags and view explanation link', async () => {
      const adminToken = ctx.loginAs('admin');
      const applicantId = 'applicant-notif-check';
      const appRecord = seedMentorApplication(applicantId, 'Notif Check User');

      await request(server)
        .put(`/mentor-applications/${appRecord.id}/reject`)
        .set('Authorization', adminToken)
        .send({
          reasons: ['CREDENTIAL_VERIFICATION_FAILED'],
          explanation: 'Degree certificate could not be validated with issuing authority.',
        })
        .expect(200);

      const notifs = notificationsService.findByUser(applicantId);
      expect(notifs.length).toBeGreaterThan(0);

      const rejectNotif = notifs.find((n) => n.type === 'MENTOR_APPLICATION_REJECTED');
      expect(rejectNotif).toBeDefined();
      expect(rejectNotif!.message).toContain('CREDENTIAL_VERIFICATION_FAILED');
      expect(rejectNotif!.message).toContain('View explanation: /profile');
      expect(rejectNotif!.link).toBe('/profile');
    });
  });
});
