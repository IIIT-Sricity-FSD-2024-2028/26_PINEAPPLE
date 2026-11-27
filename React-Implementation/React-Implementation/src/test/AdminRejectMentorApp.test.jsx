import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithStore } from './test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import AdminMentorApps from '../pages/admin/AdminMentorApps';
import mentorApplicationsApi from '../services/mentorApplicationsApi';
import feedbackApi from '../services/feedbackApi';
import adminApi from '../services/adminApi';

describe('Admin Mentor Applications Rejection & Guard Tests', () => {
  const customReasonsConfig = {
    ADMIN_REJECT_MENTOR_APP: {
      actionType: 'ADMIN_REJECT_MENTOR_APP',
      title: 'Reject Mentor Application',
      description: 'Select reasons for rejecting this mentor application.',
      confirmLabel: 'Confirm Rejection',
      minReasons: 1,
      explanationRequired: false,
      reasons: [
        { id: 'CUSTOM_REASON_A', label: 'Custom Label For Experience Mismatch' },
        { id: 'CUSTOM_REASON_B', label: 'Custom Label For Insufficient Portfolio' },
        { id: 'CUSTOM_REASON_C', label: 'Custom Label For Unverifiable Identity' },
      ],
    },
  };

  const samplePendingApp = {
    id: 'app-999',
    userId: 'user-999',
    name: 'Ananya Roy',
    email: 'ananya@example.com',
    university: 'IIT Bombay',
    submittedAt: '2026-05-10T10:00:00.000Z',
    expertise: ['Cloud Architecture', 'React'],
    years: 5,
    experience: '5 years leading infrastructure',
    motivation: 'Excited to guide students',
    status: 'pending',
    verifiedCount: 1,
    unverifiedCount: 0,
    totalCredentials: 1,
    certificates: [
      { id: 'cert-1', docType: 'DEGREE', title: 'M.Tech', status: 'verified', verificationStatus: 'verified' },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(adminApi, 'getPublicConfig').mockResolvedValue({ mentorMinYearsExperience: 4 });
    vi.spyOn(feedbackApi, 'getFeedbackReasons').mockResolvedValue(customReasonsConfig);
  });

  it('renders dynamic reason options from GET /feedback/reasons, sends server IDs, closes modal and updates card', async () => {
    let appStatus = 'pending';
    let appRejectionReason = undefined;

    vi.spyOn(mentorApplicationsApi, 'list').mockImplementation(async () => [
      {
        ...samplePendingApp,
        status: appStatus,
        rejectionReason: appRejectionReason,
      },
    ]);

    vi.spyOn(mentorApplicationsApi, 'reject').mockImplementation(async (id, payload) => {
      appStatus = 'rejected';
      appRejectionReason = payload?.reason || payload?.reasons?.join(', ');
      return {
        ...samplePendingApp,
        status: 'rejected',
        rejectionReason: appRejectionReason,
      };
    });

    renderWithStore(<AdminMentorApps />);

    // 1. Initial pending application card renders
    expect(await screen.findByText('Ananya Roy')).toBeDefined();
    expect(screen.getByText('Reject Application')).toBeDefined();

    // 2. Open Reject Modal
    fireEvent.click(screen.getByText('Reject Application'));

    // 3. Proves the modal renders options returned by GET /feedback/reasons (custom labels)
    expect(await screen.findByText('Custom Label For Experience Mismatch')).toBeDefined();
    expect(screen.getByText('Custom Label For Insufficient Portfolio')).toBeDefined();
    expect(screen.getByText('Custom Label For Unverifiable Identity')).toBeDefined();

    // 4. Select custom reason chip
    const customChip = screen.getByTestId('reason-chip-CUSTOM_REASON_A');
    fireEvent.click(customChip);

    // 5. Add optional explanation note
    const textarea = screen.getByTestId('universal-reason-textarea');
    fireEvent.change(textarea, { target: { value: 'Applicant does not match specialized domain criteria.' } });

    // 6. Confirm rejection
    const confirmBtn = screen.getByTestId('universal-reason-confirm-btn');
    fireEvent.click(confirmBtn);

    // 7. Verify confirming sends the IDs returned by the server
    await waitFor(() => {
      expect(mentorApplicationsApi.reject).toHaveBeenCalledWith(
        'app-999',
        expect.objectContaining({
          reasons: ['CUSTOM_REASON_A'],
          explanation: 'Applicant does not match specialized domain criteria.',
        }),
      );
    });

    // 8. Modal closes upon successful rejection
    await waitFor(() => {
      expect(screen.queryByTestId('universal-reason-modal')).toBeNull();
    });

    // Switch tab to "rejected" to view the updated rejected card
    const rejectedTab = screen.getByText('Rejected');
    fireEvent.click(rejectedTab);

    // 9. Card is marked as rejected and shows rejection feedback
    expect(await screen.findByText(/Rejection Reason:/i)).toBeDefined();
    expect(screen.getByText(/Applicant does not match specialized domain criteria/i)).toBeDefined();
  });

  it('guard test: ensures no component code in frontend contains literal reason IDs', () => {
    function walk(dir) {
      let files = [];
      if (!fs.existsSync(dir)) return files;
      for (const item of fs.readdirSync(dir)) {
        const full = path.join(dir, item);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          if (item !== 'node_modules' && item !== 'test') {
            files = files.concat(walk(full));
          }
        } else if (full.endsWith('.jsx') || full.endsWith('.js')) {
          if (!full.includes('feedbackApi.js')) {
            files.push(full);
          }
        }
      }
      return files;
    }

    const srcDir = path.resolve(__dirname, '..');
    const componentFiles = walk(srcDir);
    expect(componentFiles.length).toBeGreaterThan(0);

    // Read backend reason config to get all reason IDs
    let reasonConfigPath = path.resolve(__dirname, '../../../../back-end/src/feedback/reason-config.ts');
    if (!fs.existsSync(reasonConfigPath)) {
      reasonConfigPath = path.resolve(process.cwd(), 'back-end/src/feedback/reason-config.ts');
    }
    expect(fs.existsSync(reasonConfigPath)).toBe(true);

    const reasonConfigContent = fs.readFileSync(reasonConfigPath, 'utf8');
    const idMatches = reasonConfigContent.match(/id:\s*['"]([A-Z_]+)['"]/g) || [];
    const reasonIds = [...new Set(idMatches.map((m) => m.match(/['"]([A-Z_]+)['"]/)[1]))];

    expect(reasonIds.length).toBeGreaterThan(0);

    const violations = [];

    for (const file of componentFiles) {
      const content = fs.readFileSync(file, 'utf8');
      for (const id of reasonIds) {
        if (id === 'OTHER') {
          // Look for literal 'OTHER' or "OTHER"
          if (content.includes("'OTHER'") || content.includes('"OTHER"')) {
            violations.push({ file: path.basename(file), id });
          }
        } else {
          if (content.includes(id)) {
            violations.push({ file: path.basename(file), id });
          }
        }
      }
    }

    if (violations.length > 0) {
      const details = violations.map((v) => `${v.file}: ${v.id}`).join('\n');
      expect.fail(`Literal reason IDs found in frontend component code:\n${details}`);
    }

    expect(violations.length).toBe(0);
  });
});
