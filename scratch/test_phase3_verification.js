// scratch/test_phase3_verification.js
const http = require('http');

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const payload = options.body
      ? typeof options.body === 'string'
        ? options.body
        : JSON.stringify(options.body)
      : null;

    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method: options.method || 'GET',
      headers,
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, data: json, headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, data: body, text: body, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function run() {
  console.log('=== PHASE 3 AUTOMATED VERIFICATION ===\n');
  const results = [];

  function record(desc, pass, details = '') {
    results.push({ desc, pass, details });
    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${desc} ${details ? '(' + details + ')' : ''}`);
  }

  try {
    const ts = Date.now();
    const futureDueDate = new Date(Date.now() + 86400000 * 14).toISOString();

    // 1. Admin login
    const adminLogin = await request('/auth/login', {
      method: 'POST',
      body: { identifier: 'superuser@teamforge.io', password: 'Super@123' },
    });
    const adminToken = adminLogin.data?.accessToken || adminLogin.data?.token;
    record('1. Admin login succeeds', adminLogin.status === 200 && Boolean(adminToken));

    const adminHeaders = {
      'Authorization': `Bearer ${adminToken}`,
      'x-user-role': 'superuser',
      'x-user-id': 'u-superuser',
    };

    // 2. Signup fresh user X
    const userEmail = `userx.${ts}@teamforge.io`;
    const username = `userx_${ts}`;
    const userPass = 'Password123!';
    const userName = 'Aditya Koka';

    const userSignup = await request('/auth/signup', {
      method: 'POST',
      body: { email: userEmail, username, password: userPass, name: userName, role: 'Collaborator' },
    });
    const userXId = String(userSignup.data?.user?.id || userSignup.data?.id || userSignup.data?.user?.uid);
    record('2. User X created', (userSignup.status === 201 || userSignup.status === 200) && Boolean(userXId), `ID: ${userXId}`);

    // Login as User X
    const loginUserX = await request('/auth/login', {
      method: 'POST',
      body: { identifier: userEmail, password: userPass },
    });
    const userXToken = loginUserX.data?.accessToken || loginUserX.data?.token;
    record('3. User X login succeeds', loginUserX.status === 200 && Boolean(userXToken));

    const userXHeaders = {
      'Authorization': `Bearer ${userXToken}`,
      'x-user-id': userXId,
    };

    // 3. Create Project A (where User X will be Mentor)
    const projARes = await request('/projects', {
      method: 'POST',
      headers: adminHeaders,
      body: {
        title: `Project A for Phase3 ${ts}`,
        description: 'Project A where User X is Mentor',
        category: 'Web Development',
        difficulty: 'Intermediate',
        dueDate: futureDueDate,
        ownerId: 'u-superuser',
        maxCollaborators: 5,
        mentorId: userXId,
        mentor: { id: userXId, name: userName, role: 'Mentor' },
      },
    });
    const projAId = projARes.data?.id;
    record('4. Project A created with User X as Mentor', projARes.status === 201 && Boolean(projAId), `Project ID: ${projAId}`);

    // 4. Create Project B (where User X will be Collaborator)
    const projBRes = await request('/projects', {
      method: 'POST',
      headers: adminHeaders,
      body: {
        title: `Project B for Phase3 ${ts}`,
        description: 'Project B where User X is Collaborator',
        category: 'Mobile App',
        difficulty: 'Beginner',
        dueDate: futureDueDate,
        ownerId: 'u-superuser',
        maxCollaborators: 5,
        collaborators: [{ id: userXId, name: userName, role: 'Collaborator' }],
      },
    });
    const projBId = projBRes.data?.id;
    record('5. Project B created with User X as Collaborator', projBRes.status === 201 && Boolean(projBId), `Project ID: ${projBId}`);

    // 5. Create Project C (where User X is NOT a member)
    const projCRes = await request('/projects', {
      method: 'POST',
      headers: adminHeaders,
      body: {
        title: `Project C for Phase3 ${ts}`,
        description: 'Project C where User X is not a member',
        category: 'Machine Learning',
        difficulty: 'Advanced',
        dueDate: futureDueDate,
        ownerId: 'u-superuser',
        maxCollaborators: 5,
        collaborators: [],
      },
    });
    const projCId = projCRes.data?.id;
    record('6. Project C created without User X', projCRes.status === 201 && Boolean(projCId), `Project ID: ${projCId}`);

    // 6. User X sends message in Project A (should return role: Mentor, even if x-user-role is Collaborator)
    const sendMsgARes = await request('/communication/messages', {
      method: 'POST',
      headers: {
        ...userXHeaders,
        'x-user-role': 'Collaborator', // Attempting to spoof navbar role
      },
      body: {
        projectId: projAId,
        text: 'Hello from Project A!',
      },
    });
    const msgA = sendMsgARes.data;
    const isMentorInA = msgA?.projectRole === 'Mentor' && (msgA?.role === 'Mentor' || msgA?.senderRole === 'Mentor');
    record('7. Message in Project A returns projectRole "Mentor" (ignores navbar role)', sendMsgARes.status === 201 && isMentorInA, `Role: ${msgA?.projectRole}`);

    // 7. User X sends message in Project B (should return role: Collaborator, even if x-user-role is Mentor)
    const sendMsgBRes = await request('/communication/messages', {
      method: 'POST',
      headers: {
        ...userXHeaders,
        'x-user-role': 'Mentor', // Attempting to spoof navbar role
      },
      body: {
        projectId: projBId,
        text: 'Hello from Project B!',
      },
    });
    const msgB = sendMsgBRes.data;
    const isCollabInB = msgB?.projectRole === 'Collaborator' && (msgB?.role === 'Collaborator' || msgB?.senderRole === 'Collaborator');
    record('8. Message in Project B returns projectRole "Collaborator" (ignores navbar role)', sendMsgBRes.status === 201 && isCollabInB, `Role: ${msgB?.projectRole}`);

    // 8. Non-member sending message to Project C returns 403 Forbidden
    const sendMsgCRes = await request('/communication/messages', {
      method: 'POST',
      headers: userXHeaders,
      body: {
        projectId: projCId,
        text: 'Hello from non-member in Project C!',
      },
    });
    record('9. Non-member message to Project C rejected with 403 Forbidden', sendMsgCRes.status === 403, `Status: ${sendMsgCRes.status}`);

    // 9. Fetch messages for Project A and B via GET /communication/messages/project/:projectId
    const getMsgsARes = await request(`/communication/messages/project/${projAId}`, {
      method: 'GET',
      headers: userXHeaders,
    });
    const listA = Array.isArray(getMsgsARes.data) ? getMsgsARes.data : [];
    const fetchedMsgA = listA.find((m) => m.id === msgA?.id);
    const getMsgsAPass = fetchedMsgA && fetchedMsgA.projectRole === 'Mentor';
    record('10. GET messages for Project A dynamically returns projectRole "Mentor"', getMsgsAPass, `Role: ${fetchedMsgA?.projectRole}`);

    const getMsgsBRes = await request(`/communication/messages/project/${projBId}`, {
      method: 'GET',
      headers: userXHeaders,
    });
    const listB = Array.isArray(getMsgsBRes.data) ? getMsgsBRes.data : [];
    const fetchedMsgB = listB.find((m) => m.id === msgB?.id);
    const getMsgsBPass = fetchedMsgB && fetchedMsgB.projectRole === 'Collaborator';
    record('11. GET messages for Project B dynamically returns projectRole "Collaborator"', getMsgsBPass, `Role: ${fetchedMsgB?.projectRole}`);

    // 10. Check Former member behavior
    // Remove User X from Project B
    const removeRes = await request(`/projects/${projBId}/members/${userXId}`, {
      method: 'DELETE',
      headers: adminHeaders,
      body: { reason: 'Testing valid removal reason 12345' },
    });
    record('12. User X removed from Project B', removeRes.status === 200 || removeRes.status === 204, `Status: ${removeRes.status}`);

    // Removed user attempting to send message now gets 403
    const sendMsgBAfterRemove = await request('/communication/messages', {
      method: 'POST',
      headers: userXHeaders,
      body: {
        projectId: projBId,
        text: 'Trying to send message after being removed',
      },
    });
    record('13. Former member message rejected with 403 Forbidden', sendMsgBAfterRemove.status === 403, `Status: ${sendMsgBAfterRemove.status}`);

    // Messages in Project B now recomputed as Former member (no active role badge)
    const getMsgsBAfterRemove = await request(`/communication/messages/project/${projBId}`, {
      method: 'GET',
      headers: adminHeaders,
    });
    const listBAfter = Array.isArray(getMsgsBAfterRemove.data) ? getMsgsBAfterRemove.data : [];
    const fetchedMsgBAfter = listBAfter.find((m) => m.id === msgB?.id);
    const isFormerRole = fetchedMsgBAfter?.projectRole === 'Former member';
    record('14. Message in Project B dynamically reflects "Former member" (no active role)', isFormerRole, `projectRole: ${fetchedMsgBAfter?.projectRole}`);

    // Summary
    const total = results.length;
    const passed = results.filter((r) => r.pass).length;
    console.log(`\n========================================`);
    console.log(`PHASE 3 VERIFICATION SUMMARY: ${passed}/${total} checks PASSED`);
    console.log(`========================================\n`);

    if (passed !== total) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  }
}

run();
