import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import fs from 'fs';
import path from 'path';

import MentorCard from '../components/features/MentorCard';
import MyMentorProfile from '../pages/mentor/MyMentorProfile';
import MentorsDirectory from '../pages/owner/MentorsDirectory';
import AdminReports from '../pages/admin/AdminReports';
import { renderWithStore } from './test-utils';

const { mockMentorMarketplaceApi, mockProjectsApi, mockReportsApi, mockAdminApi } = vi.hoisted(() => ({
  mockMentorMarketplaceApi: {
    myProfile: vi.fn(),
    getMyProfile: vi.fn(),
    createProfile: vi.fn(),
    updateProfile: vi.fn(),
    updateAvailability: vi.fn(),
    listMentors: vi.fn(),
    mySessions: vi.fn(),
    bookSession: vi.fn(),
    confirmPayment: vi.fn(),
    cancelPayment: vi.fn(),
  },
  mockProjectsApi: {
    list: vi.fn(),
    get: vi.fn(),
  },
  mockReportsApi: {
    getAdminReports: vi.fn(),
    getAppeals: vi.fn(),
    getAuditLogs: vi.fn(),
    getNeedsReviewSessions: vi.fn(),
  },
  mockAdminApi: {
    getDisputes: vi.fn(),
    decideDispute: vi.fn(),
    getEscrowSummary: vi.fn(),
    getNeedsReviewSessions: vi.fn(),
  },
}));

vi.mock('../services/mentorMarketplaceApi', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: {
      ...actual.default,
      ...mockMentorMarketplaceApi,
    },
    ...mockMentorMarketplaceApi,
    calculateEscrowBreakdown: actual.calculateEscrowBreakdown,
  };
});

vi.mock('../services/projectsApi', () => ({
  default: mockProjectsApi,
  ...mockProjectsApi,
}));

vi.mock('../services/reportsApi', () => ({
  default: mockReportsApi,
  ...mockReportsApi,
}));

vi.mock('../services/adminApi', () => ({
  default: mockAdminApi,
  ...mockAdminApi,
}));

vi.mock('../services/apiClient', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: {
      ...actual.default,
      get: vi.fn().mockResolvedValue({}),
      post: vi.fn().mockResolvedValue({}),
      patch: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
    apiRequest: vi.fn().mockResolvedValue([]),
  };
});

