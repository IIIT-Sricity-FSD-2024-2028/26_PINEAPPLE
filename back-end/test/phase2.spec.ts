import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as http from 'http';

process.env.AUTH_MODE = 'jwt';
process.env.JWT_SECRET = 'teamforge-jwt-secret-key-development-minimum-32-chars';

import { AppModule } from '../src/app.module';

const PORT = 3339;
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
  console.log('🚀 Starting Phase 2 Live Verification Suite...');

  const app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  await app.listen(PORT);

  const results: { name: string; pass: boolean; details: string }[] = [];

  try {
    // Logins to obtain real tokens
    const arjunLogin = await request(
      { path: '/auth/login', method: 'POST' },
      { email: 'arjun.sharma@teamforge.io', password: 'password123' },
    );
    const collabToken = arjunLogin.data?.accessToken;

    const jathinLogin = await request(
      { path: '/auth/login', method: 'POST' },
      { email: 'jathin@example.com', password: 'password123' },
    );
    const ownerToken = jathinLogin.data?.accessToken;

    const uCollabLogin = await request(
      { path: '/auth/login', method: 'POST' },
      { email: 'aditya@example.com', password: 'password123' },
    );
    const userCollabToken = uCollabLogin.data?.accessToken;

    // Kiran Bose (id: '3') is the approved mentor for proj-1
    const kiranLogin = await request(
      { path: '/auth/login', method: 'POST' },
      { email: 'kiran.bose@teamforge.io', password: 'password123' },
    );
    const kiranMentorToken = kiranLogin.data?.accessToken;

    // 1. Check user 2 (Arjun Sharma) ledger entries
    const ledgerRes = await request({
      path: '/gamification/2/ledger',
      headers: { Authorization: `Bearer ${collabToken}` },
    });

    const entries = Array.isArray(ledgerRes.data) ? ledgerRes.data : [];
    const sumXp = entries.reduce((s: number, e: any) => s + (e.xp || 0), 0);
    const sumRep = entries.reduce((s: number, e: any) => s + (e.rep || 0), 0);
    const hasTask1 = entries.some((e: any) => e.taskId === 'task-1');

    const pass1 = ledgerRes.status === 200 && sumXp === 2450 && sumRep === 87 && hasTask1;
    results.push({
      name: 'Check 1: Arjun Sharma seed ledger computed sum (2450 XP, 87 Rep, task-1 present)',
      pass: pass1,
      details: `Status: ${ledgerRes.status}, Entries: ${entries.length}, sumXp: ${sumXp}, sumRep: ${sumRep}, hasTask1: ${hasTask1}`,
    });

    // 2. Check user profile matches ledger sum
    const userRes = await request({
      path: '/users/2',
      headers: { Authorization: `Bearer ${collabToken}` },
    });
    const userXp = userRes.data?.profile?.xp;
    const userRep = userRes.data?.profile?.rep;
    const pass2 = userRes.status === 200 && userXp === 2450 && userRep === 87;
    results.push({
      name: 'Check 2: GET /users/2 returns identical XP and Rep matching ledger (2450 XP, 87 Rep)',
      pass: pass2,
      details: `Status: ${userRes.status}, profile.xp: ${userXp}, profile.rep: ${userRep}`,
    });

    // 3. Leaderboard all-time period ranks by ledger sum
    const lbAlltimeRes = await request({
      path: '/leaderboard?period=alltime',
      headers: { Authorization: `Bearer ${collabToken}` },
    });
    const lbAlltime = Array.isArray(lbAlltimeRes.data) ? lbAlltimeRes.data : [];
    const isSortedAlltime = lbAlltime.every(
      (entry: any, i: number) => i === 0 || entry.xp <= lbAlltime[i - 1].xp,
    );
    const arjunEntry = lbAlltime.find((e: any) => e.userId === '2');
    const pass3 = lbAlltimeRes.status === 200 && isSortedAlltime && arjunEntry?.xp === 2450;
    results.push({
      name: 'Check 3: Leaderboard all-time ranks strictly by ledger sum',
      pass: pass3,
      details: `Status: ${lbAlltimeRes.status}, Count: ${lbAlltime.length}, Arjun XP: ${arjunEntry?.xp}, Sorted: ${isSortedAlltime}`,
    });

    // 4. Leaderboard monthly period
    const lbMonthlyRes = await request({
      path: '/leaderboard?period=monthly',
      headers: { Authorization: `Bearer ${collabToken}` },
    });
    const lbMonthly = Array.isArray(lbMonthlyRes.data) ? lbMonthlyRes.data : [];
    const isSortedMonthly = lbMonthly.every(
      (entry: any, i: number) => i === 0 || entry.xp <= lbMonthly[i - 1].xp,
    );
    const pass4 = lbMonthlyRes.status === 200 && isSortedMonthly && lbMonthly.length > 0;
    results.push({
      name: 'Check 4: Leaderboard monthly (last 30 days) ranks directly by ledger sum',
      pass: pass4,
      details: `Status: ${lbMonthlyRes.status}, Count: ${lbMonthly.length}, Top XP: ${lbMonthly[0]?.xp}`,
    });

    // 5. Leaderboard weekly period
    const lbWeeklyRes = await request({
      path: '/leaderboard?period=weekly',
      headers: { Authorization: `Bearer ${collabToken}` },
    });
    const lbWeekly = Array.isArray(lbWeeklyRes.data) ? lbWeeklyRes.data : [];
    const isSortedWeekly = lbWeekly.every(
      (entry: any, i: number) => i === 0 || entry.xp <= lbWeekly[i - 1].xp,
    );
    const pass5 = lbWeeklyRes.status === 200 && isSortedWeekly && lbWeekly[0]?.xp > 0;
    results.push({
      name: 'Check 5: Leaderboard weekly (last 7 days) ranks directly by ledger sum with non-zero seed scores',
      pass: pass5,
      details: `Status: ${lbWeeklyRes.status}, Count: ${lbWeekly.length}, Top User: ${lbWeekly[0]?.user} (${lbWeekly[0]?.xp} XP)`,
    });

    // 6. Re-approval of task-1 (already in ledger) rejected with 400
    const dupApproveRes = await request(
      {
        path: '/tasks/task-1/status',
        method: 'PATCH',
        headers: { Authorization: `Bearer ${ownerToken}` },
      },
      { status: 'Completed' },
    );
    const pass6 =
      dupApproveRes.status === 400 &&
      String(dupApproveRes.data?.message || dupApproveRes.raw).includes(
        'XP and reputation have already been awarded for this task.',
      );
    results.push({
      name: 'Check 6: Re-approving already awarded task-1 rejected with 400 duplicate error',
      pass: pass6,
      details: `Status: ${dupApproveRes.status}, Message: "${dupApproveRes.data?.message}"`,
    });

    // 7. Create a new task, approve it once -> XP awarded
    const initialCollabStats = await request({
      path: '/users/u-collab',
      headers: { Authorization: `Bearer ${userCollabToken}` },
    });
    const initXp = Number(initialCollabStats.data?.profile?.xp || 0);
    const initRep = Number(initialCollabStats.data?.profile?.rep || 0);

    const createTaskRes = await request(
      {
        path: '/tasks',
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
      },
      {
        title: 'Phase 2 Ledger Test Task',
        description: 'Testing unified XP ledger approval',
        projectId: 'proj-1',
        assigneeId: 'u-collab',
        priority: 'High',
        dueDate: '2026-11-15',
      },
    );
    const newTaskId = createTaskRes.data?.id;

    // Approve new task
    const approveNewTaskRes = await request(
      {
        path: `/tasks/${newTaskId}/status`,
        method: 'PATCH',
        headers: { Authorization: `Bearer ${ownerToken}` },
      },
      { status: 'Completed' },
    );

    const postApprovalStats = await request({
      path: '/users/u-collab',
      headers: { Authorization: `Bearer ${userCollabToken}` },
    });
    const postXp = Number(postApprovalStats.data?.profile?.xp || 0);
    const postRep = Number(postApprovalStats.data?.profile?.rep || 0);

    const pass7 =
      approveNewTaskRes.status === 200 && postXp === initXp + 40 && postRep === initRep + 8;
    results.push({
      name: 'Check 7: First approval of new task awards +40 XP and +8 Rep (High priority)',
      pass: pass7,
      details: `Status: ${approveNewTaskRes.status}, XP: ${initXp} -> ${postXp}, Rep: ${initRep} -> ${postRep}`,
    });

    // 8. Re-approving the newly approved task must fail with 400
    const reApproveNewTaskRes = await request(
      {
        path: `/tasks/${newTaskId}/status`,
        method: 'PATCH',
        headers: { Authorization: `Bearer ${ownerToken}` },
      },
      { status: 'Completed' },
    );
    const pass8 =
      reApproveNewTaskRes.status === 400 &&
      String(reApproveNewTaskRes.data?.message || reApproveNewTaskRes.raw).includes(
        'XP and reputation have already been awarded for this task.',
      );
    results.push({
      name: 'Check 8: Approving same newly approved task second time rejected with 400',
      pass: pass8,
      details: `Status: ${reApproveNewTaskRes.status}, Message: "${reApproveNewTaskRes.data?.message}"`,
    });

    // 9. Awarding recommendation badge must NOT mint new XP or Reputation
    const preBadgeStats = await request({
      path: '/users/8',
      headers: { Authorization: `Bearer ${collabToken}` },
    });
    const preBadgeXp = Number(preBadgeStats.data?.profile?.xp || 0);
    const preBadgeRep = Number(preBadgeStats.data?.profile?.rep || 0);

    const badgeAwardRes = await request(
      {
        path: '/mentorship/badge',
        method: 'POST',
        headers: { Authorization: `Bearer ${kiranMentorToken}` },
      },
      {
        collaboratorId: '8',
        projectId: 'proj-1',
        badgeName: 'Technical Excellence',
        comment: 'Outstanding contribution to project architecture!',
      },
    );

    const postBadgeStats = await request({
      path: '/users/8',
      headers: { Authorization: `Bearer ${collabToken}` },
    });
    const afterBadgeXp = Number(postBadgeStats.data?.profile?.xp || 0);
    const afterBadgeRep = Number(postBadgeStats.data?.profile?.rep || 0);
    const hasMentorBadge = Boolean(postBadgeStats.data?.profile?.hasMentorBadge);

    const pass9 =
      (badgeAwardRes.status === 200 || badgeAwardRes.status === 201) &&
      afterBadgeXp === preBadgeXp &&
      afterBadgeRep === preBadgeRep &&
      hasMentorBadge;
    results.push({
      name: 'Check 9: Awarding recommendation badge is recognition only (0 XP/Rep minted)',
      pass: pass9,
      details: `Status: ${badgeAwardRes.status}, XP: ${preBadgeXp} -> ${afterBadgeXp} (no change), Rep: ${preBadgeRep} -> ${afterBadgeRep} (no change), hasMentorBadge: ${hasMentorBadge}`,
    });

    // 10. Ledger endpoint contains new entry with taskId
    const uCollabLedgerRes = await request({
      path: '/gamification/u-collab/ledger',
      headers: { Authorization: `Bearer ${userCollabToken}` },
    });
    const uCollabEntries = Array.isArray(uCollabLedgerRes.data) ? uCollabLedgerRes.data : [];
    const taskEntry = uCollabEntries.find((e: any) => e.taskId === newTaskId);
    const pass10 =
      uCollabLedgerRes.status === 200 &&
      Boolean(taskEntry) &&
      taskEntry.xp === 40 &&
      taskEntry.rep === 8;
    results.push({
      name: 'Check 10: GET /gamification/:userId/ledger returns append-only entries with taskId',
      pass: pass10,
      details: `Status: ${uCollabLedgerRes.status}, Total Entries: ${uCollabEntries.length}, Found Task Entry: ${Boolean(taskEntry)}`,
    });
  } catch (err: any) {
    console.error('Test execution error:', err);
  } finally {
    await app.close();
  }

  console.log('\n========================================');
  console.log('       PHASE 2 VERIFICATION REPORT       ');
  console.log('========================================');
  let allPassed = true;
  for (const r of results) {
    const mark = r.pass ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark} - ${r.name}`);
    console.log(`       Details: ${r.details}`);
    if (!r.pass) allPassed = false;
  }
  console.log('========================================');
  if (allPassed) {
    console.log('🎉 ALL 10 PHASE 2 CHECKS PASSED PERFECTLY!');
    process.exit(0);
  } else {
    console.error('⚠️ SOME PHASE 2 CHECKS FAILED!');
    process.exit(1);
  }
}

runTests();
