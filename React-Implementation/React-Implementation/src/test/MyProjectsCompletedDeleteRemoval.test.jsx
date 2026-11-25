import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import fs from 'fs';
import path from 'path';
import { AuthContext } from '../context/AuthContext';
import { RoleContext } from '../context/RoleContext';
import { UIProvider } from '../context/UIContext';
import MyProjects from '../pages/owner/MyProjects';
import OwnedWorkspace from '../pages/owner/OwnedWorkspace';
import projectsApi from '../services/projectsApi';
import tasksApi from '../services/tasksApi';
import mentorMarketplaceApi from '../services/mentorMarketplaceApi';

const mockedNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockedNavigate,
  };
});

vi.mock('../services/projectsApi', () => ({
  default: {
    list: vi.fn(),
    get: vi.fn(),
    softDelete: vi.fn(),
    checkDeletion: vi.fn(),
    listLeaveRequests: vi.fn(() => Promise.resolve([])),
    getMyLeaveRequest: vi.fn(() => Promise.resolve(null)),
  },
  isProjectLocked: vi.fn((p) => Boolean(p && (p.isCompleted || p.status === 'Completed' || p.status === 'Closed'))),
  isProjectActive: vi.fn((p) => Boolean(p && !p.isCompleted && p.status !== 'Completed' && p.status !== 'Closed')),
}));

vi.mock('../services/tasksApi', () => ({
  default: {
    list: vi.fn(() => Promise.resolve([])),
  },
}));

vi.mock('../services/mentorMarketplaceApi', () => ({
  default: {
    getAbandonmentReviewForProject: vi.fn(() => Promise.resolve(null)),
    getSessionsByProject: vi.fn(() => Promise.resolve([])),
  },
}));

const ownerUser = {
  id: 'owner-1',
  name: 'Priya Patel',
  email: 'priya@example.com',
  role: 'Project Owner',
};

const renderWithProviders = (ui) => {
  return render(
    <MemoryRouter initialEntries={['/my-projects']}>
      <AuthContext.Provider value={{ user: ownerUser, loading: false, isAuthenticated: true }}>
        <RoleContext.Provider value={{ currentRole: 'Project Owner', switchRole: vi.fn(), availableRoles: ['Project Owner'] }}>
          <UIProvider>
            {ui}
          </UIProvider>
        </RoleContext.Provider>
      </AuthContext.Provider>
    </MemoryRouter>
  );
};

