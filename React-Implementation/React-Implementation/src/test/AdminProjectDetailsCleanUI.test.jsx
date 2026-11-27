import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithStore } from './test-utils';
import AdminProjectDetails from '../pages/admin/AdminProjectDetails';
import projectsApi from '../services/projectsApi';
import tasksApi from '../services/tasksApi';
import adminApi from '../services/adminApi';

vi.mock('../services/projectsApi', async () => {
  const actual = await vi.importActual('../services/projectsApi');
  return {
    ...actual,
    default: {
      get: vi.fn(),
      list: vi.fn(),
      close: vi.fn(),
      restore: vi.fn(),
      cancelDeletion: vi.fn(),
      softDelete: vi.fn(),
      checkDeletion: vi.fn().mockResolvedValue({ allowed: true, reasons: [] }),
    },
    isProjectLocked: vi.fn((p) => Boolean(p && (p.isCompleted || String(p.status).toLowerCase() === 'closed'))),
  };
});

vi.mock('../services/tasksApi', () => ({
  default: {
    list: vi.fn(),
  },
}));

vi.mock('../services/adminApi', () => ({
  default: {
    getProjectEscrow: vi.fn(),
  },
}));

const mockOpenProject = {
  id: 'proj-open-1',
  title: 'Cloud Orchestration Platform',
  description: 'A cloud-native infrastructure automation framework with multi-region Kubernetes deployments.',
  status: 'Open',
  difficulty: 'Intermediate',
  dueDate: '2027-05-20T00:00:00.000Z',
  requiredSkills: ['Docker', 'Kubernetes', 'Go'],
  owner: { name: 'Priya Patel', id: '1' },
  members: [
    { id: '1', name: 'Priya Patel', role: 'Owner' },
    { id: '2', name: 'Arjun Sharma', role: 'Collaborator' },
    { id: '7', name: 'Neha Gupta', role: 'Mentor' },
  ],
};

const mockClosedProject = {
  id: 'proj-closed-2',
  title: '5-char Project',
  description: 'UnbrokenVeryLongStringWithoutAnySpacesThatWouldNormallyOverflowTheEntireLayoutUnlessProperlyHandledByOverflowWrapAnywhereAndClampedProperlyByTheLineClampMechanism'.repeat(3),
  status: 'Closed',
  closureReason: 'Owner suspended',
  closedAt: '2026-11-01T10:00:00.000Z',
  difficulty: 'Beginner',
  dueDate: '2026-10-15T00:00:00.000Z',
  requiredSkills: 'Python, Flask',
  owner: 'Vikram Joshi',
  members: [
    { id: '3', name: 'Dr. Bartholomew Montgomery Alexander Humphrey the Third', role: 'Owner' },
  ],
};

const renderComponent = (projectId = 'proj-open-1') => {
  return renderWithStore(
    <Routes>
      <Route path="/admin/projects/:id" element={<AdminProjectDetails />} />
    </Routes>,
    { route: `/admin/projects/${projectId}` },
  );
};

