import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithStore } from './test-utils';
import OwnedWorkspace from '../pages/owner/OwnedWorkspace';
import MentoredProjects from '../pages/mentor/MentoredProjects';
import Dashboard from '../pages/dashboard';
import MentorApplication from '../pages/mentor/MentorApplication';
import MyMentorProfile from '../pages/mentor/MyMentorProfile';
import MentorsDirectory from '../pages/owner/MentorsDirectory';
import AdminUserDetails from '../pages/admin/AdminUserDetails';

import projectsApi from '../services/projectsApi';
import tasksApi from '../services/tasksApi';
import joinRequestsApi from '../services/joinRequestsApi';
import communicationApi from '../services/communicationApi';
import mentorMarketplaceApi from '../services/mentorMarketplaceApi';
import mentorApplicationsApi from '../services/mentorApplicationsApi';
import mentorRequestsApi from '../services/mentorRequestsApi';
import adminApi from '../services/adminApi';
import usersApi from '../services/usersApi';
import mentorshipApi from '../services/mentorshipApi';
import leaderboardApi from '../services/leaderboardApi';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ projectId: 'proj-14', id: '7' }),
    useNavigate: () => vi.fn(),
  };
});

vi.mock('../services/projectsApi', () => ({
  default: {
    get: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
  },
  isProjectLocked: vi.fn(() => false),
  isProjectActive: vi.fn(() => true),
}));

vi.mock('../services/tasksApi', () => ({
  default: { list: vi.fn() },
}));

vi.mock('../services/joinRequestsApi', () => ({
  default: { list: vi.fn() },
}));

vi.mock('../services/communicationApi', () => ({
  default: {
    getMessages: vi.fn(),
    sendMessage: vi.fn(),
  },
}));

vi.mock('../services/mentorMarketplaceApi', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: {
      listMentors: vi.fn(),
      myProfile: vi.fn(),
      getMyProfile: vi.fn(),
      createProfile: vi.fn(),
      updateProfile: vi.fn(),
      updateAvailability: vi.fn(),
      mySessions: vi.fn(),
      mentorSessions: vi.fn(),
      bookSession: vi.fn(),
      confirmPayment: vi.fn(),
      cancelPayment: vi.fn(),
      submitSessionFeedback: vi.fn(),
      getProjectAbandonmentReview: vi.fn(),
      openAbandonmentReview: vi.fn(),
      confirmAbandonmentReview: vi.fn(),
      getMyAbandonmentReviews: vi.fn(),
      getAdminMentorFeedback: vi.fn(),
    },
  };
});

vi.mock('../services/mentorApplicationsApi', () => ({
  default: {
    getMyStatus: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
    getDigiLockerStatus: vi.fn(),
  },
}));

vi.mock('../services/mentorRequestsApi', () => ({
  default: { list: vi.fn() },
}));

vi.mock('../services/adminApi', () => ({
  default: {
    getUserDetails: vi.fn(),
    getUserReputation: vi.fn(),
    getPublicConfig: vi.fn(),
  },
}));

vi.mock('../services/usersApi', () => ({
  default: { getMe: vi.fn() },
}));

vi.mock('../services/mentorshipApi', () => ({
  default: { getBadges: vi.fn() },
}));

vi.mock('../services/leaderboardApi', () => ({
  default: { getUserRank: vi.fn() },
}));

const renderWithAuthAndRole = (ui, { user, role = 'Project Owner' }) =>
  renderWithStore(ui, {
    preloadedState: {
      session: {
        user,
        loading: false,
        isAuthenticated: true,
        status: 'authenticated',
        activeRole: role,
        allowedRoles: [role],
      },
    },
  });

