import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

import MentorApplication from '../pages/mentor/MentorApplication.jsx';
import AdminMentorApps from '../pages/admin/AdminMentorApps.jsx';
import mentorApplicationsApi from '../services/mentorApplicationsApi.js';
import uploadsApi from '../services/uploadsApi.js';
import adminApi from '../services/adminApi.js';
import { AuthContext } from '../context/AuthContext';
import { RoleContext } from '../context/RoleContext';
import { UIProvider } from '../context/UIContext';
import { NotificationContext } from '../context/NotificationContext';

const { mockMentorAppsApi, mockUploadsApi } = vi.hoisted(() => {
  const mentorApps = {
    getMyStatus: vi.fn(),
    list: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
    getDigiLockerStatus: vi.fn().mockResolvedValue({ mode: 'sandbox', isSimulated: true }),
    pullDigiLockerDocuments: vi.fn(),
  };
  const uploads = {
    uploadCv: vi.fn(),
    downloadCv: vi.fn(),
  };
  return { mockMentorAppsApi: mentorApps, mockUploadsApi: uploads };
});

vi.mock('../services/adminApi', () => ({
  default: {
    getPublicConfig: vi.fn().mockResolvedValue({ minimumTenure: 5, mentorMinYearsExperience: 5 }),
    getAllUsers: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../services/mentorApplicationsApi', () => ({
  default: mockMentorAppsApi,
  mentorApplicationsApi: mockMentorAppsApi,
}));

vi.mock('../services/uploadsApi', () => ({
  default: mockUploadsApi,
  uploadsApi: mockUploadsApi,
}));

vi.mock('../services/usersApi', () => ({
  default: {
    getMe: vi.fn().mockResolvedValue({ id: '2', name: 'Arjun Sharma', email: 'arjun@teamforge.io' }),
    searchUsers: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../services/authApi', () => ({
  default: {
    getCurrentUser: vi.fn().mockReturnValue({ id: '2', name: 'Arjun Sharma', email: 'arjun@teamforge.io', role: 'admin' }),
  },
}));

function renderWithContexts(
  ui,
  {
    user = { id: '2', name: 'Arjun Sharma', email: 'arjun@teamforge.io', emailVerified: true },
    route = '/',
  } = {}
) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <UIProvider>
        <AuthContext.Provider
          value={{
            user,
            isAuthenticated: Boolean(user),
            loading: false,
            login: vi.fn(),
            logout: vi.fn(),
            updateUser: vi.fn(),
            setUser: vi.fn(),
            refreshUser: vi.fn().mockResolvedValue(user),
          }}
        >
          <RoleContext.Provider
            value={{
              currentRole: 'Collaborator',
              switchRole: vi.fn(),
              isMentorApproved: false,
              mentorAppStatus: 'none',
              refreshMentorStatus: vi.fn(),
            }}
          >
            <NotificationContext.Provider
              value={{
                notifications: [],
                unreadCount: 0,
                markAsRead: vi.fn(),
              }}
            >
              {ui}
            </NotificationContext.Provider>
          </RoleContext.Provider>
        </AuthContext.Provider>
      </UIProvider>
    </MemoryRouter>
  );
}

