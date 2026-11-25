const fs = require('fs');
const path = require('path');

const searchTerms = [
  '/mentor-application',
  'mentor-application',
  '/mentored-projects',
  'mentored-projects',
  '/mentor-requests',
  'mentor-requests',
  '/mentor-earnings',
  'mentor-earnings',
  '/mentor-profile',
  'mentor-profile',
  '/mentors',
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
const results = [];

for (const filePath of allFiles) {
  // Only check text files
  if (filePath.endsWith('.png') || filePath.endsWith('.jpg') || filePath.endsWith('.pdf') || filePath.endsWith('.mp4') || filePath.endsWith('.svg') || filePath.endsWith('.ico')) continue;
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      for (const term of searchTerms) {
        if (line.includes(term)) {
          // If term is '/mentors', make sure it's not '/owner/mentors' or something like 'mentors'
          if (term === '/mentors' && line.includes('/owner/mentors') && !line.match(/(?<!\/owner)\/mentors\b/)) {
            continue;
          }
          results.push({
            file: filePath,
            line: idx + 1,
            term,
            content: line.trim()
          });
        }
      }
    });
  } catch (err) {
    // ignore binary
  }
}

console.log(JSON.stringify(results, null, 2));
