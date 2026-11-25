const fs = require('fs');
const path = require('path');

const targetRoutes = [
  '/mentors',
  '/mentor-application',
  '/mentored-projects',
  '/mentor-requests',
  '/mentor-earnings',
  '/mentor-profile'
];

const ignoreDirs = ['node_modules', 'dist', '.git', 'team-submissions', 'submission-docs', '.firebase'];

function walk(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (ignoreDirs.includes(file)) continue;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath, fileList);
    } else {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const allFiles = walk('.');
const matches = [];

for (const filePath of allFiles) {
  if (filePath.includes('node_modules') || filePath.includes('dist') || filePath.endsWith('.png') || filePath.endsWith('.jpg') || filePath.endsWith('.pdf')) continue;
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      for (const route of targetRoutes) {
        // match exact route in quotes or backticks, or regex
        const regexes = [
          new RegExp(`['"\`]${route}['"\`]`),
          new RegExp(`['"\`]${route}/`),
          new RegExp(`href=['"]${route}['"]`),
          new RegExp(`to=['"]${route}['"]`),
          new RegExp(`navigate\\(['"\`]${route}`),
          new RegExp(`path=['"]${route}['"]`)
        ];
        if (regexes.some(r => r.test(line))) {
          matches.push({
            file: filePath,
            line: idx + 1,
            route,
            content: line.trim()
          });
        }
      }
    });
  } catch (err) {}
}

console.log(JSON.stringify(matches, null, 2));
