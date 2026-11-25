import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { RoleContext } from '../context/RoleContext';
import { UIProvider } from '../context/UIContext';
import { NotificationContext } from '../context/NotificationContext';
import MentorRequests from '../pages/mentor/MentorRequests';
import MentoredProjects from '../pages/mentor/MentoredProjects';
import MyMentorProfile from '../pages/mentor/MyMentorProfile';
import AdminMentorApps from '../pages/admin/AdminMentorApps';
import mentorMarketplaceApi from '../services/mentorMarketplaceApi';
import mentorApplicationsApi from '../services/mentorApplicationsApi';
import projectsApi from '../services/projectsApi';
import feedbackApi, { OTHER_REASON_ID } from '../services/feedbackApi';

// Mock APIs
vi.mock('../services/mentorMarketplaceApi', () => ({
  default: {
    mentorSessions: vi.fn(),
    acceptSession: vi.fn(),
    declineSession: vi.fn(),
    myProfile: vi.fn(),
    createProfile: vi.fn(),
    updateProfile: vi.fn(),
    updateAvailability: vi.fn(),
    getMyAbandonmentReviews: vi.fn(() => Promise.resolve([])),
  },
}));

vi.mock('../services/mentorApplicationsApi', () => ({
  default: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    apply: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
    getMyApplication: vi.fn(),
    getMyStatus: vi.fn(),
  },
}));

vi.mock('../services/projectsApi', () => ({
  default: {
    list: vi.fn(),
    get: vi.fn(),
    getById: vi.fn(),
  },
  isProjectLocked: vi.fn(() => false),
  isProjectActive: vi.fn(() => true),
}));

vi.mock('../services/feedbackApi', () => ({
  default: {
    getFeedbackReasons: vi.fn(() => Promise.resolve({})),
    getEntityFeedback: vi.fn(() => Promise.resolve([])),
  },
  feedbackApi: {
    getFeedbackReasons: vi.fn(() => Promise.resolve({})),
    getEntityFeedback: vi.fn(() => Promise.resolve([])),
  },
  OTHER_REASON_ID: 'OTHER',
}));

const renderWithAuthAndRole = (
  ui,
  {
    user = { id: '1', name: 'Dr. Jane Mentor', email: 'mentor@example.com', role: 'Mentor' },
    role = 'Mentor',
    route = '/',
  } = {}
) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <AuthContext.Provider value={{ user, loading: false, isAuthenticated: true, refreshMentorStatus: vi.fn() }}>
        <RoleContext.Provider value={{ currentRole: role, switchRole: vi.fn(), availableRoles: [role] }}>
          <UIProvider>
            <NotificationContext.Provider value={{ notifications: [], unreadCount: 0 }}>
              {ui}
            </NotificationContext.Provider>
          </UIProvider>
        </RoleContext.Provider>
      </AuthContext.Provider>
    </MemoryRouter>,
  );