describe('REMOVAL: "Delete" Button on Every Project Card in My Projects List', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. renders My Projects with projects in each status (Open, In Progress, Completed, Closed) with NO Delete button on ANY card, while every card still has Manage', async () => {
    const projectsList = [
      {
        id: 'proj-open-1',
        title: 'Open Robotics System',
        description: 'Recruiting early developers.',
        ownerId: 'owner-1',
        owner: 'Priya Patel',
        status: 'Open',
        isCompleted: false,
        dueDate: '2026-05-01T00:00:00.000Z',
        progress: 10,
      },
      {
        id: 'proj-inprogress-2',
        title: 'In Progress DeFi Engine',
        description: 'Active smart contract development.',
        ownerId: 'owner-1',
        owner: 'Priya Patel',
        status: 'In Progress',
        isCompleted: false,
        dueDate: '2026-04-15T00:00:00.000Z',
        progress: 45,
      },
      {
        id: 'proj-completed-3',
        title: 'Completed Cloud Migration',
        description: 'Successfully deployed and released.',
        ownerId: 'owner-1',
        owner: 'Priya Patel',
        status: 'Completed',
        isCompleted: true,
        dueDate: '2026-03-01T00:00:00.000Z',
        completedAt: '2026-02-25T10:00:00.000Z',
        progress: 100,
      },
      {
        id: 'proj-closed-4',
        title: 'Closed Research Initiative',
        description: 'Pivoted to another scope.',
        ownerId: 'owner-1',
        owner: 'Priya Patel',
        status: 'Closed',
        closureReason: 'Budget expired',
        isCompleted: false,
        dueDate: '2026-02-20T00:00:00.000Z',
        progress: 50,
      },
    ];

    projectsApi.list.mockResolvedValue(projectsList);

    renderWithProviders(<MyProjects />);

    await waitFor(() => {
      expect(screen.getByText('Open Robotics System')).toBeDefined();
      expect(screen.getByText('In Progress DeFi Engine')).toBeDefined();
      expect(screen.getByText('Completed Cloud Migration')).toBeDefined();
      expect(screen.getByText('Closed Research Initiative')).toBeDefined();
    });

    // Verify tab counts
    const allTab = screen.getByRole('tab', { name: /All/i });
    const activeTab = screen.getByRole('tab', { name: /Active/i });
    const completedTab = screen.getByRole('tab', { name: /Completed/i });
    const closedTab = screen.getByRole('tab', { name: /Closed/i });

    expect(allTab.textContent).toContain('4');
    expect(activeTab.textContent).toContain('2');
    expect(completedTab.textContent).toContain('1');
    expect(closedTab.textContent).toContain('1');

    // Assert that NO Delete button exists anywhere on the page
    expect(screen.queryByRole('button', { name: /^Delete$/i })).toBeNull();
    expect(screen.queryByTestId('myprojects-delete-btn-proj-open-1')).toBeNull();
    expect(screen.queryByTestId('myprojects-delete-btn-proj-inprogress-2')).toBeNull();
    expect(screen.queryByTestId('myprojects-delete-btn-proj-completed-3')).toBeNull();
    expect(screen.queryByTestId('myprojects-delete-btn-proj-closed-4')).toBeNull();

    // Assert that every card contains the "Manage →" button
    const manageButtons = screen.getAllByRole('button', { name: /Manage →/i });
    expect(manageButtons).toHaveLength(4);

    // Verify the footer layout contains only 1 action button per card (Manage)
    manageButtons.forEach((btn) => {
      const actionsContainer = btn.closest('.tf-project-card-actions');
      expect(actionsContainer).toBeDefined();
      const buttonsInside = actionsContainer.querySelectorAll('button');
      expect(buttonsInside).toHaveLength(1);
    });
  });

  it('2. Project workspace still shows its delete option and opens DeleteProjectDialog', async () => {
    projectsApi.get.mockResolvedValue({
      id: 'proj-workspace-4',
      title: 'Workspace Project Alpha',
      ownerId: 'owner-1',
      owner: 'Priya Patel',
      status: 'In Progress',
      isCompleted: false,
      members: [{ userId: 'owner-1', role: 'Owner' }],
      tasks: [],
    });
    projectsApi.checkDeletion.mockResolvedValue({
      allowed: true,
      blockers: [],
      impact: { activeCollaborators: 0, openTasks: 0, pendingRequests: 0, pendingInvites: 0, pendingSessionsToRefund: 0 },
      requiresReason: false,
      noticeHours: 0,
      mode: 'instant',
    });

    render(
      <MemoryRouter initialEntries={['/owner/workspace/proj-workspace-4']}>
        <Routes>
          <Route
            path="/owner/workspace/:projectId"
            element={
              <AuthContext.Provider value={{ user: ownerUser, loading: false, isAuthenticated: true }}>
                <RoleContext.Provider value={{ currentRole: 'Project Owner', switchRole: vi.fn(), availableRoles: ['Project Owner'] }}>
                  <UIProvider>
                    <OwnedWorkspace />
                  </UIProvider>
                </RoleContext.Provider>
              </AuthContext.Provider>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    // Verify delete option button inside workspace exists
    const wsDeleteBtn = await screen.findByTestId('owner-delete-project-btn');
    expect(wsDeleteBtn).toBeDefined();
    expect(wsDeleteBtn.textContent).toContain('Delete project');

    // Clicking it opens DeleteProjectDialog
    fireEvent.click(wsDeleteBtn);
    await waitFor(() => {
      expect(screen.getByTestId('delete-project-modal')).toBeDefined();
      expect(screen.getByTestId('delete-impact-summary')).toBeDefined();
    });
  });

  it('3. Scan test confirms MyProjects page does not import any delete API helper', () => {
    const myProjectsFilePath = path.resolve(
      __dirname,
      '../pages/owner/MyProjects.jsx'
    );
    const content = fs.readFileSync(myProjectsFilePath, 'utf-8');

    // Confirm no named import for delete API helpers (e.g. deleteProject, softDeleteProject, removeProject)
    expect(content).not.toMatch(/import\s+.*\{[^}]*delete[A-Z0-9_]*/i);
    expect(content).not.toMatch(/import\s+.*\{[^}]*softDelete[A-Z0-9_]*/i);
    expect(content).not.toMatch(/import\s+.*from\s+['"][^'"]*delete[^'"]*['"]/i);
    // Confirm no Modal import used for deletion
    expect(content).not.toMatch(/import\s+Modal\s+from/i);
    // Confirm no softDelete method is called
    expect(content).not.toMatch(/\.softDelete\(/);
  });
});
