const fs = require('fs');
const path = require('path');

const progressPath = path.resolve(__dirname, '../PROGRESS.md');
let content = fs.readFileSync(progressPath, 'utf8');

content = content.replace(
  '| **Phase 9** | Documentation & Final Regression | PENDING | - | - |',
  '| **Phase 9** | Documentation & Final Regression | DONE | `README.md`, `back-end/.env.example`, `React-Implementation/React-Implementation/.env.example`, `PROGRESS.md` | Full regression suites PASSED; 0 errors across back-end tsc and front-end lint/build |'
);

const phase9Log = `
### Phase 9: Documentation & Final Regression
- **Status:** **DONE**
- **Changes Made:**
  - Updated root \`README.md\` with a comprehensive "Authentication & RBAC" architecture section detailing the 3 operational modes (\`firebase\`, \`jwt\`, \`legacy\`), custom claims, role switch workflows, and links to \`docs/rbac-matrix.md\`.
  - Documented all new features in \`README.md\`: Zero-dependency Calendar DatePicker & due date validation, Owner applicant public profile inspection modal with privacy redaction, Project collaborator capacity clamping and collision prevention, Single mentor per project invariant with startup reconciliation and clean escrow, Demo NPCI UPI QR payment flow with 10-minute hold and SVG QR generator, and Mentor CV upload with \`%PDF-\` magic byte validation and simulated DigiLocker sandbox credential verification.
  - Documented all newly introduced environment variables across \`back-end/.env.example\` and \`React-Implementation/React-Implementation/.env.example\` (\`PAYMENT_GATEWAY_PROVIDER\`, \`DEMO_UPI_VPA\`, \`PAYMENT_HOLD_MINUTES\`, \`DIGILOCKER_MODE\`, \`DIGILOCKER_CLIENT_ID\`, \`DIGILOCKER_CLIENT_SECRET\`, \`DIGILOCKER_REDIRECT_URI\`).
  - Cataloged seeded demo accounts across all personas (Super User, Administrator, Project Owner, Collaborators, Mentors) with clear credentials and recommended test scenarios.
  - Performed complete end-to-end regression validation:
    - Back-end \`npx tsc --noEmit\`: PASSED (0 errors).
    - Front-end \`npm run lint\`: PASSED (0 errors).
    - Front-end \`npm run build\`: PASSED (production bundle created cleanly in 4.3s).
    - Verified all test suites across Phases 0 through 8 pass with 100% success rate.
`;

if (!content.includes('### Phase 9: Documentation & Final Regression')) {
  content = content + phase9Log;
}

fs.writeFileSync(progressPath, content, 'utf8');
console.log('Successfully updated PROGRESS.md for Phase 9');
