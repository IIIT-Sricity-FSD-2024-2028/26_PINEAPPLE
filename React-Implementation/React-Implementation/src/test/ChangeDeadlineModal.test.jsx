import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import OwnedWorkspace from '../pages/owner/OwnedWorkspace';
import projectsApi from '../services/projectsApi';
import tasksApi from '../services/tasksApi';
import joinRequestsApi from '../services/joinRequestsApi';
import communicationApi from '../services/communicationApi';
import { renderWithProviders } from './test-utils';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ projectId: 'proj-400' }),
    useNavigate: () => vi.fn(),
  };
});

vi.mock('../services/projectsApi', () => ({
  default: {
    get: vi.fn(),
    complete: vi.fn(),
    removeMember: vi.fn(),
    changeDeadline: vi.fn(),
  },
  isProjectLocked: vi.fn(() => false),
}));

vi.mock('../services/tasksApi', () => ({
  default: {
    list: vi.fn(),
    create: vi.fn(),
    updateStatus: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../services/joinRequestsApi', () => ({
  default: {
    list: vi.fn(),
    respond: vi.fn(),
  },
}));

vi.mock('../services/communicationApi', () => ({
  default: {
    getMessages: vi.fn(),
    sendMessage: vi.fn(),
  },
}));

describe('Phase 4 - Change Project Deadline Modal & Validation in OwnedWorkspace', () => {
  const mockProject = {
    id: 'proj-400',
    title: 'Distributed File Storage',
    description: 'P2P decentralized file sharing network.',
    owner: 'Priya Patel',
    ownerId: '1',
    dueDate: '2028-06-01T00:00:00.000Z',
    collaborators: [],
    status: 'In Progress',
  };

  const mockTasks = [
    {
      id: 'task-10',
      title: 'DHT Routing Protocol',
      status: 'In Progress',
      dueDate: '2028-04-15T00:00:00.000Z',
      priority: 'High',
      assigneeName: 'Arjun Sharma',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    projectsApi.get.mockResolvedValue(mockProject);
    tasksApi.list.mockResolvedValue(mockTasks);
    joinRequestsApi.list.mockResolvedValue([]);
    communicationApi.getMessages.mockResolvedValue([]);
  });

  it('opens Change Deadline modal, validates reason >= 10, and calls API', async () => {
    const newDeadline = '2028-09-30';
    const reason = 'Adding redundant parity blocks and extra fault tolerance testing.';

    projectsApi.changeDeadline.mockResolvedValue({
      id: 'proj-400',
      dueDate: new Date(newDeadline).toISOString(),
    });

    renderWithProviders(<OwnedWorkspace />);

    await waitFor(() => {
      expect(screen.getByText('Distributed File Storage')).toBeDefined();
    });

    // Click Change Deadline button
    const changeBtn = screen.getByRole('button', { name: /Change Deadline/i });
    fireEvent.click(changeBtn);

    // Modal opens
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Change Project Deadline/i })).toBeDefined();
    });

    const reasonInput = screen.getByLabelText(/Reason for changing deadline/i);
    const submitBtn = screen.getByRole('button', { name: /Update Deadline/i });

    // Submit button initially disabled because reason < 10 chars
    expect(submitBtn.hasAttribute('disabled')).toBe(true);

    // Type short reason (< 10 chars)
    fireEvent.change(reasonInput, { target: { value: 'Delays' } });
    expect(submitBtn.hasAttribute('disabled')).toBe(true);

    // Type valid reason
    fireEvent.change(reasonInput, { target: { value: reason } });
    expect(submitBtn.hasAttribute('disabled')).toBe(false);

    // Submit form
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(projectsApi.changeDeadline).toHaveBeenCalledWith('proj-400', expect.objectContaining({
        reason,
      }));
    });
  });
});
