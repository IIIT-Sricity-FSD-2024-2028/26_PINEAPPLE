const fs = require('fs');
const path = require('path');

// 1. Update back-end/.env.example
const backendEnvPath = path.resolve(__dirname, '../back-end/.env.example');
let backendEnv = fs.readFileSync(backendEnvPath, 'utf8');

if (!backendEnv.includes('PAYMENT_GATEWAY_PROVIDER')) {
  const envAdditions = `
# ─────────────────────────────────────────────────────────────
# Payment & Escrow Configuration (Mentor Marketplace)
# ─────────────────────────────────────────────────────────────
# Payment gateway provider: "demo_upi" (default) or "razorpay" / "stripe"
PAYMENT_GATEWAY_PROVIDER=demo_upi
DEMO_UPI_VPA=teamforge@demo
PAYMENT_HOLD_MINUTES=10

# ─────────────────────────────────────────────────────────────
# DigiLocker Credential Verification Configuration
# ─────────────────────────────────────────────────────────────
# DigiLocker mode: "sandbox" (default simulated mock) or "real" (production OAuth2)
DIGILOCKER_MODE=sandbox
DIGILOCKER_CLIENT_ID=demo_digilocker_client_id
DIGILOCKER_CLIENT_SECRET=demo_digilocker_client_secret
DIGILOCKER_REDIRECT_URI=http://localhost:3000/mentor-applications/digilocker/callback
`;
  backendEnv += envAdditions;
  fs.writeFileSync(backendEnvPath, backendEnv, 'utf8');
  console.log('Updated back-end/.env.example');
}

// 2. Update README.md
const readmePath = path.resolve(__dirname, '../README.md');