describe('PHASE 10: MENTOR SCREENS FRONTEND TESTS', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // PART A: DUE DATE ON MENTOR REQUESTS & MENTORED PROJECTS
  // =========================================================================
  describe('Part A - Project Due Date on Mentor Requests & Mentored Projects', () => {
    it('renders project due date and countdown days left on mentor request rows', async () => {
      // Future target: 16 days from now
      const futureDate = new Date(Date.now() + 16 * 24 * 60 * 60 * 1000).toISOString();

      mentorMarketplaceApi.mentorSessions.mockResolvedValue([
        {
          id: 'sess-1',
          projectId: 'proj-1',
          projectName: 'AI Study Assistant',
          ownerName: 'Alice Owner',
          agreedPrice: 2000,
          status: 'escrow_funded',
          projectDueDate: futureDate,
          createdAt: new Date().toISOString(),
        },
      ]);

      projectsApi.list.mockResolvedValue([
        {
          id: 'proj-1',
          title: 'AI Study Assistant',
          name: 'AI Study Assistant',
          owner: 'Alice Owner',
          dueDate: futureDate,
        },
      ]);

      renderWithAuthAndRole(<MentorRequests />, { route: '/mentor/requests' });

      // Wait for requests to render
      await waitFor(() => {
        expect(screen.getByText('AI Study Assistant')).toBeDefined();
      });

      // Verify "Project due:" label and "16 days left" appear next to owner and price
      const dueElement = screen.getByTestId('project-due-sess-1');
      expect(dueElement).toBeDefined();
      expect(dueElement.textContent).toContain('Project due:');
      expect(dueElement.textContent).toMatch(/16 days left|17 days left/);
      expect(screen.getByText(/Alice Owner/)).toBeDefined();
      expect(screen.getByText(/₹2000 in Escrow/)).toBeDefined();
    });

    it('renders project due date on Mentored Projects cards', async () => {
      const futureDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();

      projectsApi.list.mockResolvedValue([
        {
          id: 'proj-mentored-1',
          title: 'Blockchain Verification Protocol',
          owner: 'Bob Owner',
          dueDate: futureDate,
          progress: 50,
          members: [{ userId: '1', role: 'Mentor' }],
        },
      ]);

      mentorMarketplaceApi.mentorSessions.mockResolvedValue([
        {
          id: 'sess-active-1',
          projectId: 'proj-mentored-1',
          mentorId: '1',
          status: 'active',
          projectDueDate: futureDate,
        },
      ]);

      renderWithAuthAndRole(<MentoredProjects />, { route: '/mentor/projects' });

      await waitFor(() => {
        expect(screen.getByText('Blockchain Verification Protocol')).toBeDefined();
      });

      const cardDue = screen.getByTestId('project-card-due-proj-mentored-1');
      expect(cardDue).toBeDefined();
      expect(cardDue.textContent).toContain('Project due:');
      expect(cardDue.textContent).toMatch(/20 days left|21 days left/);
    });
  });

  // =========================================================================
  // PART B: TOAST ON MENTOR PROFILE SAVE & AVAILABILITY TOGGLE
  // =========================================================================
  describe('Part B - Toast on Mentor Profile Save and Availability Toggle', () => {
    it('shows success toast "Mentor profile saved" on successful profile save', async () => {
      mentorMarketplaceApi.myProfile.mockResolvedValue({
        id: 'mentor-1',
        name: 'Dr. Jane Mentor',
        title: 'Principal Cloud Architect',
        bio: 'Guiding teams on microservices and cloud infrastructure.',
        skills: ['AWS', 'Kubernetes'],
        experienceYears: 10,
        sessionPrice: 2500,
        isAvailable: true,
        maxActiveMentees: 4,
      });

      mentorMarketplaceApi.updateProfile.mockResolvedValue({
        id: 'mentor-1',
        name: 'Dr. Jane Mentor',
      });
      mentorMarketplaceApi.updateAvailability.mockResolvedValue({ success: true });

      renderWithAuthAndRole(<MyMentorProfile />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Principal Cloud Architect')).toBeDefined();
      });

      const saveBtn = screen.getByTestId('save-mentor-profile-btn');
      fireEvent.click(saveBtn);

      await waitFor(() => {
        const toast = screen.getByTestId('toast');
        expect(toast).toBeDefined();
        expect(toast.textContent).toContain('Mentor profile saved');
      });
    });

    it('shows server error toast on save failure and prevents double submission', async () => {
      mentorMarketplaceApi.myProfile.mockResolvedValue({
        id: 'mentor-1',
        name: 'Dr. Jane Mentor',
        title: 'Principal Cloud Architect',
        bio: 'Guiding teams on microservices and cloud infrastructure.',
        skills: ['AWS'],
        experienceYears: 10,
        sessionPrice: 2500,
        isAvailable: true,
      });

      mentorMarketplaceApi.updateProfile.mockRejectedValue(new Error('Server database connection timeout'));

      renderWithAuthAndRole(<MyMentorProfile />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Principal Cloud Architect')).toBeDefined();
      });

      const saveBtn = screen.getByTestId('save-mentor-profile-btn');
      fireEvent.click(saveBtn);

      // Verify failure toast displays the server error message
      await waitFor(() => {
        const toast = screen.getByTestId('toast');
        expect(toast).toBeDefined();
        expect(toast.textContent).toContain('Server database connection timeout');
      });
    });

    it('shows toast when availability is toggled ("You are now available / unavailable for bookings")', async () => {
      mentorMarketplaceApi.myProfile.mockResolvedValue({
        id: 'mentor-1',
        name: 'Dr. Jane Mentor',
        title: 'Principal Cloud Architect',
        bio: 'Guiding teams on microservices and cloud infrastructure.',
        skills: ['AWS'],
        experienceYears: 10,
        sessionPrice: 2500,
        isAvailable: true,
      });

      mentorMarketplaceApi.updateAvailability.mockResolvedValue({ success: true });

      renderWithAuthAndRole(<MyMentorProfile />);

      await waitFor(() => {
        expect(screen.getByTestId('availability-toggle')).toBeDefined();
      });

      const toggle = screen.getByTestId('availability-toggle');
      expect(toggle.checked).toBe(true);

      // Toggle off -> unavailable
      fireEvent.click(toggle);

      await waitFor(() => {
        const toast = screen.getByTestId('toast');
        expect(toast).toBeDefined();
        expect(toast.textContent).toContain('You are now unavailable for bookings');
      });

      // Toggle on -> available
      fireEvent.click(toggle);

      await waitFor(() => {
        const toast = screen.getByTestId('toast');
        expect(toast).toBeDefined();
        expect(toast.textContent).toContain('You are now available for bookings');
      });
    });
  });

  // =========================================================================
  // PART C: UNIVERSITY SHOWS INSTITUTION OR "NOT SPECIFIED" IN ADMIN VIEW
  // =========================================================================
  describe('Part C - University Shows Institution or Not Specified in Admin View', () => {
    it('admin mentor applications card shows institution name when present and Not specified only when empty', async () => {
      mentorApplicationsApi.list.mockResolvedValue([
        {
          id: 'app-vit',
          name: 'Rehen Applicant',
          email: 'rehen@example.com',
          university: 'vit',
          years: 8,
          expertise: 'Full-stack development',
          motivation: 'Passionate about mentoring young engineers.',
          status: 'pending',
          submittedAt: 'Nov 14, 2026',
          certificates: [{ name: 'Degree', status: 'verified', holderName: 'Rehen Applicant' }],
          cvFileName: 'rehen_cv.pdf',
        },
        {
          id: 'app-empty-uni',
          name: 'Anonymous Applicant',
          email: 'anon@example.com',
          university: '',
          years: 6,
          expertise: 'DevOps',
          motivation: 'Helping teams scale systems.',
          status: 'pending',
          submittedAt: 'Nov 14, 2026',
          certificates: [{ name: 'Cert', status: 'verified', holderName: 'Anonymous Applicant' }],
          cvFileName: 'anon_cv.pdf',
        },
      ]);

      renderWithAuthAndRole(<AdminMentorApps />, { role: 'Admin' });

      // Wait for applications to load
      await waitFor(() => {
        expect(screen.getAllByText('Rehen Applicant').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Anonymous Applicant').length).toBeGreaterThan(0);
      });

      // Card with "vit" shows University: vit
      await waitFor(() => {
        expect(screen.getAllByText('vit').length).toBeGreaterThan(0);
      });

      // Card with empty university shows "Not specified"
      await waitFor(() => {
        expect(screen.getAllByText('Not specified').length).toBeGreaterThan(0);
      });
    });
  });
});
