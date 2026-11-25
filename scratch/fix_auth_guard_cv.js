const fs = require('fs');
const path = require('path');

// 1. Update auth.guard.ts
const authGuardPath = path.resolve(__dirname, '../back-end/src/auth/guards/auth.guard.ts');
let authGuard = fs.readFileSync(authGuardPath, 'utf8');

authGuard = authGuard.replace(
  "path.startsWith('/uploads') ||",
  "(path.startsWith('/uploads') && !path.startsWith('/uploads/cv')) ||"
);
fs.writeFileSync(authGuardPath, authGuard, 'utf8');
console.log('Updated auth.guard.ts');

// 2. Update roles.guard.ts
const rolesGuardPath = path.resolve(__dirname, '../back-end/src/core/guards/roles.guard.ts');
let rolesGuard = fs.readFileSync(rolesGuardPath, 'utf8');

rolesGuard = rolesGuard.replace(
  "path.startsWith('/uploads')",
  "(path.startsWith('/uploads') && !path.startsWith('/uploads/cv'))"
);
fs.writeFileSync(rolesGuardPath, rolesGuard, 'utf8');
console.log('Updated roles.guard.ts');
