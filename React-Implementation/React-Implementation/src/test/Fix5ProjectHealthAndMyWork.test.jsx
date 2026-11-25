import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MyWork from '../pages/collaborator/MyWork';
import { AuthContext } from '../context/AuthContext';
import projectsApi from '../services/projectsApi';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

vi.mock('../services/projectsApi', () => ({
  default: {
    getMyWork: vi.fn(),
    list: vi.fn(),
  },
  isProjectLocked: (p) => p?.isCompleted === true || p?.status === 'Completed' || p?.status === 'Closed',
  isProjectActive: (p) => p && !p.isCompleted && p.status !== 'Completed' && p.status !== 'Closed',
}));

vi.mock('../services/tasksApi', () => ({
  default: {
    listForProjects: vi.fn().mockResolvedValue([]),
    list: vi.fn().mockResolvedValue([]),
  },
}));

describe('FIX 5: Collaborator My Work', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Collaborator My Work Page', () => {
    const mockWorkResponse = {
      ongoing: [
        {
          id: 'proj-act-1',
          title: 'Autonomous Drone Fleet',
          description: 'Distributed navigation stack.',
          status: 'In Progress',
          collaborators: [{ id: 'u-collab', name: 'Test Collab', role: 'Collaborator' }],
        },
      ],
      completed: [
        {
          id: 'proj-fin-1',
          title: 'Quantum Key Distribution',
          description: 'Simulation of photon polarization.',
          status: 'Completed',
          isCompleted: true,
          completedAt: '2026-11-10T10:00:00.000Z',
          collaborators: [{ id: 'u-collab', name: 'Test Collab', role: 'Collaborator' }],
        },
        {
          id: 'proj-cls-1',
          title: 'Legacy Satellite Relay',
          description: 'Decommissioned satellite telemetry.',
          status: 'Closed',
          closureReason: 'Owner inactive for 30 days',
          closedAt: '2026-11-09T10:00:00.000Z',
          collaborators: [{ id: 'u-collab', name: 'Test Collab', role: 'Collaborator' }],
        },
      ],
      ongoingCount: 1,
      completedCount: 2,
    };

    it('renders ongoing and completed tabs with exact response counts, closed badge, and closure reason', async () => {
      projectsApi.getMyWork.mockResolvedValue(mockWorkResponse);

      const mockAuthUser = { id: 'u-collab', name: 'Test Collab', role: 'Collaborator' };

      render(
        <MemoryRouter>
          <AuthContext.Provider value={{ user: mockAuthUser, isAuthenticated: true }}>
            <MyWork />
          </AuthContext.Provider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(projectsApi.getMyWork).toHaveBeenCalledWith('u-collab');
      });

      // Verify tab labels have the exact response counts
      expect(screen.getByRole('tab', { name: /Ongoing \(1\)/i })).toBeDefined();
      expect(screen.getByRole('tab', { name: /Completed \(2\)/i })).toBeDefined();

      // In Ongoing tab by default: shows active project
      expect(screen.getByText('Autonomous Drone Fleet')).toBeDefined();
      expect(screen.queryByText('Quantum Key Distribution')).toBeNull();

      // Switch to Completed tab
      fireEvent.click(screen.getByRole('tab', { name: /Completed \(2\)/i }));

      // Both Completed and Closed projects appear
      expect(screen.getByText('Quantum Key Distribution')).toBeDefined();
      expect(screen.getByText('Legacy Satellite Relay')).toBeDefined();

      // Closed project shows Closed badge and closure reason
      const closureBanner = screen.getByTestId('project-card-closure-banner');
      expect(closureBanner).toBeDefined();
      expect(closureBanner.textContent).toContain('Closed:');
      expect(closureBanner.textContent).toContain('Owner inactive for 30 days');
    });
  });
});