describe('Phase 14 - Mentor Lifecycle Frontend UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    communicationApi.getMessages.mockResolvedValue([]);
    joinRequestsApi.list.mockResolvedValue([]);
    tasksApi.list.mockResolvedValue([]);
    adminApi.getPublicConfig.mockResolvedValue({ mentorMinYearsExperience: 5 });
    mentorApplicationsApi.getDigiLockerStatus.mockResolvedValue({ mode: 'sandbox', available: true });
    mentorRequestsApi.list.mockResolvedValue([]);
    mentorshipApi.getBadges.mockResolvedValue([]);
    leaderboardApi.getUserRank.mockResolvedValue(null);
  });

  it('1. OwnedWorkspace shows mentor last-active summary, Report inactive mentor confirm flow, and 48h review countdown banner', async () => {
    const ownerUser = { id: '1', name: 'Priya Patel', role: 'Project Owner' };
    projectsApi.get.mockResolvedValue({
      id: 'proj-14',
      title: 'Distributed Cache',
      ownerId: '1',
      owner: { id: '1', name: 'Priya Patel' },
      mentorId: '7',
      mentor: { id: '7', name: 'Neha Gupta' },
      status: 'In Progress',
      collaborators: [],
    });

    mentorMarketplaceApi.getProjectAbandonmentReview
      .mockResolvedValueOnce({
        id: null,
        status: null,
        review: null,
        projectId: 'proj-14',
        lastActivityAt: '2026-06-01T10:00:00.000Z',
        inactiveDays: 8,
      })
      .mockResolvedValueOnce({
        id: 'rev-14',
        status: 'open',
        projectId: 'proj-14',
        lastActivityAt: '2026-06-01T10:00:00.000Z',
        inactiveDays: 8,
        deadlineAt: new Date(Date.now() + 47 * 60 * 60 * 1000).toISOString(),
        review: {
          id: 'rev-14',
          status: 'open',
          deadlineAt: new Date(Date.now() + 47 * 60 * 60 * 1000).toISOString(),
        },
      });
    mentorMarketplaceApi.openAbandonmentReview.mockResolvedValue({ id: 'rev-14', status: 'open' });

    renderWithAuthAndRole(<OwnedWorkspace />, { user: ownerUser, role: 'Project Owner' });

    await waitFor(() => expect(screen.getByText(/Members/i)).toBeTruthy());
    fireEvent.click(screen.getByText(/Members/i));

    await waitFor(() => {
      expect(screen.getByTestId('mentor-activity-status').textContent).toContain('Last active 8 days ago');
    });

    const reportBtn = screen.getByTestId('report-inactive-mentor-btn');
    expect(reportBtn.disabled).toBe(false);
    fireEvent.click(reportBtn);

    await waitFor(() => expect(screen.getByTestId('confirm-report-mentor-btn')).toBeTruthy());
    fireEvent.click(screen.getByTestId('confirm-report-mentor-btn'));

    await waitFor(() => {
      expect(mentorMarketplaceApi.openAbandonmentReview).toHaveBeenCalledWith('proj-14', undefined);
      expect(screen.getByTestId('abandonment-review-banner')).toBeTruthy();
      expect(screen.getByTestId('abandonment-review-banner').textContent).toContain('Abandonment review open');
    });
  });

  it('2. Mentor Sees Still Active banner on MentoredProjects and Dashboard and confirms activity', async () => {
    const mentorUser = { id: '7', name: 'Neha Gupta', role: 'Mentor' };
    projectsApi.list.mockResolvedValue([]);
    mentorMarketplaceApi.mentorSessions.mockResolvedValue([]);
    mentorMarketplaceApi.getMyAbandonmentReviews.mockResolvedValue([
      { id: 'rev-m1', projectId: 'proj-14', projectTitle: 'Distributed Cache', status: 'open' },
    ]);
    mentorMarketplaceApi.confirmAbandonmentReview.mockResolvedValue({ id: 'rev-m1', status: 'confirmed' });

    renderWithAuthAndRole(<MentoredProjects />, { user: mentorUser, role: 'Mentor' });

    await waitFor(() => expect(screen.getByTestId('mentor-confirm-active-btn-rev-m1')).toBeTruthy());
    fireEvent.click(screen.getByTestId('mentor-confirm-active-btn-rev-m1'));

    await waitFor(() => {
      expect(mentorMarketplaceApi.confirmAbandonmentReview).toHaveBeenCalledWith('rev-m1');
      expect(screen.queryByTestId('mentor-confirm-active-btn-rev-m1')).toBeNull();
    });

    // Also verified on Dashboard
    usersApi.getMe.mockResolvedValue({ id: '7', name: 'Neha Gupta', role: 'Mentor', profile: { xp: 100, rep: 10 } });
    renderWithAuthAndRole(<Dashboard />, { user: mentorUser, role: 'Mentor' });
    await waitFor(() => expect(screen.getByTestId('dash-still-active-btn-rev-m1')).toBeTruthy());
  });

  it('3. MentorApplication shows cooldown banner with exact re-apply date and disables re-application while in cooldown', async () => {
    const applicant = { id: '2', name: 'Arjun Sharma', email: 'arjun@teamforge.io', role: 'Collaborator' };
    mentorApplicationsApi.getMyStatus.mockResolvedValue({
      status: 'rejected',
      inCooldown: true,
      cooldownDays: 14,
      cooldownAvailableAt: '2026-06-25T12:00:00.000Z',
      application: {
        id: 'app-rej-1',
        status: 'rejected',
        rejectionReason: 'Please add more mentoring experience.',
        rejectedAt: '2026-06-11T12:00:00.000Z',
      },
    });

    renderWithAuthAndRole(<MentorApplication />, { user: applicant, role: 'Collaborator' });

    await waitFor(() => expect(screen.getByTestId('mentor-reapply-cooldown')).toBeTruthy());
    expect(screen.getByTestId('mentor-reapply-cooldown').textContent).toContain('Re-application cooldown active (14 days after rejection)');
    const submitNewBtn = screen.getByRole('button', { name: /Re-application in Cooldown/i });
    expect(submitNewBtn.disabled).toBe(true);
  });

  it('4. MyMentorProfile allows setting maxActiveMentees and MentorsDirectory renders Full badge + disables booking when full', async () => {
    const mentorUser = { id: '7', name: 'Neha Gupta', role: 'Mentor' };
    const existingProfile = {
      id: 'mp-1',
      userId: '7',
      name: 'Neha Gupta',
      title: 'Data Scientist',
      bio: 'ML mentorship',
      skills: ['Python', 'ML'],
      experienceYears: 5,
      sessionPrice: 1500,
      isAvailable: true,
      maxActiveMentees: 4,
    };
    mentorMarketplaceApi.myProfile.mockResolvedValue(existingProfile);
    mentorMarketplaceApi.getMyProfile.mockResolvedValue(existingProfile);
    mentorMarketplaceApi.updateProfile.mockResolvedValue({
      ...existingProfile,
      maxActiveMentees: 6,
    });

    const { container } = renderWithAuthAndRole(<MyMentorProfile />, { user: mentorUser, role: 'Mentor' });

    await waitFor(() => expect(screen.getByDisplayValue('4')).toBeTruthy());
    const capInput = screen.getByDisplayValue('4');
    fireEvent.change(capInput, { target: { value: '6' } });
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => {
      expect(mentorMarketplaceApi.updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ maxActiveMentees: 6 }),
        undefined,
        '7',
      );
    });

    // Directory shows "Full" badge and disables button when mentor is at capacity
    mentorMarketplaceApi.listMentors.mockResolvedValue([
      {
        id: 'mp-full',
        name: 'Full Mentor',
        title: 'Architect',
        bio: 'Scalable systems',
        skills: ['Architecture'],
        experienceYears: 7,
        sessionPrice: 1500,
        isAvailable: true,
        maxActiveMentees: 3,
        activeMenteesCount: 3,
        isFull: true,
      },
    ]);
    projectsApi.list.mockResolvedValue([]);
    mentorMarketplaceApi.mySessions.mockResolvedValue([]);

    renderWithAuthAndRole(<MentorsDirectory />, {
      user: { id: '1', name: 'Priya Patel', role: 'Project Owner' },
      role: 'Project Owner',
    });

    await waitFor(() => expect(screen.getByText('Full Mentor')).toBeTruthy());
    const fullButtons = screen.getAllByRole('button', { name: 'Full' });
    expect(fullButtons[0].disabled).toBe(true);
    expect(screen.getByText('3/3')).toBeTruthy();
  });

  it('5. MentorsDirectory renders one-time post-session 1-5 star feedback form on completed session', async () => {
    mentorMarketplaceApi.listMentors.mockResolvedValue([
      { id: 'mp-1', name: 'Neha Gupta', isAvailable: true, maxActiveMentees: 3, activeMenteesCount: 0, isFull: false },
    ]);
    projectsApi.list.mockResolvedValue([]);
    mentorMarketplaceApi.mySessions.mockResolvedValue([
      {
        id: 'sess-comp-1',
        mentorId: 'mp-1',
        mentorName: 'Neha Gupta',
        projectId: 'proj-1',
        projectName: 'AI Tutor',
        agreedPrice: 1500,
        totalAmount: 1755,
        status: 'completed',
        hasFeedback: false,
        createdAt: '2026-06-01T10:00:00.000Z',
      },
    ]);
    mentorMarketplaceApi.submitSessionFeedback.mockResolvedValue({
      id: 'fb-1',
      sessionId: 'sess-comp-1',
      rating: 4,
    });

    renderWithAuthAndRole(<MentorsDirectory />, {
      user: { id: '1', name: 'Priya Patel', role: 'Project Owner' },
      role: 'Project Owner',
    });

    await waitFor(() => expect(screen.getByText(/Booking History/i)).toBeTruthy());
    fireEvent.click(screen.getByText(/Booking History/i));

    await waitFor(() => expect(screen.getByTestId('rate-session-btn-sess-comp-1')).toBeTruthy());
    fireEvent.click(screen.getByTestId('rate-session-btn-sess-comp-1'));

    await waitFor(() => expect(screen.getByTestId('feedback-star-4')).toBeTruthy());
    fireEvent.click(screen.getByTestId('feedback-star-4'));
    fireEvent.change(screen.getByTestId('feedback-comment-input'), {
      target: { value: 'Detailed feedback and practical code walkthroughs.' },
    });
    fireEvent.click(screen.getByTestId('submit-session-feedback-btn'));

    await waitFor(() => {
      expect(mentorMarketplaceApi.submitSessionFeedback).toHaveBeenCalledWith('sess-comp-1', {
        rating: 4,
        comment: 'Detailed feedback and practical code walkthroughs.',
      });
      expect(screen.queryByTestId('rate-session-btn-sess-comp-1')).toBeNull();
      expect(screen.getByText('Rated')).toBeTruthy();
    });
  });

  it('6. AdminUserDetails renders Mentor Feedback & Lifecycle section with ratings, comments, and abandonment history', async () => {
    const adminUser = { id: 'u-admin', name: 'Admin User', role: 'Administrator' };
    adminApi.getUserDetails.mockResolvedValue({
      id: '7',
      name: 'Neha Gupta',
      email: 'neha@teamforge.io',
      role: 'Mentor',
      status: 'Active',
      rep: 120,
      xp: 450,
      warnings: [],
      projects: [],
      recentActivity: [],
    });
    adminApi.getUserReputation.mockResolvedValue({ items: [], total: 0 });
    mentorMarketplaceApi.getAdminMentorFeedback.mockResolvedValue({
      mentorId: 'mp-1',
      mentorUserId: '7',
      averageRating: 4.5,
      totalFeedbackCount: 2,
      feedback: [
        {
          id: 'fb-10',
          rating: 5,
          comment: 'Clear guidance on system scaling.',
          ownerName: 'Priya Patel',
          createdAt: '2026-06-05T10:00:00.000Z',
        },
      ],
      abandonmentHistory: [
        {
          reviewId: 'rev-old-1',
          projectId: 'proj-old',
          projectTitle: 'Legacy Analytics',
          releasedAt: '2026-05-15T10:00:00.000Z',
          reason: 'No response for 9 days.',
        },
      ],
    });

    renderWithStore(<AdminUserDetails />, {
      preloadedState: {
        session: {
          user: adminUser,
          loading: false,
          isAuthenticated: true,
          status: 'authenticated',
          isSuperUser: true,
          portalRole: 'superuser',
          permissions: ['*'],
        },
      },
    });

    await waitFor(() => expect(screen.getByTestId('admin-mentor-feedback-card')).toBeTruthy());
    const card = screen.getByTestId('admin-mentor-feedback-card');
    expect(card.textContent).toContain('Avg Rating: 4.5 (2)');
    expect(card.textContent).toContain('Abandonment Incidents: 1');
    expect(card.textContent).toContain('Clear guidance on system scaling.');
    expect(card.textContent).toContain('Legacy Analytics');
  });
});
