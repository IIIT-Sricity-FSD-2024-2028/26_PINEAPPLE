import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import AdminProjects from '../pages/admin/AdminProjects';
import AdminProjectDetails from '../pages/admin/AdminProjectDetails';
import projectsApi from '../services/projectsApi';
import { renderWithProviders } from './test-utils';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ id: 'proj-1' }),
  };
});

vi.mock('../services/projectsApi', () => ({
  default: {
    list: vi.fn(),
    get: vi.fn(),
    close: vi.fn(),
  },
  isProjectLocked: vi.fn(() => false),
  isProjectActive: vi.fn(() => true),
}));

vi.mock('../services/adminApi', () => ({
  default: {
    listUsers: vi.fn(),
  },
  listUsers: vi.fn(),
  recordPortalAuditEntry: vi.fn(),
}));

describe('Phase 5 - Admin Projects Table and Details Difficulty Column', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders AdminProjects table WITHOUT Difficulty column', async () => {
    const mockProjects = [
      {
        id: 'proj-1',
        title: 'Quantum Computing Simulator',
        owner: 'Priya Patel',
        ownerId: '1',
        difficulty: 'Advanced',
        collaborators: [{ id: 'u-1', name: 'User 1' }],
        status: 'Active',
        progress: 45,
      },
    ];

    projectsApi.list.mockResolvedValueOnce(mockProjects);

    renderWithProviders(<AdminProjects />);

    await waitFor(() => {
      expect(screen.getByText('Quantum Computing Simulator')).toBeDefined();
    });

    // Headers present: Project, Owner, Collaborators, Status, Progress
    expect(screen.getByText('Project')).toBeDefined();
    expect(screen.getByText('Owner')).toBeDefined();
    expect(screen.getByText('Collaborators')).toBeDefined();
    expect(screen.getByText('Status')).toBeDefined();
    expect(screen.getByText('Progress')).toBeDefined();

    // Difficulty header and cell content should NOT be in the table
    expect(screen.queryByText('Difficulty')).toBeNull();
    expect(screen.queryByText('Advanced')).toBeNull();
  });

  it('renders AdminProjectDetails and RETAINS Difficulty meta information', async () => {
    const mockProject = {
      id: 'proj-1',
      title: 'Quantum Computing Simulator',
      description: 'Quantum circuits simulation tool in WebAssembly.',
      status: 'Open',
      difficulty: 'Advanced',
      dueDate: '2027-04-15T00:00:00.000Z',
      owner: { name: 'Priya Patel', id: '1' },
      members: [],
    };

    projectsApi.get.mockResolvedValueOnce(mockProject);

    renderWithProviders(<AdminProjectDetails />);

    await waitFor(() => {
      expect(screen.getByText('Quantum Computing Simulator')).toBeDefined();
    });

    // In project details, Difficulty label and value MUST be present
    expect(screen.getByText('Difficulty:')).toBeDefined();
    expect(screen.getByText('Advanced')).toBeDefined();
  });
});
