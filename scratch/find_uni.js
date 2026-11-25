const fs = require('fs');
const path = require('path');

function searchDir(dir, pattern) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    if (f === 'node_modules' || f === 'dist' || f === '.git') continue;
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      searchDir(full, pattern);
    } else if (f.endsWith('.jsx') || f.endsWith('.js')) {
      const content = fs.readFileSync(full, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (pattern.test(line)) {
          console.log(`${full}:${idx + 1}: ${line.trim()}`);
        }
      });
    }
  }
}

searchDir('React-Implementation/React-Implementation/src', /university|uni/i);
