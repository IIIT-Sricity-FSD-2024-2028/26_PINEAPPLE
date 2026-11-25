const http = require('http');

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`http://localhost:3000${path}`);
    const req = http.request(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(body);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function check() {
  const login = await new Promise((resolve, reject) => {
    const req = http.request(new URL('http://localhost:3000/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.write(JSON.stringify({ identifier: 'arjun.sharma@teamforge.io', password: 'password123' }));
    req.end();
  });

  const token = login.accessToken;
  const user = login.user;
  console.log('User from login:', {
    id: user.id,
    xp: user.xp,
    rep: user.rep,
    profileXp: user.profile?.xp,
    profileRep: user.profile?.rep,
    tasksCount: user.tasksCount,
    profileTasksCount: user.profile?.tasksCount,
  });

  const fetchedUser = await new Promise((resolve, reject) => {
    const req = http.request(new URL(`http://localhost:3000/users/${user.id}`), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.end();
  });

  console.log('Fetched user:', {
    id: fetchedUser.id,
    xp: fetchedUser.xp,
    rep: fetchedUser.rep,
    profileXp: fetchedUser.profile?.xp,
    profileRep: fetchedUser.profile?.rep,
    tasksCount: fetchedUser.tasksCount,
    profileTasksCount: fetchedUser.profile?.tasksCount,
    data: fetchedUser.data
  });
}

check().catch(console.error);
