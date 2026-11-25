const fs = require('fs');
const path = require('path');

const apiClientPath = path.resolve(__dirname, '../React-Implementation/React-Implementation/src/services/apiClient.js');
let content = fs.readFileSync(apiClientPath, 'utf8');

content = content.replace(/catch\s*\(_e\)\s*\{\s*\/\/\s*ignore non-json error response\s*\}/, 'catch {\n      // fallback to statusText\n    }');
fs.writeFileSync(apiClientPath, content, 'utf8');
console.log('Fixed catch clause in apiClient.js');
