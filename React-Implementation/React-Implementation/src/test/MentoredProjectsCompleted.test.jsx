import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import MentoredProjects from '../pages/mentor/MentoredProjects';
import mentorMarketplaceApi from '../services/mentorMarketplaceApi';
import { renderWithStore } from './test-utils';

const mockedNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockedNavigate,
  };
});

vi.mock('../services/mentorMarketplaceApi', () => ({
  default: {
    getMentoredProjects: vi.fn(),
    getMyAbandonmentReviews: vi.fn(() => Promise.resolve([])),
    confirmAbandonmentReview: vi.fn(),
    mentorSessions: vi.fn(),
  },
}));

vi.mock('../services/projectsApi', () => ({
  default: {
    list: vi.fn(),
    get: vi.fn(),
  },
  isProjectLocked: vi.fn((p) => p.isCompleted || p.status === 'Completed' || p.status === 'Closed'),
  isProjectActive: vi.fn((p) => !p.isCompleted && p.status !== 'Completed' && p.status !== 'Closed'),
}));

vi.mock('../services/mentorRequestsApi', () => ({
  default: {
    list: vi.fn(() => Promise.resolve([])),
  },
}));

const renderWithAuth = (ui, { user = { id: '7', name: 'Neha Gupta', role: 'Mentor' } } = {}) => {
  return renderWithStore(ui, {
    route: '/mentor/projects',
    preloadedState: {
      session: {
        user,
        loading: false,
        isAuthenticated: true,
        status: 'authenticated',
        activeRole: 'Mentor',
        allowedRoles: ['Mentor'],
      },
    },
  });
};