describe('Phase 4: Remove Mentor Session Duration, Availability Schedule, Booking Date/Time; Rename to Price', () => {
  const mentorUser = {
    id: '7',
    name: 'Neha Gupta',
    email: 'neha@example.com',
    avatar: '👧',
    role: 'Mentor',
    isMentorApproved: true,
  };

  const ownerUser = {
    id: 'owner-1',
    name: 'Project Owner',
    email: 'owner@example.com',
    role: 'Project Owner',
  };

  const adminUser = {
    id: 'admin-1',
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'Admin',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Mentor Profile Form & Preview: No Duration or Schedule, Labels say Price', () => {
    it('renders MyMentorProfile without Session Duration or Availability Schedule inputs and with Price (INR ₹) label', async () => {
      mockMentorMarketplaceApi.myProfile.mockResolvedValue({
        id: 'mp-1',
        userId: '7',
        name: 'Neha Gupta',
        title: 'Senior ML Engineer',
        bio: 'Machine learning mentorship and system design.',
        skills: ['Python', 'Machine Learning'],
        experienceYears: 5,
        sessionPrice: 1500,
        isAvailable: true,
        maxActiveMentees: 3,
      });

      renderWithStore(<MyMentorProfile />, {
        preloadedState: {
          session: {
            user: mentorUser,
            isAuthenticated: true,
            status: 'authenticated',
            activeRole: 'Mentor',
            allowedRoles: ['Mentor'],
            mentorApproved: true,
          },
        },
      });

      await waitFor(() => {
        expect(screen.getByDisplayValue('Neha Gupta')).toBeDefined();
      });

      // No Duration or Availability Schedule inputs
      expect(document.querySelector('input[name="sessionDuration"]')).toBeNull();
      expect(document.querySelector('select[name="sessionDuration"]')).toBeNull();
      expect(document.querySelector('input[name="availability"]')).toBeNull();
      expect(document.querySelector('select[name="availability"]')).toBeNull();

      // No Duration or Schedule labels in the form
      expect(screen.queryByText(/Session Duration/i)).toBeNull();
      expect(screen.queryByText(/Availability Schedule/i)).toBeNull();

      // Label says "Price (INR ₹)" and NOT "Session Price"
      expect(screen.getByText('Price (INR ₹)')).toBeDefined();
      expect(screen.queryByText('Session Price (INR ₹)')).toBeNull();

      // Preview card contains no "Schedule:"
      const previewCard = document.querySelector('.tf-mentor-preview-section');
      expect(previewCard).toBeDefined();
      expect(previewCard.textContent).not.toMatch(/Schedule:/i);
      expect(previewCard.textContent).toMatch(/Price \(INR\)/i);
    });

    it('renders shared MentorCard with Price (INR) label and without Schedule badge', () => {
      const { container } = renderWithStore(
        <MentorCard
          name="Kiran Bose"
          headline="Full-Stack Architect"
          bio="Distributed systems guidance."
          skills={['React', 'Node.js']}
          experienceYears={8}
          sessionPrice={2000}
          available={true}
        />
      );

      // Verify "Price (INR)" label exists
      expect(screen.getByText('Price (INR)')).toBeDefined();
      expect(screen.queryByText('Session Fee (INR)')).toBeNull();
      expect(screen.queryByText('Session Price (INR)')).toBeNull();

      // Verify no "Schedule:" meta tag exists
      expect(container.textContent).not.toMatch(/Schedule:/i);
    });
  });

  describe('2. Booking Form: No Date or Time Picker, Renamed Price Label', () => {
    it('renders MentorsDirectory booking modal with NO datetime-local input and with "Mentor Price"', async () => {
      mockMentorMarketplaceApi.listMentors.mockResolvedValue([
        {
          id: 'm-1',
          userId: 'mentor-1',
          name: 'Kiran Bose',
          title: 'Full-Stack Architect',
          bio: 'Architecture guidance',
          skills: ['Node.js', 'React'],
          experienceYears: 8,
          sessionPrice: 2000,
          isAvailable: true,
          maxActiveMentees: 3,
          activeMenteesCount: 1,
        },
      ]);
      mockProjectsApi.list.mockResolvedValue([
        {
          id: 'p-1',
          ownerId: 'owner-1',
          title: 'Quantum Portal',
          status: 'Open',
          dueDate: '2027-01-01T00:00:00.000Z',
          isCompleted: false,
        },
      ]);
      mockMentorMarketplaceApi.mySessions.mockResolvedValue([]);

      renderWithStore(<MentorsDirectory />, {
        preloadedState: {
          session: {
            user: ownerUser,
            isAuthenticated: true,
            status: 'authenticated',
            activeRole: 'Project Owner',
            allowedRoles: ['Project Owner'],
          },
        },
      });

      await waitFor(() => {
        expect(screen.getByText('Kiran Bose')).toBeDefined();
      });

      // Open booking modal
      fireEvent.click(screen.getByRole('button', { name: /Book with Escrow/i }));

      await waitFor(() => {
        expect(screen.getByText(/Mentorship Needs & Project Goals/i)).toBeDefined();
      });

      // Assert NO datetime-local or scheduledDate input exists
      expect(document.querySelector('input[type="datetime-local"]')).toBeNull();
      expect(document.querySelector('input[name="scheduledDate"]')).toBeNull();
      expect(screen.queryByText(/Session Date & Time/i)).toBeNull();

      // Assert breakdown says "Mentor Price" instead of "Mentor Session Fee"
      expect(screen.getByText('Mentor Price')).toBeDefined();
      expect(screen.queryByText('Mentor Session Fee')).toBeNull();
    });
  });

  describe('3. Admin Reports: Displays "Price" instead of "Session Price"', () => {
    it('renders dispute modal with Price label instead of Session Price', async () => {
      const mockDisputes = [
        {
          id: 'disp-1',
          sessionId: 'sess-1',
          openedByRole: 'student',
          reason: 'Mentor was unresponsive in chat.',
          status: 'open',
          createdAt: new Date().toISOString(),
          session: {
            id: 'sess-1',
            agreedPrice: 1500,
            totalAmount: 1755,
          },
        },
      ];

      mockReportsApi.getAdminReports.mockResolvedValue([]);
      mockReportsApi.getAppeals.mockResolvedValue([]);
      mockReportsApi.getAuditLogs.mockResolvedValue([]);
      mockReportsApi.getNeedsReviewSessions.mockResolvedValue([]);
      mockAdminApi.getDisputes.mockResolvedValue(mockDisputes);
      mockAdminApi.getNeedsReviewSessions.mockResolvedValue([]);

      renderWithStore(<AdminReports />, {
        preloadedState: {
          session: {
            user: adminUser,
            isAuthenticated: true,
            status: 'authenticated',
            portalRole: 'admin',
            permissions: ['*'],
          },
        },
      });

      await waitFor(() => {
        expect(screen.getByTestId('tab-disputes')).toBeDefined();
      });

      fireEvent.click(screen.getByTestId('tab-disputes'));

      await waitFor(() => {
        expect(screen.getByText('Mentor was unresponsive in chat.')).toBeDefined();
      });

      // Click "Decide" to open decision modal
      fireEvent.click(screen.getByTestId('decide-dispute-btn-disp-1'));

      await waitFor(() => {
        expect(screen.getByTestId('dispute-decision-modal')).toBeDefined();
      });

      const modalContent = screen.getByTestId('dispute-decision-modal').textContent;
      expect(modalContent).toMatch(/Price:\s*₹1500/i);
      expect(modalContent).not.toMatch(/Session Price:/i);
    });
  });

  describe('4. Static Codebase Scan: No sessionDuration, availabilitySchedule, or "Session Price" in src', () => {
    it('finds NO occurrences of sessionDuration, availabilitySchedule, or "Session Price" in src (outside tests)', () => {
      const srcDir = path.resolve(__dirname, '..');
      const violations = [];

      function scanDir(dir) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            // Skip test directory for the scan
            if (file === 'test') continue;
            scanDir(fullPath);
          } else if (/\.(js|jsx|ts|tsx)$/.test(file)) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const relPath = path.relative(srcDir, fullPath);

            if (/sessionDuration/i.test(content)) {
              violations.push(`${relPath}: Contains sessionDuration`);
            }
            if (/availabilitySchedule/i.test(content)) {
              violations.push(`${relPath}: Contains availabilitySchedule`);
            }
            if (/\bSession Price\b/i.test(content)) {
              violations.push(`${relPath}: Contains "Session Price"`);
            }
            if (/\bSession Fee\b/i.test(content)) {
              violations.push(`${relPath}: Contains "Session Fee"`);
            }
          }
        }
      }

      scanDir(srcDir);
      expect(violations).toEqual([]);
    });
  });
});
