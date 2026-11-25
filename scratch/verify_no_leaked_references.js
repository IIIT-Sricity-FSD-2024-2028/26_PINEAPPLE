const fs = require('fs');
const path = require('path');

const removedItems = [
  // Removed files
  'CollaboratorDashboard',
  'TagInput',
  'projectStatus',
  'analytics.controller',
  'analytics.service',
  'analytics.module',
  'broadcast.service',
  'broadcast.module',
  'app.service',
  'firebase-auth.guard',
  'validation.config',
  'swagger.config',
  'swagger-export.util',
  'hero.png',
  'react.svg',
  'vite.svg'
];

const ignoreDirs = ['node_modules', 'dist', '.git', 'scratch', 'team-submissions', 'submission-docs', '.firebase'];
const ignoreFiles = ['PROGRESS.md', 'README.md', 'docs/cleanup-log.md'];

function walk(dir, list = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoreDirs.includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, list);
    } else {
      list.push(full);
    }
  }
  return list;
}

const allFiles = walk('.');
let leaks = [];

for (const file of allFiles) {
  const normFile = file.replace(/\\/g, '/');
  if (ignoreFiles.some(f => normFile.endsWith(f))) continue;
  if (normFile.endsWith('.png') || normFile.endsWith('.jpg') || normFile.endsWith('.pdf')) continue;

  const content = fs.readFileSync(file, 'utf8');
  for (const item of removedItems) {
    if (content.includes(item)) {
      leaks.push({ file: normFile, item });
    }
  }
}

console.log('Leaks count:', leaks.length);
if (leaks.length > 0) {
  console.log('Leaks:', JSON.stringify(leaks, null, 2));
} else {
  console.log('ALL REMOVED FILES AND PATHS ARE CLEAN! ZERO LEAKED REFERENCES.');
}
