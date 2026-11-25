import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as http from 'http';

process.env.AUTH_MODE = 'jwt';
process.env.JWT_SECRET = 'teamforge-jwt-secret-key-development-minimum-32-chars';

import { AppModule } from '../src/app.module';

const PORT = 3344;
const BASE_URL = `http://localhost:${PORT}`;

function request(options: any, postData: any = null): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(options.url || options.path, BASE_URL);
    const reqOptions: http.RequestOptions = {
      method: options.method || 'GET',
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: options.headers || {},
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json || data,
          raw: data,
        });
      });
    });

    req.on('error', reject);

    if (postData) {
      const body = typeof postData === 'string' ? postData : JSON.stringify(postData);
      req.setHeader('Content-Type', 'application/json');
      req.setHeader('Content-Length', Buffer.byteLength(body));
      req.write(body);
    }
    req.end();
  });
}

async function runTests() {
  console.log('🚀 Starting Phase 6 Single Mentor per Project & Clean Escrow Ledger Test Suite...');

  let app: any = null;
  try {
    app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.listen(PORT);
  } catch (err: any) {
    console.error('Fatal error during NestFactory.create:', err);
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${desc}`);
      failed++;
    }
  }

  try {
    // 1. Authenticate Personas
    // Owner: Jathin (id u-owner, Project Owner)
    const jathinLogin = await request(
      { path: '/auth/login', method: 'POST' },
      { email: 'jathin@example.com', password: 'password123' },
    );
    const ownerToken = jathinLogin.data?.accessToken;
    const ownerHeaders = { Authorization: `Bearer ${ownerToken}` };

    // Admin: Admin User (id 10)
    const adminLogin = await request(
      { path: '/auth/login', method: 'POST' },
      { email: 'admin@teamforge.io', password: 'admin123' },
    );
    const adminToken = adminLogin.data?.accessToken;
    const adminHeaders = { Authorization: `Bearer ${adminToken}` };

    // Mentor: Neha Gupta (id 7, mentor-profile-1)
    const nehaLogin = await request(
      { path: '/auth/login', method: 'POST' },
      { email: 'neha.gupta@teamforge.io', password: 'password123' },
    );
    const mentor1Token = nehaLogin.data?.accessToken;
    const mentor1Headers = { Authorization: `Bearer ${mentor1Token}` };

    // Mentor: Rohan Mehta (id 4, mentor-profile-2)
    const rohanLogin = await request(
      { path: '/auth/login', method: 'POST' },
      { email: 'rohan.mehta@teamforge.io', password: 'password123' },
    );
    const mentor2Token = rohanLogin.data?.accessToken;
    const mentor2Headers = { Authorization: `Bearer ${mentor2Token}` };

    // Collaborator: Arjun Sharma (id 2)
    const arjunLogin = await request(
      { path: '/auth/login', method: 'POST' },
      { email: 'arjun.sharma@teamforge.io', password: 'password123' },
    );
    const collabToken = arjunLogin.data?.accessToken;
    const collabHeaders = { Authorization: `Bearer ${collabToken}` };

    // Priya Patel (id 1, Admin & Owner of proj-1)
    const priyaLogin = await request(
      { path: '/auth/login', method: 'POST' },
      { email: 'priya.patel@teamforge.io', password: 'password123' },
    );
    const priyaToken = priyaLogin.data?.accessToken;
    const priyaHeaders = { Authorization: `Bearer ${priyaToken}` };

    // Check 1: Startup reconciliation fixed duplicate session for proj-2
    console.log('\n--- Check 1: Startup reconciliation of bad/duplicate data ---');
    const allSessionsRes = await request(
      { path: '/mentor-marketplace/sessions', method: 'GET', headers: adminHeaders }
    );
    const sessions = allSessionsRes.data || [];
    const proj2Sessions = sessions.filter((s: any) => s.projectId === 'proj-2');
    const proj2Active = proj2Sessions.find((s: any) => s.id === 'session-proj-2-rohan');
    const proj2Dup = proj2Sessions.find((s: any) => s.id === 'session-proj-2-dup');

    assert(
      proj2Active && proj2Active.status === 'active' && proj2Dup && proj2Dup.status === 'refunded',
      `Duplicate session session-proj-2-dup was automatically reconciled to 'refunded' on startup (active: ${proj2Active?.status}, dup: ${proj2Dup?.status})`,
    );

    // Check 2: Escrow integrity (admin stats escrowHeld matches sum of funded and active sessions)
    console.log('\n--- Check 2: Escrow total matches sum of funded and active sessions only ---');
    const adminStatsRes = await request(
      { path: '/mentor-marketplace/sessions/admin-stats', method: 'GET', headers: adminHeaders }
    );
    const stats = adminStatsRes.data;
    const fundedOrActive = sessions.filter((s: any) => s.status === 'escrow_funded' || s.status === 'active');
    const expectedEscrowSum = fundedOrActive.reduce((sum: number, s: any) => sum + (s.totalAmount || 0), 0);

    assert(
      stats && stats.escrowHeld === expectedEscrowSum,
      `Currently in Escrow (₹${stats?.escrowHeld}) matches sum of live sessions (₹${expectedEscrowSum})`,
    );

    // Check 3: Refuse booking on a completed project (HTTP 400)
    console.log('\n--- Check 3: Cannot book mentor for completed project ---');
    const compTestProj = await request(
      { path: '/projects', method: 'POST', headers: ownerHeaders },
      { title: 'Completed Proj Test', description: 'Testing completed project booking', requiredSkills: ['React'] }
    );
    const compTestProjId = compTestProj.data?.id;
    await request(
      { path: `/projects/${compTestProjId}/complete`, method: 'PATCH', headers: ownerHeaders },
      { finalLink: 'https://github.com/test/completed' }
    );
    const bookCompletedRes = await request(
      { path: '/mentor-marketplace/sessions/book', method: 'POST', headers: ownerHeaders },
      {
        mentorId: 'mentor-profile-1',
        projectId: compTestProjId, // Completed project
        projectDescription: 'Trying to book on completed project',
      }
    );
    assert(
      bookCompletedRes.status === 400,
      `Booking on completed project rejected with 400 (got ${bookCompletedRes.status})`,
    );

    // Check 4: Non-owner cannot book mentor for someone else's project (HTTP 403)
    console.log('\n--- Check 4: Non-owner cannot book mentor for someone else\'s project ---');
    const bookNonOwnerRes = await request(
      { path: '/mentor-marketplace/sessions/book', method: 'POST', headers: ownerHeaders },
      {
        mentorId: 'mentor-profile-1',
        projectId: 'proj-1', // Owned by user 1 (Priya Patel), caller is Jathin
        projectDescription: 'Unauthorized booking attempt',
      }
    );
    assert(
      bookNonOwnerRes.status === 403,
      `Booking by non-owner rejected with 403 (got ${bookNonOwnerRes.status})`,
    );

    // Check 5: Project that already has an assigned mentor cannot be booked (HTTP 409)
    console.log('\n--- Check 5: Project with assigned mentor rejects new booking with 409 ---');
    const bookAlreadyHasMentorRes = await request(
      { path: '/mentor-marketplace/sessions/book', method: 'POST', headers: priyaHeaders },
      {
        mentorId: 'mentor-profile-1',
        projectId: 'proj-1', // Owned by Priya, but already has mentor Kiran Bose assigned
        projectDescription: 'Second mentor attempt for proj-1',
      }
    );
    assert(
      bookAlreadyHasMentorRes.status === 409,
      `Booking for project with existing mentor rejected with 409 Conflict (got ${bookAlreadyHasMentorRes.status})`,
    );

    // Check 6: Valid first booking on an eligible project succeeds (HTTP 201)
    console.log('\n--- Check 6: First valid booking succeeds with escrow funding ---');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 30);
    const dueDateStr = tomorrow.toISOString().split('T')[0];

    const createProjRes = await request(
      { path: '/projects', method: 'POST', headers: ownerHeaders },
      {
        title: 'Mentorship Test Project',
        description: 'Testing single mentor rule and escrow transitions',
        dueDate: dueDateStr,
        difficulty: 'Intermediate',
        duration: '1 Month',
      }
    );
    const testProjId = createProjRes.data?.id;

    const book1Res = await request(
      { path: '/mentor-marketplace/sessions/book', method: 'POST', headers: ownerHeaders },
      {
        mentorId: 'mentor-profile-1', // Neha Gupta, ₹1500
        projectId: testProjId,
        projectDescription: 'Need guidance on AI model tuning and system architecture',
      }
    );
    const book1Session = book1Res.data?.session;

    // Confirm demo payment to fund escrow
    const confirm1Res = await request(
      { path: `/mentor-marketplace/sessions/${book1Session.id}/confirm-payment`, method: 'POST', headers: ownerHeaders }
    );
    const confirmed1 = confirm1Res.data?.session;
    assert(
      book1Res.status === 201 && confirmed1?.status === 'escrow_funded',
      `First booking and payment succeeded: status=${confirmed1?.status}, totalAmount=₹${confirmed1?.totalAmount}`,
    );

    // Check 7: Second concurrent/subsequent booking for the same project is refused with 409
    console.log('\n--- Check 7: Second booking for same project rejected with 409 ---');
    const book2Res = await request(
      { path: '/mentor-marketplace/sessions/book', method: 'POST', headers: ownerHeaders },
      {
        mentorId: 'mentor-profile-2', // Rohan Mehta
        projectId: testProjId,
        projectDescription: 'Attempting concurrent second booking for same project',
      }
    );
    assert(
      book2Res.status === 409,
      `Second booking refused with 409 Conflict (got ${book2Res.status}, message: "${book2Res.data?.message}")`,
    );

    // Check 8: Mentor declines session -> refunds escrow and frees the project
    console.log('\n--- Check 8: Mentor declines session -> refunds escrow & frees project ---');
    const declineRes = await request(
      { path: `/mentor-marketplace/sessions/${book1Session.id}/decline`, method: 'POST', headers: mentor1Headers }
    );
    assert(
      (declineRes.status === 200 || declineRes.status === 201) && declineRes.data?.status === 'refunded',
      `Session declined successfully: status=${declineRes.data?.status}`,
    );

    // Project is free again! Now book Rohan Mehta
    const bookAfterDeclineRes = await request(
      { path: '/mentor-marketplace/sessions/book', method: 'POST', headers: ownerHeaders },
      {
        mentorId: 'mentor-profile-2', // Rohan Mehta, ₹800
        projectId: testProjId,
        projectDescription: 'Re-booking with Rohan Mehta after first was declined',
      }
    );
    const newSession = bookAfterDeclineRes.data?.session;

    // Confirm payment for new session
    const confirm2Res = await request(
      { path: `/mentor-marketplace/sessions/${newSession.id}/confirm-payment`, method: 'POST', headers: ownerHeaders }
    );
    const confirmed2 = confirm2Res.data?.session;
    assert(
      bookAfterDeclineRes.status === 201 && confirmed2?.status === 'escrow_funded',
      `Project was freed after decline: new booking & payment succeeded (status=${confirmed2?.status}, totalAmount=₹${confirmed2?.totalAmount})`,
    );

    // Check 9: Mentor accepts booking -> session becomes active, mentor assigned
    console.log('\n--- Check 9: Mentor accepts session -> becomes active, project assigned ---');
    const acceptRes = await request(
      { path: `/mentor-marketplace/sessions/${newSession.id}/accept`, method: 'POST', headers: mentor2Headers }
    );
    assert(
      (acceptRes.status === 200 || acceptRes.status === 201) && acceptRes.data?.status === 'active',
      `Session accepted: status=${acceptRes.data?.status}`,
    );

    const projectAfterAccept = await request(
      { path: `/projects/${testProjId}`, method: 'GET', headers: ownerHeaders }
    );
    assert(
      projectAfterAccept.status === 200 && projectAfterAccept.data?.mentorId === '4',
      `Project now reflects mentorId=4 (${projectAfterAccept.data?.mentor})`,
    );

    // Check 10: Escrow balance updated accurately and equals table sum
    console.log('\n--- Check 10: Final escrow ledger reconciliation ---');
    const finalStatsRes = await request(
      { path: '/mentor-marketplace/sessions/admin-stats', method: 'GET', headers: adminHeaders }
    );
    const finalSessionsRes = await request(
      { path: '/mentor-marketplace/sessions', method: 'GET', headers: adminHeaders }
    );
    const finalSessions = finalSessionsRes.data || [];
    const finalLive = finalSessions.filter((s: any) => s.status === 'escrow_funded' || s.status === 'active');
    const finalExpectedSum = finalLive.reduce((sum: number, s: any) => sum + (s.totalAmount || 0), 0);

    assert(
      finalStatsRes.data?.escrowHeld === finalExpectedSum,
      `Final escrowHeld (₹${finalStatsRes.data?.escrowHeld}) matches live session total sum (₹${finalExpectedSum}) across ${finalLive.length} active sessions`,
    );

  } catch (err: any) {
    console.error('Unexpected test error:', err);
    failed++;
  } finally {
    if (app) await app.close();
  }

  console.log(`\n================================`);
  console.log(`Phase 6 Test Results: ${passed} passed, ${failed} failed`);
  console.log(`================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
