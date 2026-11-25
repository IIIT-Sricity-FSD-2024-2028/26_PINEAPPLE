import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as http from 'http';

process.env.AUTH_MODE = 'jwt';
process.env.JWT_SECRET = 'teamforge-jwt-secret-key-development-minimum-32-chars';

import { AppModule } from '../src/app.module';

const PORT = 3341;
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

function formatDateISO(d: Date): string {
  return d.toISOString().split('T')[0];
}

async function runTests() {
  console.log('🚀 Starting Phase 3 Calendar DatePicker & Due Dates Test Suite...');

  const app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  await app.listen(PORT);

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
    // Authenticate as Jathin (Project Owner, id 1)
    const loginRes = await request(
      { path: '/auth/login', method: 'POST' },
      { email: 'jathin@example.com', password: 'password123' }
    );
    const ownerToken = loginRes.data?.accessToken;
    const authHeaders = { Authorization: `Bearer ${ownerToken}` };

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextMonth = new Date(today);
    nextMonth.setDate(nextMonth.getDate() + 30);
    const twoMonths = new Date(today);
    twoMonths.setDate(twoMonths.getDate() + 60);

    // Check 1: Reject project creation with past date (400)
    console.log('\n--- Check 1: Reject project creation with past date (400) ---');
    const pastProjRes = await request(
      { path: '/projects', method: 'POST', headers: authHeaders },
      {
        title: 'Past Project Test',
        description: 'Testing project creation with a past due date',
        dueDate: formatDateISO(yesterday),
        difficulty: 'Intermediate',
        duration: '1 month',
      }
    );
    assert(
      pastProjRes.status === 400,
      `Expected 400 Bad Request for past date, got ${pastProjRes.status} (${JSON.stringify(pastProjRes.data?.message)})`
    );

    // Check 2: Reject project creation with today's date (400)
    console.log('\n--- Check 2: Reject project creation with today date (400) ---');
    const todayProjRes = await request(
      { path: '/projects', method: 'POST', headers: authHeaders },
      {
        title: 'Today Project Test',
        description: 'Testing project creation with today due date',
        dueDate: formatDateISO(today),
        difficulty: 'Intermediate',
        duration: '1 month',
      }
    );
    assert(
      todayProjRes.status === 400,
      `Expected 400 Bad Request for today date (must be >= tomorrow), got ${todayProjRes.status} (${JSON.stringify(todayProjRes.data?.message)})`
    );

    // Check 3: Accept project creation with future date (>= tomorrow) (201)
    console.log('\n--- Check 3: Accept project creation with future date (>= tomorrow) (201) ---');
    const validProjRes = await request(
      { path: '/projects', method: 'POST', headers: authHeaders },
      {
        title: 'Autonomous Drone Navigation System',
        description: 'Building deep learning pipeline for real-time drone obstacle avoidance',
        dueDate: formatDateISO(nextMonth),
        difficulty: 'Advanced',
        duration: '1 month',
        maxCollaborators: 5,
        requiredSkills: ['Python', 'OpenCV', 'ROS'],
      }
    );
    assert(
      validProjRes.status === 201 && validProjRes.data?.dueDate === formatDateISO(nextMonth),
      `Project created with valid future due date (${validProjRes.data?.dueDate}), id: ${validProjRes.data?.id}`
    );
    const createdProjectId = validProjRes.data?.id;

    // Check 4: Reject task creation with past date (400)
    console.log('\n--- Check 4: Reject task creation with past date (400) ---');
    const pastTaskRes = await request(
      { path: '/tasks', method: 'POST', headers: authHeaders },
      {
        projectId: createdProjectId,
        title: 'Past Task Delivery',
        description: 'Task with past due date should be rejected',
        priority: 'High',
        dueDate: formatDateISO(yesterday),
      }
    );
    assert(
      pastTaskRes.status === 400,
      `Expected 400 Bad Request for past task date, got ${pastTaskRes.status} (${JSON.stringify(pastTaskRes.data?.message)})`
    );

    // Check 5: Reject task creation with date after project due date (400)
    console.log('\n--- Check 5: Reject task creation with date after project due date (400) ---');
    const overTaskRes = await request(
      { path: '/tasks', method: 'POST', headers: authHeaders },
      {
        projectId: createdProjectId,
        title: 'Exceeding Task Delivery',
        description: 'Task with date after project due date should be rejected',
        priority: 'Medium',
        dueDate: formatDateISO(twoMonths),
      }
    );
    assert(
      overTaskRes.status === 400,
      `Expected 400 Bad Request when task due date exceeds project due date, got ${overTaskRes.status} (${JSON.stringify(overTaskRes.data?.message)})`
    );

    // Check 6: Accept task creation with valid date between today and project due date (201)
    console.log('\n--- Check 6: Accept task creation with valid date within project window (201) ---');
    const validTaskRes = await request(
      { path: '/tasks', method: 'POST', headers: authHeaders },
      {
        projectId: createdProjectId,
        title: 'Setup Simulation Environment',
        description: 'Install Gazebo and ROS simulator package',
        priority: 'High',
        dueDate: formatDateISO(nextWeek),
      }
    );
    assert(
      validTaskRes.status === 201 && validTaskRes.data?.dueDate === formatDateISO(nextWeek),
      `Task created successfully with due date (${validTaskRes.data?.dueDate}), id: ${validTaskRes.data?.id}`
    );

    // Check 7: Overdue flag computed on tasks with past due dates
    console.log('\n--- Check 7: Overdue flag computed on seeded task with past due date ---');
    const task3Res = await request(
      { path: '/tasks/task-3', method: 'GET', headers: authHeaders }
    );
    assert(
      task3Res.status === 200 && task3Res.data?.isOverdue === true,
      `Task task-3 with due date ${task3Res.data?.dueDate} has isOverdue: ${task3Res.data?.isOverdue}`
    );

    // Check 8: Non-overdue task has isOverdue: false
    console.log('\n--- Check 8: Non-overdue task has isOverdue: false ---');
    const task2Res = await request(
      { path: '/tasks/task-2', method: 'GET', headers: authHeaders }
    );
    assert(
      task2Res.status === 200 && task2Res.data?.isOverdue === false,
      `Task task-2 with future due date ${task2Res.data?.dueDate} has isOverdue: ${task2Res.data?.isOverdue}`
    );

    // Check 9: Completed task is not marked overdue even if past due date
    console.log('\n--- Check 9: Completed task (task-1) is not overdue ---');
    const task1Res = await request(
      { path: '/tasks/task-1', method: 'GET', headers: authHeaders }
    );
    assert(
      task1Res.status === 200 && task1Res.data?.isOverdue === false,
      `Completed task-1 has status '${task1Res.data?.status}' and isOverdue: ${task1Res.data?.isOverdue}`
    );

  } catch (err: any) {
    console.error('Unexpected test error:', err);
    failed++;
  } finally {
    await app.close();
  }

  console.log(`\n================================`);
  console.log(`Phase 3 Test Results: ${passed} passed, ${failed} failed`);
  console.log(`================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