describe('Phase 5: Remove CV Delete Option (Mentor Application & Admin Portal)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminApi.getPublicConfig.mockResolvedValue({ minimumTenure: 5, mentorMinYearsExperience: 5 });
  });

  describe('1. Applicant Screen: View & Download Render, No Delete Controls', () => {
    it('renders Download CV button and NO delete control for pending application with stored CV', async () => {
      const mockApplication = {
        id: 'app-applicant-1',
        userId: '2',
        name: 'Arjun Sharma',
        email: 'arjun@teamforge.io',
        yearsOfExperience: 6,
        skills: ['React', 'Node.js'],
        status: 'pending',
        cvFileName: 'arjun-cv-secure.pdf',
        cvOriginalName: 'arjun-resume.pdf',
        cvFileSize: 1024 * 500,
        createdAt: '2026-06-01T10:00:00.000Z',
      };

      mockMentorAppsApi.getMyStatus.mockResolvedValue({
        status: 'pending',
        mentorUnlocked: false,
        application: mockApplication,
        allApplications: [mockApplication],
      });

      renderWithContexts(<MentorApplication />);

      await waitFor(() => {
        expect(screen.getByText(/Application Under Review/i)).toBeDefined();
      });

      // View / Download button MUST render
      expect(screen.getByRole('button', { name: /Download CV/i })).toBeDefined();

      // No delete control or confirmation button must render
      expect(screen.queryByRole('button', { name: /Delete Stored CV/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /Delete CV/i })).toBeNull();
      expect(screen.queryByText(/Delete Stored CV/i)).toBeNull();
      expect(screen.queryByText(/Delete CV/i)).toBeNull();
    });

    it('renders NO delete CV control for rejected application in cooldown', async () => {
      const mockRejectedApp = {
        id: 'app-rejected-1',
        userId: '2',
        name: 'Arjun Sharma',
        status: 'rejected',
        rejectionReason: 'Requires more years of hands-on mentoring.',
        cvFileName: 'arjun-cv-rejected.pdf',
        cvOriginalName: 'arjun-resume.pdf',
        cvFileSize: 1024 * 300,
        rejectedAt: '2026-06-01T10:00:00.000Z',
      };

      mockMentorAppsApi.getMyStatus.mockResolvedValue({
        status: 'rejected',
        mentorUnlocked: false,
        application: mockRejectedApp,
        allApplications: [mockRejectedApp],
        cooldown: { inCooldown: true, cooldownDays: 14, availableAt: '2026-06-15T10:00:00.000Z' },
      });

      renderWithContexts(<MentorApplication />);

      await waitFor(() => {
        expect(screen.getByText(/Application Not Approved/i)).toBeDefined();
      });

      // No delete button in rejected state
      expect(screen.queryByRole('button', { name: /Delete Stored CV for Privacy/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /Delete/i })).toBeNull();
      expect(screen.queryByText(/Delete Stored CV/i)).toBeNull();
    });
  });

  describe('2. Admin Screen: View & Download Renders, No Delete Controls', () => {
    it('renders View / Download CV button and NO Delete CV button in AdminMentorApps table', async () => {
      const mockApps = [
        {
          id: 'app-admin-1',
          userId: '3',
          name: 'Priya Nair',
          email: 'priya@teamforge.io',
          years: 7,
          yearsOfExperience: 7,
          skills: ['Python', 'Machine Learning'],
          status: 'pending',
          cvFileName: 'priya-cv.pdf',
          cvOriginalName: 'Priya_CV_2026.pdf',
          cvFileSize: 1024 * 400,
          createdAt: '2026-06-02T10:00:00.000Z',
        },
      ];

      mockMentorAppsApi.list.mockResolvedValue(mockApps);

      renderWithContexts(<AdminMentorApps />);

      await waitFor(() => {
        expect(screen.getByText(/Priya Nair/i)).toBeDefined();
      });

      // View / Download CV button MUST render
      expect(screen.getByRole('button', { name: /View \/ Download CV/i })).toBeDefined();

      // Delete CV (Privacy) button MUST NOT render
      expect(screen.queryByRole('button', { name: /Delete CV/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /Delete CV \(Privacy\)/i })).toBeNull();
      expect(screen.queryByText(/Delete CV/i)).toBeNull();
    });
  });

  describe('3. Mentor Application Form: Replacement Supported Without Delete Control', () => {
    it('allows replacing CV without rendering any delete button', async () => {
      mockMentorAppsApi.getMyStatus.mockResolvedValue({
        status: 'none',
        mentorUnlocked: false,
        application: null,
      });

      renderWithContexts(<MentorApplication />);

      await waitFor(() => {
        expect(screen.getByText(/Mentor Application & Status/i)).toBeDefined();
      });

      // In initial state, Choose PDF File button renders
      expect(screen.getByText(/Choose PDF File/i)).toBeDefined();

      // No delete or remove CV button renders
      expect(screen.queryByRole('button', { name: /Delete CV/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /Remove CV/i })).toBeNull();
      expect(screen.queryByText(/Delete CV/i)).toBeNull();
    });
  });

  describe('4. Static Code Scan Assertions', () => {
    it('confirms no CV delete API helpers exist on uploadsApi or mentorApplicationsApi', () => {
      expect(uploadsApi.deleteCv).toBeUndefined();
      expect(mentorApplicationsApi.deleteCv).toBeUndefined();
    });

    it('scans src/ to ensure no occurrences of deleteCv or DELETE /uploads/cv or DELETE /mentor-applications/:id/cv exist', () => {
      const srcDir = path.resolve(__dirname, '..');
      const filesToScan = [];

      function scan(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (entry.name !== 'node_modules' && entry.name !== 'test') {
              scan(fullPath);
            }
          } else if (entry.isFile() && /\.(jsx?|tsx?)$/.test(entry.name)) {
            filesToScan.push(fullPath);
          }
        }
      }

      scan(srcDir);
      expect(filesToScan.length).toBeGreaterThan(10);

      const forbiddenPatterns = [
        /\.deleteCv\b/,
        /deleteApplicationCv/,
        /deleteCvForApplication/,
        /['"`]\/uploads\/cv\/[^'"`]*['"`],\s*['"`]DELETE['"`]/i,
        /['"`]\/mentor-applications\/[^'"`]*\/cv['"`],\s*['"`]DELETE['"`]/i,
      ];

      for (const file of filesToScan) {
        const content = fs.readFileSync(file, 'utf8');
        for (const pattern of forbiddenPatterns) {
          expect({ file: path.basename(file), match: content.match(pattern) }).toEqual({
            file: path.basename(file),
            match: null,
          });
        }
      }
    });
  });
});