const updatedReadme = `# 🍍 TeamForge (26_PINEAPPLE)
> A comprehensive student and developer project collaboration platform with Role-Based Access Control (RBAC), verified mentorship, real-time gamification ledger, and escrow-backed milestone governance.

---

## 📌 Problem Statement & Overview
Students and emerging developers frequently struggle to find high-impact, real-world project collaboration opportunities to showcase verified experience. Traditional platforms either focus purely on static code hosting (e.g. GitHub) or text-based networking (e.g. LinkedIn), lacking structured milestone governance, fair contribution tracking, and verified mentorship.

**TeamForge** bridges this divide by providing:
1. **Multi-Role Workspaces:** Project Owners, Collaborators, Mentors, Administrators, and Super Users.
2. **Double-Entry Gamification Ledger:** Immutable XP & Reputation tracking directly computed from verified task completions.
3. **Escrow & Mentorship Marketplace:** Single active mentor guarantee per project, transparent escrow breakdown, and NPCI UPI QR payment simulation.
4. **Credential Verification:** Secure CV upload with \`%PDF-\` magic byte validation and simulated DigiLocker educational credential verification.

---

## 🔐 Authentication & Role-Based Access Control (RBAC)

TeamForge features a unified, pluggable authentication architecture supporting three distinct operational modes controlled via environment variables:

| Auth Mode | Back-End (\`AUTH_MODE\`) | Front-End (\`VITE_AUTH_MODE\`) | Verification Mechanism | Use Case |
| :--- | :--- | :--- | :--- | :--- |
| **\`firebase\`** | \`firebase\` | \`firebase\` | Firebase Admin SDK (\`verifyIdToken\`) with custom role claims | Production / Cloud Firebase & Local Firebase Emulator |
| **\`jwt\`** (Default) | \`jwt\` | \`jwt\` | HMAC-SHA256 verified access tokens + httpOnly refresh cookie | 100% Offline Local Development & Testing |
| **\`legacy\`** | \`legacy\` | \`legacy\` | Header-based identity fallback (\`x-user-id\`, \`x-user-role\`) | Legacy Backward-Compatibility / Fallback Mode |

### 🛡️ Complete Controller RBAC Matrix
The platform's 124 backend API routes are strictly protected by a unified \`AuthGuard\` and \`RolesGuard\` combination. Every endpoint, its required roles, and guard enforcement are cataloged in:
👉 **[docs/rbac-matrix.md](docs/rbac-matrix.md)**

### 🔄 Dynamic Role Switching
Users with multiple personas (e.g., Collaborator applying to be Mentor, or switching between Owner and Collaborator views) invoke \`POST /auth/switch-role\`. In JWT/Firebase mode, the backend re-issues or updates the authenticated token claim with the requested role after validating eligibility.

### 🛑 Platform Governance & Account Security
- **Suspension Enforcement:** Suspended or banned accounts receive immediate \`403 Forbidden\` responses, their active tokens are revoked, and client sessions are cleared.
- **Maintenance Mode:** Administrators can activate global maintenance (\`HTTP 503\`), gracefully exempting admins, health checks, and auth recovery endpoints.

---

## 🚀 Key Features by Implementation Phase

### 📅 Phase 3: Zero-Dependency Calendar DatePicker & Due Dates
- **Zero-Dependency Calendar:** Custom \`DatePicker.jsx\` with interactive month grid, previous/next navigation, keyboard accessibility, and outside-click dismiss.
- **Project Due Date Integrity:** Projects require a valid deadline at least tomorrow (\`>= tomorrow\`; \`HTTP 400\` on past or today dates).
- **Task Due Date Bounding:** Task due dates must fall between today and the project deadline (\`HTTP 400\` if out-of-range).
- **Dynamic Overdue Indicators:** Incomplete tasks past their deadline automatically render an overdue indicator (\`⚠️ Overdue\`) across workspaces.

### 🔍 Phase 4: Owner Applicant Profile Inspection
- **Secure Public Profile Endpoint:** \`GET /users/:id/public-profile\` grants read access strictly to self, platform admins, or project owners reviewing active applications.
- **Privacy Shield:** Sensitive applicant data (\`email\`, \`phone\`, warnings, moderation controls) is strictly redacted.
- **Rich Metric Showcase:** Displays applicant bio, university, member since date, ledger XP/Rep, completed project portfolio with live links, and contribution histories.

### 👥 Phase 5: Project Capacity & Collaborator Limit
- **Platform Clamping:** Project \`maxCollaborators\` is strictly clamped to the platform maximum (\`maxCollaboratorCapacity\`).
- **Capacity Counter:** Real-time capacity counter (e.g. \`1/1 full\`) and full badge indicators on marketplace and workspace cards.
- **Collision Protection:** Prevents over-subscription with \`HTTP 409 Conflict\` on application or approval attempts to full projects.
- **Cascading Rejection:** When the final collaborator slot is filled, remaining pending applications are automatically rejected with \`"Project is full"\` and applicant notifications are dispatched.

### 🏛️ Phase 6: Single Mentor per Project & Clean Escrow Ledger
- **Single Mentor Invariant:** A project can have at most one active or pending mentor session. Concurrent bookings are locked and rejected with \`HTTP 409 Conflict\`.
- **Automatic Startup Reconciliation:** System startup reconciliation identifies duplicate sessions, keeps the earliest confirmed session, and automatically refunds duplicates in full.
- **Double-Funding Guard:** Escrow service verifies existing funding records before creating any new ledger entry, preserving exact financial parity.

### 💳 Phase 7: Simulated UPI QR Payment Flow (Offline Demo)
- **Standard NPCI UPI Intent:** Generates authentic \`upi://pay\` URIs (\`pa=teamforge@demo\`) with 10-minute hold expiration.
- **Pure SVG Offline QR Generator:** Lightweight, zero-dependency SVG QR component (\`QRCodeSvg.jsx\`) rendering instantly without external CDNs or network calls.
- **Idempotent Confirmation:** Payment confirmation endpoint (\`POST /mentor-marketplace/sessions/:id/confirm-payment\`) moves session to \`escrow_funded\` and funds escrow exactly once; repeat requests return existing records without duplicate funding.
- **Hold Release:** Cancellation by the owner or automatic expiration releases the project hold immediately.

### 📄 Phase 8: Mentor CV Upload & DigiLocker Verification (Demo Sandbox)
- **Strict PDF Magic Byte Verification:** \`POST /uploads/cv\` accepts \`.pdf\` only (&le; 5MB) and inspects byte offset 0 for \`%PDF-\`. Renamed executables or non-PDF files are rejected with \`HTTP 400\` and erased from disk.
- **Secure File Storage:** Stored in \`secure-cvs/\` outside public web roots; served only to administrators and the applicant owner via authenticated \`GET /uploads/cv/:filename\`.
- **DigiLocker Sandbox Integration:** Pluggable integration with DigiLocker sandbox API. Simulates document retrieval and verifies holder names against the applicant, displaying green \`✓ Verified\` or amber \`⚠️ Name Mismatch\` badges.
- **Privacy Compliance:** Applicants or administrators can permanently erase uploaded CV files from disk and database records at any time.

---

## 👥 Seeded Demo Accounts & Credentials

| Persona | Email / Identifier | Password | Suggested Test Scenarios |
| :--- | :--- | :--- | :--- |
| **Super User** | \`superuser@teamforge.io\` | \`Super@123\` | Full system portal access, manage administrator permissions, system audit logs |
| **Administrator** | \`admin@teamforge.io\` | \`admin123\` | Review mentor applications (CV inspection, DigiLocker credentials, rejection with reason), dispute resolution |
| **Project Owner** | \`jathin@example.com\` | \`password123\` | Create projects with DatePicker deadlines, review applicant profiles, book mentor with UPI QR code |
| **Collaborator** | \`arjun.sharma@teamforge.io\` | \`password123\` | Apply to projects, complete tasks, apply for Mentor role (upload CV & connect DigiLocker sandbox) |
| **Mentor** | \`kiran.bose@teamforge.io\` | \`password123\` | Review mentor session requests, guide projects, award recommendation badges |

---

## 🛠️ Quick Start & Running Locally

### 1. Back-End Setup
\`\`\`bash
cd back-end
npm install

# Start in development mode (defaults to JWT mode offline)
npm run dev
\`\`\`

### 2. Front-End Setup
\`\`\`bash
cd React-Implementation/React-Implementation
npm install

# Start Vite development server
npm run dev
\`\`\`

### 3. Running Automated Test Suites
\`\`\`bash
cd back-end

# Phase 0: RBAC & Auth Security Matrix (20 checks)
npx ts-node test/rbac-security.spec.ts

# Phase 2: Gamification Ledger (10 checks)
npx ts-node test/phase2.spec.ts

# Phase 3: DatePicker & Due Dates (9 checks)
npx ts-node test/phase3.spec.ts

# Phase 4: Owner Public Profile Inspection (7 checks)
npx ts-node test/phase4.spec.ts

# Phase 5: Project Capacity & Collaborator Limit (9 checks)
npx ts-node test/phase5.spec.ts

# Phase 6: Single Mentor & Clean Escrow (12 checks)
npx ts-node test/phase6.spec.ts

# Phase 7: Demo UPI QR Payment & Escrow (10 checks)
npx ts-node test/phase7.spec.ts

# Phase 8: Mentor CV Upload & DigiLocker (14 checks)
npx ts-node test/phase8.spec.ts
\`\`\`
`;

fs.writeFileSync(readmePath, updatedReadme, 'utf8');
console.log('Successfully updated README.md');
