const fs = require('fs');
const path = require('path');

const candidates = [
  'back-end/serviceAccountKey.json',
  'serviceAccountKey.json',
];

candidates.forEach(c => {
  console.log(`Path: ${c}, exists: ${fs.existsSync(c)}`);
});
