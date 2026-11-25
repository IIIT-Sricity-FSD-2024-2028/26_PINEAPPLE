const fs = require('fs');

// 1. users.repository.ts
{
  const file = 'back-end/src/users/users.repository.ts';
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('reset(): void')) {
    // Add reset method right before last brace
    const resetMethod = `
  reset(): void {
    if (process.env.NODE_ENV !== 'test' && !process.env.ALLOW_STORE_RESET) return;
    this.users = [];
    this.usersById.clear();
    this.usersByEmail.clear();
    this.usersByUsername.clear();
    this.initSeeds();
  }
`;
    // Rename constructor body into initSeeds
    const ctorTarget = '  constructor() {';
    const initSeedsDef = '  constructor() {\n    this.initSeeds();\n  }\n\n  private initSeeds(): void {';
    content = content.replace(ctorTarget, initSeedsDef);
    const lastBrace = content.lastIndexOf('}');
    content = content.slice(0, lastBrace) + resetMethod + '\n}\n';
    fs.writeFileSync(file, content, 'utf8');
    console.log('Updated users.repository.ts with reset()');
  }
}

// 2. projects.repository.ts
{
  const file = 'back-end/src/projects/projects.repository.ts';
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('reset(): void')) {
    const resetMethod = `
  reset(): void {
    if (process.env.NODE_ENV !== 'test' && !process.env.ALLOW_STORE_RESET) return;
    this.projects = [];
    this.projectsById.clear();
    this.projectsByOwnerId.clear();
    this.initSeeds();
  }
`;
    const ctorTarget = '  constructor() {';
    const initSeedsDef = '  constructor() {\n    this.initSeeds();\n  }\n\n  private initSeeds(): void {';
    content = content.replace(ctorTarget, initSeedsDef);
    const lastBrace = content.lastIndexOf('}');
    content = content.slice(0, lastBrace) + resetMethod + '\n}\n';
    fs.writeFileSync(file, content, 'utf8');
    console.log('Updated projects.repository.ts with reset()');
  }
}

// 3. tasks.repository.ts
{
  const file = 'back-end/src/tasks/tasks.repository.ts';
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('reset(): void')) {
    const resetMethod = `
  reset(): void {
    if (process.env.NODE_ENV !== 'test' && !process.env.ALLOW_STORE_RESET) return;
    this.tasks = [];
    this.tasksById.clear();
    this.tasksByProjectId.clear();
    this.initSeeds();
  }
`;
    const ctorTarget = '  constructor() {';
    const initSeedsDef = '  constructor() {\n    this.initSeeds();\n  }\n\n  private initSeeds(): void {';
    content = content.replace(ctorTarget, initSeedsDef);
    const lastBrace = content.lastIndexOf('}');
    content = content.slice(0, lastBrace) + resetMethod + '\n}\n';
    fs.writeFileSync(file, content, 'utf8');
    console.log('Updated tasks.repository.ts with reset()');
  }
}

// 4. gamification.repository.ts
{
  const file = 'back-end/src/gamification/gamification.repository.ts';
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('reset(): void')) {
    const resetMethod = `
  reset(): void {
    if (process.env.NODE_ENV !== 'test' && !process.env.ALLOW_STORE_RESET) return;
    this.ledgers = [];
    this.initSeeds();
  }
`;
    const ctorTarget = '  constructor() {';
    const initSeedsDef = '  constructor() {\n    this.initSeeds();\n  }\n\n  private initSeeds(): void {';
    content = content.replace(ctorTarget, initSeedsDef);
    const lastBrace = content.lastIndexOf('}');
    content = content.slice(0, lastBrace) + resetMethod + '\n}\n';
    fs.writeFileSync(file, content, 'utf8');
    console.log('Updated gamification.repository.ts with reset()');
  }
}

// 5. notifications.service.ts
{
  const file = 'back-end/src/notifications/notifications.service.ts';
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('reset(): void')) {
    const resetMethod = `
  reset(): void {
    if (process.env.NODE_ENV !== 'test' && !process.env.ALLOW_STORE_RESET) return;
    this.notifications = [];
    this.notificationsById.clear();
    this.notificationsByUserId.clear();
  }
`;
    const lastBrace = content.lastIndexOf('}');
    content = content.slice(0, lastBrace) + resetMethod + '\n}\n';
    fs.writeFileSync(file, content, 'utf8');
    console.log('Updated notifications.service.ts with reset()');
  }
}

// 6. audit.service.ts
{
  const file = 'back-end/src/audit/audit.service.ts';
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('reset(): void')) {
    const resetMethod = `
  reset(): void {
    if (process.env.NODE_ENV !== 'test' && !process.env.ALLOW_STORE_RESET) return;
    this.logs = [];
  }
`;
    const lastBrace = content.lastIndexOf('}');
    content = content.slice(0, lastBrace) + resetMethod + '\n}\n';
    fs.writeFileSync(file, content, 'utf8');
    console.log('Updated audit.service.ts with reset()');
  }
}
