const fs = require('fs');
const path = require('path');

const p2Path = path.resolve(__dirname, '../back-end/test/phase2.spec.ts');
let p2 = fs.readFileSync(p2Path, 'utf8');

p2 = p2.replace(
  "priority: 'High',",
  "priority: 'High',\n        dueDate: '2026-11-15',"
);

fs.writeFileSync(p2Path, p2, 'utf8');
console.log('Added dueDate to phase2.spec.ts task creation');
