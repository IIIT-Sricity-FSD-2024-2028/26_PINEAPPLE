import { Controller, Get, Post, GoneException, UnauthorizedException } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import {
  buildRouteAuthMatrixFromApp,
  findUnguardedRoutes,
  PUBLIC_ROUTE_ALLOWLIST,
  validatePublicAllowList,
} from './route-auth-matrix';
import { Public } from '../../auth/decorators/public.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { GovernanceController } from '../../governance/governance.controller';
import { MentorshipController } from '../../mentorship/mentorship.controller';

@Controller('zeta')
class FakeZetaController {
  @Roles('user')
  @Get('second')
  getSecond() {
    return { ok: true };
  }

  @Roles('user')
  @Post('first')
  postFirst() {
    return { ok: true };
  }
}

@Controller('alpha')
class FakeAlphaController {
  @Public()
  @Get('public-health')
  getPublicHealth() {
    return { ok: true };
  }

  @Get('unguarded')
  getUnguarded() {
    return { ok: true };
  }
}

describe('Phase 21 Unit Tests: Legacy Route Retirement & Route Auth Matrix', () => {
  it('matrix builder produces deterministic stably sorted output by path then method', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [DiscoveryModule],
      controllers: [FakeZetaController, FakeAlphaController],
    }).compile();

    const app = moduleRef.createNestApplication();
    await app.init();

    const firstPass = buildRouteAuthMatrixFromApp(app);
    const secondPass = buildRouteAuthMatrixFromApp(app);

    expect(firstPass).toEqual(secondPass);
    expect(firstPass.map((r) => `${r.method} ${r.path}`)).toEqual([
      'GET /alpha/public-health',
      'GET /alpha/unguarded',
      'POST /zeta/first',
      'GET /zeta/second',
    ]);

    await app.close();
  });

  it('allow-list check fails when a fake controller exposes an unexpected @Public() route', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [DiscoveryModule],
      controllers: [FakeAlphaController],
    }).compile();

    const app = moduleRef.createNestApplication();
    await app.init();

    const routes = buildRouteAuthMatrixFromApp(app);
    const validation = validatePublicAllowList(routes, PUBLIC_ROUTE_ALLOWLIST);
    expect(validation.valid).toBe(false);
    expect(validation.unexpectedPublic).toContain('GET /alpha/public-health');

    const unguarded = findUnguardedRoutes(routes);
    expect(unguarded.map((r) => `${r.method} ${r.path}`)).toContain('GET /alpha/unguarded');

    await app.close();
  });

  it('GovernanceController retired handlers throw 410 LEGACY_ENDPOINT_REMOVED naming canonical replacements', () => {
    const ctrl = new GovernanceController();
    const calls: Array<[() => unknown, string]> = [
      [() => ctrl.createReport(), 'POST /reports'],
      [() => ctrl.getAllReports(), 'GET /admin/reports'],
      [() => ctrl.getReportById(), 'GET /admin/reports/:id'],
      [() => ctrl.resolveReport(), 'PATCH /admin/reports/:id/status'],
    ];

    for (const [fn, expectedReplacement] of calls) {
      let caught: any;
      try {
        fn();
      } catch (err: any) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(GoneException);
      const resp = caught.getResponse();
      expect(resp.statusCode).toBe(410);
      expect(resp.code).toBe('LEGACY_ENDPOINT_REMOVED');
      expect(String(resp.message)).toContain(expectedReplacement);
    }
  });

  it('MentorshipController retires parallel application routes with 410 and keeps badge route on verified JWT identity only', () => {
    const mockSvc = {
      issueBadge: (mentorId: string, dto: any, role?: string) => ({ mentorId, dto, role }),
      getBadgesByUserId: (id: string) => [{ recipientId: id }],
      getBadgesByProjectId: (id: string) => [{ projectId: id }],
    };
    const ctrl = new MentorshipController(mockSvc as any);

    const retiredCalls: Array<[() => unknown, string]> = [
      [() => ctrl.applyForMentorship(), 'POST /mentor-applications'],
      [() => ctrl.getApplicationByUserId(), 'GET /mentor-applications/me'],
      [() => ctrl.reviewApplication(), 'PUT /mentor-applications/:id/approve'],
    ];
    for (const [fn, expectedReplacement] of retiredCalls) {
      let caught: any;
      try {
        fn();
      } catch (err: any) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(GoneException);
      expect(caught.getResponse().code).toBe('LEGACY_ENDPOINT_REMOVED');
      expect(String(caught.getResponse().message)).toContain(expectedReplacement);
    }

    const prevMode = process.env.AUTH_MODE;
    process.env.AUTH_MODE = 'jwt';
    try {
      const issued = ctrl.issueBadge(
        { uid: 'verified-mentor-4', role: 'Mentor' },
        'spoofed-header-id',
        'Super User',
        { recipientId: '2', projectId: 'proj-1' } as any,
      );
      expect(issued).toEqual({
        mentorId: 'verified-mentor-4',
        dto: { recipientId: '2', projectId: 'proj-1' },
        role: 'Mentor',
      });

      expect(() =>
        ctrl.issueBadge(
          undefined,
          'spoofed-header-id',
          'Mentor',
          { recipientId: '2', projectId: 'proj-1' } as any,
        ),
      ).toThrow(UnauthorizedException);
    } finally {
      process.env.AUTH_MODE = prevMode;
    }
  });
});
