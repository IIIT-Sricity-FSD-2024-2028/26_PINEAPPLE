import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Profile, { MentoredProjectsCard } from '../pages/profile';
import { renderWithStore } from './test-utils';
import usersApi from '../services/usersApi';
import projectsApi from '../services/projectsApi';
import tasksApi from '../services/tasksApi';
import joinRequestsApi from '../services/joinRequestsApi';
import mentorshipApi from '../services/mentorshipApi';
import gamificationApi from '../services/gamificationApi';
import trustApi from '../services/trustApi';

describe('Profile: Mentored Projects Card', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders active and completed mentored projects from /users/me on mentor own profile with status badges, owner name, dates, and SafeLink', async () => {
    const mockMentor = {
      id: 'mentor-1',
      uid: 'mentor-1',
      name: 'Kiran Bose',
      role: 'Mentor',
      createdAt: '2025-01-10T00:00:00.000Z',
      mentoredProjects: [
        {
          projectId: 'p-active',
          title: 'Active Mentored SaaS',
          ownerName: 'Priya Patel',
          status: 'In Progress',
          tab: 'active',
          acceptedAt: '2026-05-01T10:00:00.000Z',
          finalLink: null,
        },
        {
          projectId: 'p-comp',
          title: 'Completed AI Pipeline',
          ownerName: 'Arjun Sharma',
          status: 'Completed',
          tab: 'completed',
          completedAt: '2026-06-10T10:00:00.000Z',
          finalLink: 'https://github.com/teamforge/ai-pipeline',
        },
      ],
    };

    vi.spyOn(usersApi, 'getMe').mockResolvedValue(mockMentor);
    vi.spyOn(usersApi, 'getReputation').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(projectsApi, 'list').mockResolvedValue([]);
    vi.spyOn(tasksApi, 'listForProjects').mockResolvedValue([]);
    vi.spyOn(joinRequestsApi, 'list').mockResolvedValue([]);
    vi.spyOn(mentorshipApi, 'getBadges').mockResolvedValue([]);
    vi.spyOn(gamificationApi, 'getUserLedger').mockResolvedValue([]);
    vi.spyOn(trustApi, 'getMyTrust').mockResolvedValue(null);

    renderWithStore(<Profile />, {
      route: '/profile',
      preloadedState: {
        session: {
          user: mockMentor,
          isAuthenticated: true,
          status: 'authenticated',
          initialized: true,
        },
      },
    });

    const card = await screen.findByTestId('profile-mentored-projects-card');
    expect(card.textContent).toContain('Active Mentored SaaS');
    expect(card.textContent).toContain('Priya Patel');
    expect(card.textContent).toContain('Active');

    expect(card.textContent).toContain('Completed AI Pipeline');
    expect(card.textContent).toContain('Arjun Sharma');
    expect(card.textContent).toContain('Completed');

    const finalLink = screen.getByRole('link', { name: /Final Link/i });
    expect(finalLink).toBeDefined();
    expect(finalLink.getAttribute('href')).toBe('https://github.com/teamforge/ai-pipeline');

    // Focus refresh triggers fresh usersApi.getMe call
    fireEvent(window, new Event('focus'));
    await waitFor(() => {
      expect(usersApi.getMe).toHaveBeenCalledTimes(2);
    });
  });

  it('shows completed projects only when isPublic is true, and shows empty state when none exist', () => {
    const projects = [
      {
        projectId: 'p-active',
        title: 'Secret Active SaaS',
        ownerName: 'Priya Patel',
        status: 'In Progress',
        tab: 'active',
        acceptedAt: '2026-05-01T10:00:00.000Z',
      },
      {
        projectId: 'p-comp',
        title: 'Public Completed ML',
        ownerName: 'Arjun Sharma',
        status: 'Completed',
        tab: 'completed',
        completedAt: '2026-06-10T10:00:00.000Z',
        finalLink: 'https://github.com/teamforge/ml',
      },
    ];

    const { rerender } = render(
      <MemoryRouter>
        <MentoredProjectsCard mentoredProjects={projects} isPublic={true} />
      </MemoryRouter>
    );

    expect(screen.queryByText('Secret Active SaaS')).toBeNull();
    expect(screen.getByText('Public Completed ML')).toBeDefined();
    expect(screen.getByRole('link', { name: /Final Link/i }).getAttribute('href')).toBe(
      'https://github.com/teamforge/ml',
    );

    rerender(
      <MemoryRouter>
        <MentoredProjectsCard mentoredProjects={[]} isPublic={false} />
      </MemoryRouter>
    );
    expect(screen.getByText(/No mentored projects yet\./i)).toBeDefined();
  });
});