describe('MentoredProjects - Completed & Active Projects Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. displays completed project under Completed and All tabs with correct counts', async () => {
    mentorMarketplaceApi.getMentoredProjects.mockResolvedValue({
      items: [
        {
          projectId: 'proj-comp-101',
          id: 'proj-comp-101',
          title: 'Distributed Analytics Pipeline',
          ownerName: 'Alice Johnson',
          status: 'Completed',
          dueDate: '2026-03-10T00:00:00.000Z',
          completedAt: '2026-02-28T10:00:00.000Z',
          sessionStatus: 'completed',
          amount: 2500,
          progress: 100,
          tab: 'completed',
        },
        {
          projectId: 'proj-act-202',
          id: 'proj-act-202',
          title: 'Autonomous Drone Navigation',
          ownerName: 'Bob Smith',
          status: 'In Progress',
          dueDate: '2026-04-15T00:00:00.000Z',
          sessionStatus: 'active',
          amount: 1800,
          progress: 50,
          tab: 'active',
        },
      ],
      counts: {
        all: 2,
        active: 1,
        completed: 1,
      },
    });

    renderWithAuth(<MentoredProjects />);

    await waitFor(() => {
      expect(screen.getByText('Distributed Analytics Pipeline')).toBeDefined();
      expect(screen.getByText('Autonomous Drone Navigation')).toBeDefined();
    });

    // Check tab labels with response counts
    const allTab = screen.getByRole('tab', { name: /All/i });
    const activeTab = screen.getByRole('tab', { name: /Active/i });
    const completedTab = screen.getByRole('tab', { name: /Completed/i });

    expect(allTab.textContent).toContain('2');
    expect(activeTab.textContent).toContain('1');
    expect(completedTab.textContent).toContain('1');

    // Filter to Active tab
    fireEvent.click(activeTab);
    expect(screen.queryByText('Distributed Analytics Pipeline')).toBeNull();
    expect(screen.getByText('Autonomous Drone Navigation')).toBeDefined();

    // Filter to Completed tab
    fireEvent.click(completedTab);
    expect(screen.getByText('Distributed Analytics Pipeline')).toBeDefined();
    expect(screen.queryByText('Autonomous Drone Navigation')).toBeNull();
  });

  it('2. displays Closed project under Completed tab with Closed badge and closedReason', async () => {
    mentorMarketplaceApi.getMentoredProjects.mockResolvedValue({
      items: [
        {
          projectId: 'proj-closed-303',
          id: 'proj-closed-303',
          title: 'Legacy Healthcare Portal',
          ownerName: 'Carol White',
          status: 'Closed',
          closedReason: 'Budget reallocation to mobile platform',
          dueDate: '2026-03-20T00:00:00.000Z',
          sessionStatus: 'completed',
          amount: 1500,
          progress: 60,
          tab: 'completed',
        },
      ],
      counts: {
        all: 1,
        active: 0,
        completed: 1,
      },
    });

    renderWithAuth(<MentoredProjects />);

    await waitFor(() => {
      expect(screen.getByText('Legacy Healthcare Portal')).toBeDefined();
    });

    // Check closed banner with reason
    const banner = screen.getByTestId('project-card-closure-banner');
    expect(banner).toBeDefined();
    expect(banner.textContent).toContain('Budget reallocation to mobile platform');

    // Click Completed tab
    const completedTab = screen.getByRole('tab', { name: /Completed/i });
    fireEvent.click(completedTab);
    expect(screen.getByText('Legacy Healthcare Portal')).toBeDefined();

    // Click Active tab -> shows empty state
    const activeTab = screen.getByRole('tab', { name: /Active/i });
    fireEvent.click(activeTab);
    expect(screen.getByText('No Active Mentored Projects')).toBeDefined();
  });

  it('3. displays empty state for empty completed tab', async () => {
    mentorMarketplaceApi.getMentoredProjects.mockResolvedValue({
      items: [
        {
          projectId: 'proj-act-404',
          id: 'proj-act-404',
          title: 'Active IoT Gateway',
          ownerName: 'David Lee',
          status: 'In Progress',
          sessionStatus: 'active',
          amount: 1200,
          progress: 30,
          tab: 'active',
        },
      ],
      counts: {
        all: 1,
        active: 1,
        completed: 0,
      },
    });

    renderWithAuth(<MentoredProjects />);

    await waitFor(() => {
      expect(screen.getByText('Active IoT Gateway')).toBeDefined();
    });

    const completedTab = screen.getByRole('tab', { name: /Completed/i });
    fireEvent.click(completedTab);

    expect(screen.getByText('No Completed Mentored Projects')).toBeDefined();
    expect(
      screen.getByText('Projects you have successfully guided to completion will be recorded here.')
    ).toBeDefined();
  });

  it('4. clicking a project card navigates to /mentor/workspace/:projectId', async () => {
    mentorMarketplaceApi.getMentoredProjects.mockResolvedValue({
      items: [
        {
          projectId: 'proj-nav-505',
          id: 'proj-nav-505',
          title: 'Navigation Test Project',
          ownerName: 'Emma Green',
          status: 'In Progress',
          sessionStatus: 'active',
          amount: 1500,
          tab: 'active',
        },
      ],
      counts: {
        all: 1,
        active: 1,
        completed: 0,
      },
    });

    renderWithAuth(<MentoredProjects />);

    await waitFor(() => {
      expect(screen.getByText('Navigation Test Project')).toBeDefined();
    });

    const card = screen.getByText('Navigation Test Project').closest('.tf-project-card');
    fireEvent.click(card);

    expect(mockedNavigate).toHaveBeenCalledWith('/mentor/workspace/proj-nav-505');
  });

  it('5. refetches on window focus', async () => {
    mentorMarketplaceApi.getMentoredProjects.mockResolvedValue({
      items: [],
      counts: { all: 0, active: 0, completed: 0 },
    });

    renderWithAuth(<MentoredProjects />);

    await waitFor(() => {
      expect(mentorMarketplaceApi.getMentoredProjects).toHaveBeenCalledTimes(1);
    });

    // Simulate window focus event
    fireEvent(window, new Event('focus'));

    await waitFor(() => {
      expect(mentorMarketplaceApi.getMentoredProjects).toHaveBeenCalledTimes(2);
    });
  });
});
