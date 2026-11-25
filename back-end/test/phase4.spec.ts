import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as http from 'http';

process.env.AUTH_MODE = 'jwt';
process.env.JWT_SECRET = 'teamforge-jwt-secret-key-development-minimum-32-chars';

import { AppModule } from '../src/app.module';

const PORT = 3342;
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
  console.log('🚀 Starting Phase 4 Owner Applicant Profile Inspection Test Suite...');

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
    // Personas:
    // User 2: Arjun Sharma (Owner of proj-2)
    const arjunLogin = await request(
      { path: '/auth/login', method: 'POST' },
      { email: 'arjun.sharma@teamforge.io', password: 'password123' },
    );
    const arjunOwnerToken = arjunLogin.data?.accessToken;

    // User 6: Aditya Sai (Collaborator on proj-2)
    const adityaLogin = await request(
      { path: '/auth/login', method: 'POST' },
      { email: 'aditya.sai@teamforge.io', password: 'password123' },
    );
    const adityaCollabToken = adityaLogin.data?.accessToken;

    // Admin: admin@teamforge.io
    const adminLogin = await request(
      { path: '/auth/login', method: 'POST' },
      { email: 'admin@teamforge.io', password: 'admin123' },
    );
    const adminToken = adminLogin.data?.accessToken;

    // Check 1: Anonymous request rejected (401)
    console.log('\n--- Check 1: Anonymous request rejected (401) ---');
    const anonRes = await request({
      path: '/users/6/public-profile',
      method: 'GET',
    });
    assert(anonRes.status === 401, `Expected 401 Unauthorized for anonymous caller, got ${anonRes.status}`);

    // Check 2: Unauthorized collaborator blocked from inspecting unrelated user (403)
    console.log('\n--- Check 2: Unrelated user blocked from inspecting profile (403) ---');
    // Aditya Sai (id 6) has no projects with Neha Gupta (id 7)
    const strangerRes = await request({
      path: '/users/7/public-profile',
      method: 'GET',
      headers: { Authorization: `Bearer ${adityaCollabToken}` },
    });
    assert(
      strangerRes.status === 403,
      `Expected 403 Forbidden for unrelated caller, got ${strangerRes.status} (${JSON.stringify(strangerRes.data?.message)})`,
    );

    // Check 3: Project Owner can inspect applicant/collaborator on their project (200)
    console.log('\n--- Check 3: Project Owner can inspect applicant/collaborator (200) ---');
    // Arjun (owner of proj-2) inspects Aditya Sai (collaborator on proj-2)
    const ownerRes = await request({
      path: '/users/6/public-profile',
      method: 'GET',
      headers: { Authorization: `Bearer ${arjunOwnerToken}` },
    });
    assert(
      ownerRes.status === 200,
      `Project Owner successfully inspected applicant profile, got status ${ownerRes.status}`,
    );

    // Check 4: Administrator can inspect any public profile (200)
    console.log('\n--- Check 4: Administrator can inspect any public profile (200) ---');
    const adminRes = await request({
      path: '/users/6/public-profile',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      adminRes.status === 200,
      `Administrator successfully inspected applicant profile, got status ${adminRes.status}`,
    );

    // Check 5: Public profile contains all required public fields
    console.log('\n--- Check 5: Public profile contains all required fields ---');
    const data = ownerRes.data;
    const hasName = Boolean(data?.name && data.name.includes('Aditya'));
    const hasRole = Boolean(data?.role);
    const hasMemberSince = Boolean(data?.memberSince);
    const hasXpAndRep = typeof data?.xp === 'number' && typeof data?.rep === 'number';
    const hasProjectsAndTasks = typeof data?.projectsCount === 'number' && typeof data?.tasksCompleted === 'number';
    const hasBadgesAndHistory = Array.isArray(data?.recommendationBadges) && Array.isArray(data?.contributionHistory);
    const hasCompletedProjects = Array.isArray(data?.completedProjects);

    assert(
      hasName && hasRole && hasMemberSince && hasXpAndRep && hasProjectsAndTasks && hasBadgesAndHistory && hasCompletedProjects,
      `Profile returned name="${data?.name}", role="${data?.role}", memberSince="${data?.memberSince}", xp=${data?.xp}, rep=${data?.rep}, projectsCount=${data?.projectsCount}, tasksCompleted=${data?.tasksCompleted}, badges=${data?.recommendationBadges?.length}, history=${data?.contributionHistory?.length}`,
    );

    // Check 6: Strictly hides sensitive private fields
    console.log('\n--- Check 6: Public profile strictly hides sensitive fields ---');
    const noEmail = data?.email === undefined;
    const noPhone = data?.phone === undefined;
    const noWarnings = data?.warnings === undefined;
    const noSuspensions = data?.suspensions === undefined;
    const noFlagControls = data?.flagControls === undefined && data?.isFlagged === undefined;
    const noRecentActivity = data?.recentActivity === undefined;
    const noPassword = data?.password === undefined;

    assert(
      noEmail && noPhone && noWarnings && noSuspensions && noFlagControls && noRecentActivity && noPassword,
      `Sensitive fields absent: email=${noEmail}, phone=${noPhone}, warnings=${noWarnings}, suspensions=${noSuspensions}, flags=${noFlagControls}, activity=${noRecentActivity}, password=${noPassword}`,
    );

    // Check 7: Non-existent user returns 404
    console.log('\n--- Check 7: Non-existent user returns 404 ---');
    const notFoundRes = await request({
      path: '/users/non-existent-9999/public-profile',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      notFoundRes.status === 404,
      `Expected 404 Not Found for non-existent user, got ${notFoundRes.status}`,
    );

  } catch (err: any) {
    console.error('Unexpected test error:', err);
    failed++;
  } finally {
    if (app) await app.close();
  }

  console.log(`\n================================`);
  console.log(`Phase 4 Test Results: ${passed} passed, ${failed} failed`);
  console.log(`================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
