const fs = require('fs');
const path = require('path');

function searchFiles(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const f of files) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) searchFiles(full);
    else if (f.name.endsWith('.controller.ts')) {
      const content = fs.readFileSync(full, 'utf8');
      const baseMatch = content.match(/@Controller\(['"]([^'"]*)['"]\)/);
      const base = baseMatch ? baseMatch[1] : '';
      const methodMatches = [...content.matchAll(/@(Get|Post|Put|Patch|Delete)\(['"]?([^'"]*)['"]?\)/g)];
      methodMatches.forEach(m => {
        const fullRoute = '/' + [base, m[2]].filter(Boolean).join('/').replace(/\/+/g, '/');
        console.log(m[1].toUpperCase().padEnd(6) + ' ' + fullRoute + ' (' + path.basename(full) + ')');
      });
    }
  }
}
searchFiles('back-end/src');
