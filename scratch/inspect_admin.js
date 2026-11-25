const fs = require('fs');
const content = fs.readFileSync('back-end/src/admin/admin.service.ts', 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes('login(')) console.log(`admin.service.ts:${i+1}: ${l}`);
});
