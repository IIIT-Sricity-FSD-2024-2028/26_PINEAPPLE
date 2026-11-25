const fs = require('fs');

const u = fs.readFileSync('back-end/src/users/users.repository.ts', 'utf8');
const p = fs.readFileSync('back-end/src/projects/projects.repository.ts', 'utf8');
const t = fs.readFileSync('back-end/src/tasks/tasks.repository.ts', 'utf8');
const c = fs.readFileSync('back-end/src/communication/communication.repository.ts', 'utf8');
const n = fs.readFileSync('back-end/src/notifications/notifications.service.ts', 'utf8');
const a = fs.readFileSync('back-end/src/audit/audit.service.ts', 'utf8');
const mm = fs.readFileSync('back-end/src/mentor-marketplace/mentor-marketplace.service.ts', 'utf8');
const ms = fs.readFileSync('back-end/src/mentorship/mentorship.repository.ts', 'utf8');
const g = fs.readFileSync('back-end/src/gamification/gamification.repository.ts', 'utf8');

// In users.repository.ts, users are added via this.users.push({
const userMatches = u.match(/this\.users\.push\(\{/g) || [];

// In projects.repository.ts, projects are in this.projects = [ ... ]
const projectMatches = p.match(/id:\s*['"]proj-/g) || [];

// In tasks.repository.ts
const taskMatches = t.match(/id:\s*['"]task-/g) || [];

// In communication.repository.ts
const msgMatches = c.match(/id:\s*['"]msg-/g) || [];

// In notifications.service.ts:
const notifMatches = n.match(/id:\s*['"](?:notif-|[0-9]+)/g) || [];

// In audit.service.ts:
const auditMatches = a.match(/id:\s*['"]audit-/g) || [];

// In mentorship.repository.ts or mentor-marketplace.service.ts
const mentorAppMatches = ms.match(/id:\s*['"]mentor-app-/g) || [];
const sessionMatches = mm.match(/id:\s*['"]sess-/g) || [];

// In gamification.repository.ts: this.ledgers.push
const ledgerMatches = g.match(/id:\s*['"]ledg-/g) || [];

console.log(JSON.stringify({
  users: userMatches.length,
  projects: projectMatches.length,
  tasks: taskMatches.length,
  messages: msgMatches.length,
  notifications: notifMatches.length,
  auditEntries: auditMatches.length,
  sessions: sessionMatches.length,
  mentorApplications: mentorAppMatches.length,
  xpLedgerEntries: ledgerMatches.length
}, null, 2));
