const http = require('http');

function request(path, method = 'GET', headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch(e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log("--- Starting E2E Tests ---");

  // 1. Test Admin bypass
  console.log("\\n1. Testing /admin-test with x-user-role='Super User'");
  const res1 = await request('/admin-test', 'GET', { 'x-user-role': 'Super User' });
  console.log(res1.status, res1.data);

  // 2. Create Project
  console.log("\\n2. Creating a Project as User 1");
  const res2 = await request('/projects', 'POST', { 
    'x-user-role': 'Project Owner', 
    'x-user-id': '1' 
  }, {
    title: 'New API Test Project',
    description: 'Testing the API flow',
    difficulty: 'Easy',
    requiredSkills: ['Node.js'],
    duration: '1 Week'
  });
  console.log(res2.status, res2.data);

  // 3. Complete Task-2 (Assignee is User 2, XP reward is 100)
  console.log("\\n3. Completing Task-2");
  const res3 = await request('/tasks/task-2', 'PATCH', { 
    'x-user-role': 'Administrator' 
  }, {
    status: 'Completed'
  });
  console.log(res3.status, res3.data);

  // 4. Check Leaderboard
  console.log("\\n4. Checking Leaderboard to verify User 2 received 100 XP");
  const res4 = await request('/gamification/leaderboard', 'GET');
  console.log(res4.status);
  const user2Stats = res4.data.find(s => s.userId === '2');
  console.log("User 2 Stats:", user2Stats);

  console.log("\\n--- E2E Tests Finished ---");
}

runTests();
