import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as http from 'http';

process.env.AUTH_MODE = 'jwt';
process.env.JWT_SECRET = 'teamforge-jwt-secret-key-development-minimum-32-chars';

import { AppModule } from '../src/app.module';

const PORT = 3343;
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
  console.log('🚀 Starting Phase 5 Project Capacity & Collaborator Limit Test Suite...');

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
    // Owner: Jathin (id u-owner, Role: Project Owner)
    const jathinLogin = await request(
      { path: '/auth/login', method: 'POST' },
      { email: 'jathin@example.com', password: 'password123' },
    );
    const ownerToken = jathinLogin.data?.accessToken;
    const ownerHeaders = { Authorization: `Bearer ${ownerToken}` };

    // Collaborator 1: Arjun Sharma (id 2, Collaborator)
    const arjunLogin = await request(
      { path: '/auth/login', method: 'POST' },
      { email: 'arjun.sharma@teamforge.io', password: 'password123' },
    );
    const collab1Token = arjunLogin.data?.accessToken;
    const collab1Headers = { Authorization: `Bearer ${collab1Token}` };

    // Collaborator 2: Aditya Sai (id 6, Collaborator)
    const adityaLogin = await request(
      { path: '/auth/login', method: 'POST' },
      { email: 'aditya.sai@teamforge.io', password: 'password123' },
    );
    const collab2Token = adityaLogin.data?.accessToken;
    const collab2Headers = { Authorization: `Bearer ${collab2Token}` };

    // Collaborator 3: Vikram Nair (id 8, Collaborator)
    const vikramLogin = await request(
      { path: '/auth/login', method: 'POST' },
      { email: 'vikram.nair@teamforge.io', password: 'password123' },
    );
    const collab3Token = vikramLogin.data?.accessToken;
    const collab3Headers = { Authorization: `Bearer ${collab3Token}` };

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 30);
    const dueDateStr = tomorrow.toISOString().split('T')[0];

    // Check 1: Project with maxCollaborators capped at platform config (e.g. 50 -> 20)
    console.log('\n--- Check 1: Enforce platformConfig maxCollaboratorCapacity cap ---');
    const cappedProjRes = await request(
      { path: '/projects', method: 'POST', headers: ownerHeaders },
      {
        title: 'High Capacity AI Project',
        description: 'Testing that requesting 50 collaborators gets clamped to platform cap of 20',
        maxCollaborators: 50,
        dueDate: dueDateStr,
        difficulty: 'Intermediate',
        duration: '2 months',
      }
    );
    assert(
      cappedProjRes.status === 201 && cappedProjRes.data?.maxCollaborators === 20,
      `Project created with maxCollaborators clamped to platform limit of 20 (got ${cappedProjRes.data?.maxCollaborators})`,
    );

    // Check 2: Create a tight project with maxCollaborators = 1
    console.log('\n--- Check 2: Create project with maxCollaborators = 1 ---');
    const tightProjRes = await request(
      { path: '/projects', method: 'POST', headers: ownerHeaders },
      {
        title: 'Pair Programming Duo Project',
        description: 'Tight project with exactly 1 collaborator slot',
        maxCollaborators: 1,
        dueDate: dueDateStr,
        difficulty: 'Easy',
        duration: '1 month',
      }
    );
    const tightProjId = tightProjRes.data?.id;
    assert(
      tightProjRes.status === 201 && tightProjRes.data?.maxCollaborators === 1 && tightProjRes.data?.isFull === false,
      `Project created with maxCollaborators = 1, isFull = ${tightProjRes.data?.isFull}`,
    );

    // Check 3: Submit 2 pending join requests (User 2 and User 6)
    console.log('\n--- Check 3: Two users submit join requests for the 1 available slot ---');
    const req1Res = await request(
      { path: '/join-requests', method: 'POST', headers: collab1Headers },
      { projectId: tightProjId, message: 'I want to be the collaborator!' }
    );
    const req2Res = await request(
      { path: '/join-requests', method: 'POST', headers: collab2Headers },
      { projectId: tightProjId, message: 'Pick me instead!' }
    );
    assert(
      req1Res.status === 201 && req2Res.status === 201,
      `Both join requests submitted while open (req1: ${req1Res.data?.id}, req2: ${req2Res.data?.id})`,
    );
    const req1Id = req1Res.data?.id;
    const req2Id = req2Res.data?.id;

    // Check 4: Owner approves Request 1 (fills the last slot) -> Auto-rejects Request 2 with 'Project is full'
    console.log('\n--- Check 4: Approving Request 1 fills project and auto-rejects remaining pending requests ---');
    const approve1Res = await request(
      { path: `/join-requests/${req1Id}`, method: 'PUT', headers: ownerHeaders },
      { status: 'Approved' }
    );
    assert(
      approve1Res.status === 200 && approve1Res.data?.status === 'Approved',
      `Request 1 approved successfully`,
    );

    // Check project status now: isFull must be true, collaboratorCount = 1
    const tightProjUpdated = await request(
      { path: `/projects/${tightProjId}`, method: 'GET', headers: ownerHeaders }
    );
    assert(
      tightProjUpdated.status === 200 && tightProjUpdated.data?.isFull === true && tightProjUpdated.data?.approvedCollaboratorCount === 1,
      `Project is now marked full (isFull: ${tightProjUpdated.data?.isFull}, approvedCollaboratorCount: ${tightProjUpdated.data?.approvedCollaboratorCount}/${tightProjUpdated.data?.maxCollaborators})`,
    );

    // Verify Request 2 was automatically rejected with reason 'Project is full'
    const req2Check = await request(
      { path: `/join-requests/${req2Id}`, method: 'GET', headers: ownerHeaders }
    );
    assert(
      req2Check.status === 200 && req2Check.data?.status === 'Rejected' && req2Check.data?.reason === 'Project is full',
      `Request 2 was auto-rejected: status=${req2Check.data?.status}, reason="${req2Check.data?.reason}"`,
    );

    // Check 5: Applying to a full project returns 409 Conflict ("This project is full.")
    console.log('\n--- Check 5: Applying to a full project returns 409 Conflict ---');
    const applyFullRes = await request(
      { path: '/join-requests', method: 'POST', headers: collab3Headers },
      { projectId: tightProjId, message: 'Can I squeeze in?' }
    );
    assert(
      applyFullRes.status === 409,
      `Expected 409 Conflict for applying to full project, got ${applyFullRes.status} (${JSON.stringify(applyFullRes.data?.message)})`,
    );

    // Check 6: Approving an additional request when full returns 409 Conflict
    console.log('\n--- Check 6: Approving a request when project is full returns 409 Conflict ---');
    const approveFullRes = await request(
      { path: `/join-requests/${req2Id}`, method: 'PUT', headers: ownerHeaders },
      { status: 'Approved' }
    );
    assert(
      approveFullRes.status === 409,
      `Expected 409 Conflict when attempting to approve into a full project, got ${approveFullRes.status} (${JSON.stringify(approveFullRes.data?.message)})`,
    );

    // Check 7: Owner and Mentor are excluded from approved collaborator count
    console.log('\n--- Check 7: Owner and Mentor are excluded from collaborator count ---');
    const proj1Res = await request(
      { path: '/projects/proj-1', method: 'GET', headers: ownerHeaders }
    );
    const count = proj1Res.data?.approvedCollaboratorCount;
    assert(
      proj1Res.status === 200 && count === 2,
      `proj-1 has 2 approved collaborators (excluding owner and mentor), got ${count}`,
    );

  } catch (err: any) {
    console.error('Unexpected test error:', err);
    failed++;
  } finally {
    if (app) await app.close();
  }

  console.log(`\n================================`);
  console.log(`Phase 5 Test Results: ${passed} passed, ${failed} failed`);
  console.log(`================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
