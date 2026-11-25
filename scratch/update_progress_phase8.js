const fs = require('fs');
const path = require('path');

const progressPath = path.resolve(__dirname, '../PROGRESS.md');
let content = fs.readFileSync(progressPath, 'utf8');

// Update Table row
content = content.replace(
  '| **Phase 8** | Mentor CV Upload & DigiLocker Verification | PENDING | - | - |',
  '| **Phase 8** | Mentor CV Upload & DigiLocker Verification | DONE | `file-upload.middleware.ts`, `uploads.controller.ts`, `mentor-applications.controller.ts`, `mentor-applications.service.ts`, `digilocker-sandbox.provider.ts`, `digilocker-real.provider.ts`, `mentorApplicationsApi.js`, `uploadsApi.js`, `apiClient.js`, `MentorApplication.jsx`, `mentorApplication.css`, `AdminMentorApps.jsx`, `AdminMentorApps.css`, `phase8.spec.ts` | 14 / 14 Live Integration Checks PASSED; Build 0 errors |'
);

const phase8Log = `
### Phase 8: Mentor CV Upload & DigiLocker Verification
- **Status:** **DONE**
- **Changes Made:**
  - Configured secure CV storage directory (\`secure-cvs/\`) located strictly outside the public web root.
  - Implemented \`POST /uploads/cv\` endpoint accepting \`.pdf\` files only (max 5MB) and rigorously verifying \`%PDF-\` magic byte signatures at byte offset 0. Non-PDFs or renamed executable/binary files are rejected with HTTP 400 and immediately unlinked from disk.
  - Implemented authorized CV download endpoint (\`GET /uploads/cv/:filename\`), verifying identity and strictly restricting access to platform administrators or the application's applicant owner (HTTP 403 Forbidden for unauthorized callers).
  - Implemented privacy-compliant CV deletion endpoints (\`DELETE /uploads/cv/:filename\` and \`DELETE /mentor-applications/:id/cv\`), physically erasing the file from disk and clearing the entity record.
  - Built DigiLocker provider architecture with pluggable \`DigiLockerSandboxProvider\` and \`DigiLockerRealProvider\` (configurable via \`DIGILOCKER_MODE\` environment variable).
  - Added DigiLocker status and document retrieval endpoints (\`GET /mentor-applications/digilocker/status\` and \`POST /mentor-applications/digilocker/pull-documents\`) that perform case-insensitive name matching against applicant name, marking matching credentials with \`verified\` and mismatched credentials with \`mismatch\`.
  - Enforced mentor application validation on the backend: applications strictly require a valid CV upload AND at least one verified DigiLocker document; applications with only mismatched or missing certificates are rejected with HTTP 400.
  - Extended admin rejection workflow: administrators can supply a custom rejection reason (\`PUT /mentor-applications/:id/reject\`), which is recorded on the application entity and triggers an applicant notification.
  - Built frontend CV file picker in \`MentorApplication.jsx\` with client-side \`.pdf\` extension and 5MB size validation, upload spinner, file info preview pill (formatted size), and "Remove CV" action.
  - Built frontend DigiLocker integration in \`MentorApplication.jsx\` with clear "Simulated DigiLocker (demo)" banner, "Connect DigiLocker (Demo)" button, and credential cards with green \`✓ Verified\` and amber \`⚠️ Name Mismatch\` badges.
  - Updated applicant status view in \`MentorApplication.jsx\` displaying submitted CV with download and privacy deletion actions, DigiLocker credentials, and admin rejection reasons.
  - Updated \`AdminMentorApps.jsx\` with prominent DigiLocker Sandbox active banner, CV document inspection with view/download and privacy deletion buttons, DigiLocker credential card grid, and interactive Rejection Reason modal.
  - Verified with automated 14-check integration test suite (\`back-end/test/phase8.spec.ts\`): 14/14 passed (non-PDF rejection, %PDF- magic byte verification, physical secure directory storage, sandbox status, name matching, missing CV rejection, missing verified credential rejection, valid application creation, applicant download authorization, admin download authorization, unauthorized user 403 block, admin rejection with reason, disk privacy deletion).
`;

if (!content.includes('### Phase 8: Mentor CV Upload & DigiLocker Verification')) {
  content = content + phase8Log;
}

fs.writeFileSync(progressPath, content, 'utf8');
console.log('Successfully updated PROGRESS.md for Phase 8');
