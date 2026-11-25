import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as http from 'http';

process.env.AUTH_MODE = 'jwt';
process.env.JWT_SECRET = 'teamforge-jwt-secret-key-development-minimum-32-chars';

import { AppModule } from '../src/app.module';
import { MentorMarketplaceService } from '../src/mentor-marketplace/mentor-marketplace.service';

const PORT = 3345;
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
  console.log('🚀 Starting Phase 7 Demo UPI QR Payment & Escrow Funding Test Suite...');

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
    // Owner: Jathin (id u-owner)
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

    // Collaborator: Arjun Sharma (id 2)
    const arjunLogin = await request(
      { path: '/auth/login', method: 'POST' },
      { email: 'arjun.sharma@teamforge.io', password: 'password123' },
    );
    const collabToken = arjunLogin.data?.accessToken;
    const collabHeaders = { Authorization: `Bearer ${collabToken}` };

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 30);
    const dueDateStr = tomorrow.toISOString().split('T')[0];

    // Create a fresh test project
    const proj1Res = await request(
      { path: '/projects', method: 'POST', headers: ownerHeaders },
      {
        title: 'UPI Payment Test Project 1',
        description: 'Testing UPI QR generation and payment hold',
        dueDate: dueDateStr,
        difficulty: 'Intermediate',
        duration: '1 Month',
      }
    );
    const proj1Id = proj1Res.data?.id;

    // Check 1: Booking creates session in status payment_pending with paymentIntent & UPI URI
    console.log('\n--- Check 1: Booking creates payment_pending session with UPI intent ---');
    const bookRes = await request(
      { path: '/mentor-marketplace/sessions/book', method: 'POST', headers: ownerHeaders },
      {
        mentorId: 'mentor-profile-1', // Neha Gupta, ₹1500
        projectId: proj1Id,
        projectDescription: 'Mentorship on system design and ML pipelines',
      }
    );

    const session1 = bookRes.data?.session;
    const paymentIntent1 = bookRes.data?.paymentIntent;

    assert(
      bookRes.status === 201 &&
        session1?.status === 'payment_pending' &&
        paymentIntent1 &&
        paymentIntent1.amount === 1755 && // 1500 + 225 (15%) + 30 (2%)
        String(paymentIntent1.upiUri).startsWith('upi://pay') &&
        paymentIntent1.payeeVpa === 'teamforge@demo',
      `Session created in 'payment_pending' with UPI QR URI (${paymentIntent1?.upiUri})`,
    );

    // Check 2: Hold enforced: concurrent booking on same project rejected with 409
    console.log('\n--- Check 2: Project hold active during payment_pending (409 on second booking) ---');
    const bookHoldRes = await request(
      { path: '/mentor-marketplace/sessions/book', method: 'POST', headers: ownerHeaders },
      {
        mentorId: 'mentor-profile-2',
        projectId: proj1Id,
        projectDescription: 'Concurrent attempt while payment pending',
      }
    );
    assert(
      bookHoldRes.status === 409,
      `Concurrent booking rejected with 409 Conflict during payment hold (got ${bookHoldRes.status})`,
    );

    // Check 3: Cancel payment releases project hold
    console.log('\n--- Check 3: Cancel payment sets session cancelled & releases hold ---');
    const cancelRes = await request(
      { path: `/mentor-marketplace/sessions/${session1.id}/cancel-payment`, method: 'POST', headers: ownerHeaders }
    );
    assert(
      cancelRes.status === 200 && cancelRes.data?.status === 'cancelled',
      `Session payment cancelled: status=${cancelRes.data?.status}`,
    );

    // Re-booking is now permitted because project hold was released
    const rebookRes = await request(
      { path: '/mentor-marketplace/sessions/book', method: 'POST', headers: ownerHeaders },
      {
        mentorId: 'mentor-profile-1',
        projectId: proj1Id,
        projectDescription: 'Re-booking after cancellation',
      }
    );
    const session2 = rebookRes.data?.session;
    assert(
      rebookRes.status === 201 && session2?.status === 'payment_pending',
      `Re-booking succeeded after cancellation: session=${session2?.id}`,
    );

    // Check 4: Confirm payment moves session to escrow_funded and creates escrow record
    console.log('\n--- Check 4: Confirm payment funds escrow & moves to escrow_funded ---');
    const confirmRes = await request(
      { path: `/mentor-marketplace/sessions/${session2.id}/confirm-payment`, method: 'POST', headers: ownerHeaders }
    );
    const confirmedSession = confirmRes.data?.session;
    const escrow = confirmRes.data?.escrow;

    assert(
      confirmRes.status === 200 &&
        confirmedSession?.status === 'escrow_funded' &&
        escrow &&
        escrow.status === 'Funded' &&
        escrow.totalFunded === 1755,
      `Payment confirmed: session=${confirmedSession?.status}, escrowId=${escrow?.id}, totalFunded=₹${escrow?.totalFunded}`,
    );

    // Check 5: Idempotency: Calling confirm-payment again returns existing without duplicate escrow
    console.log('\n--- Check 5: Idempotency (double-clicking "I have paid" creates only 1 funding) ---');
    const doubleConfirmRes = await request(
      { path: `/mentor-marketplace/sessions/${session2.id}/confirm-payment`, method: 'POST', headers: ownerHeaders }
    );
    assert(
      doubleConfirmRes.status === 200 &&
        doubleConfirmRes.data?.session?.id === session2.id &&
        doubleConfirmRes.data?.escrow?.id === escrow?.id,
      `Duplicate confirm returned existing escrow without error or duplicate funding (escrowId: ${doubleConfirmRes.data?.escrow?.id})`,
    );

    // Check 6: Non-owner cannot confirm payment for someone else's session (403)
    console.log('\n--- Check 6: Unauthorized caller cannot confirm payment (403) ---');
    const unauthConfirmRes = await request(
      { path: `/mentor-marketplace/sessions/${session2.id}/confirm-payment`, method: 'POST', headers: collabHeaders }
    );
    assert(
      unauthConfirmRes.status === 403,
      `Non-owner confirmation rejected with 403 (got ${unauthConfirmRes.status})`,
    );

    // Check 7: Expiry flow: Expired payment_pending session cannot be confirmed (400)
    console.log('\n--- Check 7: Expired payment_pending session rejected (400) & frees project ---');
    const projExpRes = await request(
      { path: '/projects', method: 'POST', headers: ownerHeaders },
      {
        title: 'Payment Expiry Test Project',
        description: 'Testing expiry of stale payment hold',
        dueDate: dueDateStr,
        difficulty: 'Easy',
        duration: '1 Month',
      }
    );
    const projExpId = projExpRes.data?.id;

    const bookExpRes = await request(
      { path: '/mentor-marketplace/sessions/book', method: 'POST', headers: ownerHeaders },
      {
        mentorId: 'mentor-profile-2',
        projectId: projExpId,
        projectDescription: 'Will let this expire',
      }
    );
    const sessionExp = bookExpRes.data?.session;

    // Simulate 10-minute expiry by directly aging the session's paymentExpiresAt on the backend
    const marketplaceService = app.get(MentorMarketplaceService, { strict: false });
    const rawSession = marketplaceService.sessions.find((s: any) => s.id === sessionExp.id);
    if (rawSession) {
      rawSession.paymentExpiresAt = new Date(Date.now() - 1000).toISOString();
    }

    const confirmExpRes = await request(
      { path: `/mentor-marketplace/sessions/${sessionExp.id}/confirm-payment`, method: 'POST', headers: ownerHeaders }
    );
    assert(
      confirmExpRes.status === 400,
      `Confirming expired session rejected with 400 (got ${confirmExpRes.status}: "${confirmExpRes.data?.message}")`,
    );

    // Verify project hold was freed upon expiry
    const rebookExpRes = await request(
      { path: '/mentor-marketplace/sessions/book', method: 'POST', headers: ownerHeaders },
      {
        mentorId: 'mentor-profile-2',
        projectId: projExpId,
        projectDescription: 'Re-booking project after hold expired',
      }
    );
    assert(
      rebookExpRes.status === 201 && rebookExpRes.data?.session?.status === 'payment_pending',
      `Project hold was released upon expiry; new booking succeeded`,
    );

    // Check 8: Admin stats report payment_pending separately and do NOT count towards escrowHeld
    console.log('\n--- Check 8: Admin revenue stats exclude payment_pending from escrow total ---');
    const statsRes = await request(
      { path: '/mentor-marketplace/sessions/admin-stats', method: 'GET', headers: adminHeaders }
    );
    const allSessRes = await request(
      { path: '/mentor-marketplace/sessions', method: 'GET', headers: adminHeaders }
    );
    const allSess = allSessRes.data || [];
    const fundedOrActive = allSess.filter((s: any) => s.status === 'escrow_funded' || s.status === 'active');
    const expectedEscrowSum = fundedOrActive.reduce((sum: number, s: any) => sum + (s.totalAmount || 0), 0);

    assert(
      statsRes.data?.escrowHeld === expectedEscrowSum && statsRes.data?.paymentPendingSessions >= 1,
      `escrowHeld (₹${statsRes.data?.escrowHeld}) matches funded/active sum (₹${expectedEscrowSum}); payment_pending counted separately (${statsRes.data?.paymentPendingSessions})`,
    );

  } catch (err: any) {
    console.error('Unexpected test error:', err);
    failed++;
  } finally {
    if (app) await app.close();
  }

  console.log(`\n================================`);
  console.log(`Phase 7 Test Results: ${passed} passed, ${failed} failed`);
  console.log(`================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