describe('AdminProjectDetails: Basic and Clean UI Enhancement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page header with h1 project title, status badge next to it, and Delete Project button in header', async () => {
    projectsApi.get.mockResolvedValue(mockOpenProject);
    tasksApi.list.mockResolvedValue([]);
    adminApi.getProjectEscrow.mockResolvedValue(null);

    renderComponent('proj-open-1');

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Cloud Orchestration Platform/i })).toBeTruthy();
    });

    // Heading has role h1
    const h1Title = screen.getByRole('heading', { level: 1, name: /Cloud Orchestration Platform/i });
    expect(h1Title.tagName.toLowerCase()).toBe('h1');

    // Status badge is next to title in header
    expect(screen.getAllByText('Open').length).toBeGreaterThanOrEqual(1);

    // Delete project button is in header
    const deleteBtn = screen.getByTestId('admin-delete-project-btn');
    expect(deleteBtn).toBeTruthy();
    expect(deleteBtn.textContent).toContain('Delete Project');

    // Back button exists
    expect(screen.getByText('← Back to Projects')).toBeTruthy();
  });

  it('renders two-column overview grid with Owner, Status, Difficulty, Due Date with remaining days, and skills chips', async () => {
    projectsApi.get.mockResolvedValue(mockOpenProject);
    tasksApi.list.mockResolvedValue([]);
    adminApi.getProjectEscrow.mockResolvedValue(null);

    renderComponent('proj-open-1');

    await waitFor(() => {
      expect(screen.getAllByText('Priya Patel').length).toBeGreaterThanOrEqual(1);
    });

    // Check h2 section title
    expect(screen.getByRole('heading', { level: 2, name: /Project details/i })).toBeTruthy();

    // Labels & values
    expect(screen.getByText('Owner:')).toBeTruthy();
    expect(screen.getByText('Status:')).toBeTruthy();
    expect(screen.getByText('Difficulty:')).toBeTruthy();
    expect(screen.getByText('Intermediate')).toBeTruthy();
    expect(screen.getByText('Due Date:')).toBeTruthy();
    expect(screen.getByText(/Due .* left\)/i)).toBeTruthy();

    // Skill chips
    expect(screen.getByText('Docker')).toBeTruthy();
    expect(screen.getByText('Kubernetes')).toBeTruthy();
    expect(screen.getByText('Go')).toBeTruthy();
  });

  it('shows closure notice with reason and date on a Closed project and NOT on an Open project', async () => {
    // 1. Open project: NO closure notice
    projectsApi.get.mockResolvedValueOnce(mockOpenProject);
    tasksApi.list.mockResolvedValueOnce([]);
    adminApi.getProjectEscrow.mockResolvedValueOnce(null);

    const { unmount } = renderComponent('proj-open-1');
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Cloud Orchestration Platform/i })).toBeTruthy();
    });
    expect(screen.queryByTestId('admin-closure-notice')).toBeNull();
    unmount();

    // 2. Closed project: shows closure notice box with reason and date
    projectsApi.get.mockResolvedValueOnce(mockClosedProject);
    tasksApi.list.mockResolvedValueOnce([]);
    adminApi.getProjectEscrow.mockResolvedValueOnce(null);

    renderComponent('proj-closed-2');
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /5-char Project/i })).toBeTruthy();
    });

    const noticeBox = screen.getByTestId('admin-closure-notice');
    expect(noticeBox).toBeTruthy();
    expect(screen.getByTestId('admin-closure-reason').textContent).toContain('Owner suspended');
    expect(noticeBox.textContent).toContain('Closed on');
  });

  it('handles very long unbroken description with wrapping class and Show more / Show less toggle', async () => {
    projectsApi.get.mockResolvedValue(mockClosedProject);
    tasksApi.list.mockResolvedValue([]);
    adminApi.getProjectEscrow.mockResolvedValue(null);

    renderComponent('proj-closed-2');

    await waitFor(() => {
      expect(screen.getByText(/UnbrokenVeryLongString/i)).toBeTruthy();
    });

    const descEl = screen.getByText(/UnbrokenVeryLongString/i);
    expect(descEl.className).toContain('admin-project-description');
    expect(descEl.className).toContain('is-clamped');

    // Show more toggle exists
    const toggleBtn = screen.getByRole('button', { name: /Show more/i });
    expect(toggleBtn).toBeTruthy();

    // Click Show more -> changes to is-expanded
    fireEvent.click(toggleBtn);
    expect(descEl.className).toContain('is-expanded');
    expect(screen.getByRole('button', { name: /Show less/i })).toBeTruthy();

    // Click Show less -> collapses back to is-clamped
    fireEvent.click(screen.getByRole('button', { name: /Show less/i }));
    expect(descEl.className).toContain('is-clamped');
  });

  it('renders Team Members card with avatar, name with title tooltip, role badges, and empty state', async () => {
    // 1. With members
    projectsApi.get.mockResolvedValueOnce(mockOpenProject);
    tasksApi.list.mockResolvedValueOnce([]);
    adminApi.getProjectEscrow.mockResolvedValueOnce(null);

    const { unmount } = renderComponent('proj-open-1');

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: /Team Members/i })).toBeTruthy();
    });

    // Check members and their title tooltip attributes
    const priyaEls = screen.getAllByTitle('Priya Patel');
    expect(priyaEls.length).toBeGreaterThanOrEqual(1);

    const arjunEls = screen.getAllByTitle('Arjun Sharma');
    expect(arjunEls.length).toBeGreaterThanOrEqual(1);

    const nehaEls = screen.getAllByTitle('Neha Gupta');
    expect(nehaEls.length).toBeGreaterThanOrEqual(1);

    // Check role badges
    expect(screen.getByText('Owner')).toBeTruthy();
    expect(screen.getByText('Collaborator')).toBeTruthy();
    expect(screen.getByText('Mentor')).toBeTruthy();
    unmount();

    // 2. Empty state
    const emptyMembersProject = { ...mockOpenProject, members: [], collaborators: [] };
    projectsApi.get.mockResolvedValueOnce(emptyMembersProject);
    tasksApi.list.mockResolvedValueOnce([]);
    adminApi.getProjectEscrow.mockResolvedValueOnce(null);

    renderComponent('proj-open-1');
    await waitFor(() => {
      expect(screen.getByText('No team members yet')).toBeTruthy();
    });
  });

  it('renders Tasks & Milestones table with status badges, Unassigned assignee, and empty state', async () => {
    const mockTasks = [
      { id: 't-1', title: 'Setup VPC Peering', status: 'In Progress', assignee: 'Arjun Sharma', dueDate: '2027-04-01T00:00:00.000Z' },
      { id: 't-2', title: 'Write Terraform Scripts', status: 'Open', assignee: 'Unassigned', dueDate: null },
    ];

    // 1. With tasks
    projectsApi.get.mockResolvedValueOnce(mockOpenProject);
    tasksApi.list.mockResolvedValueOnce(mockTasks);
    adminApi.getProjectEscrow.mockResolvedValueOnce(null);

    const { unmount } = renderComponent('proj-open-1');

    await waitFor(() => {
      expect(screen.getByText('Setup VPC Peering')).toBeTruthy();
    });

    expect(screen.getByRole('heading', { level: 2, name: /Tasks & Milestones/i })).toBeTruthy();
    expect(screen.getByText('Write Terraform Scripts')).toBeTruthy();
    expect(screen.getByText('Unassigned')).toBeTruthy();
    expect(screen.getByText('In Progress')).toBeTruthy();
    unmount();

    // 2. Empty state
    projectsApi.get.mockResolvedValueOnce(mockOpenProject);
    tasksApi.list.mockResolvedValueOnce([]);
    adminApi.getProjectEscrow.mockResolvedValueOnce(null);

    renderComponent('proj-open-1');
    await waitFor(() => {
      expect(screen.getByText('No tasks yet')).toBeTruthy();
    });
  });

  it('segmented tabs switch between Overview & Tasks and Escrow & Financials under the same header', async () => {
    projectsApi.get.mockResolvedValue(mockOpenProject);
    tasksApi.list.mockResolvedValue([]);
    adminApi.getProjectEscrow.mockResolvedValue({
      ok: true,
      totals: { ownerPaid: 5000, inEscrow: 2000, mentorPayout: 2500, refunds: 0, platformFee: 500 },
      sessions: [{ sessionId: 'sess-100', mentorName: 'Neha Gupta', status: 'completed', held: 2000, released: 2500, refunded: 0, platformFee: 500 }],
    });

    renderComponent('proj-open-1');

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: /Project details/i })).toBeTruthy();
    });

    // Overview & Tasks is initially active
    expect(screen.getByRole('tab', { name: /Overview & Tasks/i }).getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByTestId('admin-project-escrow-panel')).toBeNull();

    // Switch to Escrow & Financials tab
    const escrowTab = screen.getByTestId('admin-project-escrow-tab');
    fireEvent.click(escrowTab);

    // Escrow panel appears
    const panel = await screen.findByTestId('admin-project-escrow-panel');
    expect(panel).toBeTruthy();
    expect(panel.textContent).toContain('Project Escrow Ledger');
    expect(panel.textContent).toContain('Reconciled');
    expect(panel.textContent).toContain('5,000');

    // Header remains visible
    expect(screen.getByRole('heading', { level: 1, name: /Cloud Orchestration Platform/i })).toBeTruthy();
    expect(screen.getByTestId('admin-delete-project-btn')).toBeTruthy();

    // Switch back to Overview & Tasks
    fireEvent.click(screen.getByRole('tab', { name: /Overview & Tasks/i }));
    expect(await screen.findByRole('heading', { level: 2, name: /Project details/i })).toBeTruthy();
    expect(screen.queryByTestId('admin-project-escrow-panel')).toBeNull();
  });

  it('Delete Project button opens the DeleteProjectDialog and retains existing behavior', async () => {
    projectsApi.get.mockResolvedValue(mockOpenProject);
    tasksApi.list.mockResolvedValue([]);
    adminApi.getProjectEscrow.mockResolvedValue(null);

    renderComponent('proj-open-1');

    await waitFor(() => {
      expect(screen.getByTestId('admin-delete-project-btn')).toBeTruthy();
    });

    // Click Delete Project
    fireEvent.click(screen.getByTestId('admin-delete-project-btn'));

    // Modal dialog is opened
    await waitFor(() => {
      expect(screen.getByTestId('delete-project-modal')).toBeTruthy();
      expect(screen.getByTestId('confirm-delete-project-btn')).toBeTruthy();
    });
  });
});
