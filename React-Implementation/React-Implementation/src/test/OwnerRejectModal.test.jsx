import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import OwnedWorkspace from '../pages/owner/OwnedWorkspace';
import joinRequestsApi from '../services/joinRequestsApi';
import projectsApi from '../services/projectsApi';
import tasksApi from '../services/tasksApi';
import communicationApi from '../services/communicationApi';
import { renderWithProviders } from './test-utils';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ projectId: 'proj-100' }),
    useNavigate: () => vi.fn(),
  };
});

vi.mock('../services/projectsApi', () => ({
  default: {
    get: vi.fn(),
    complete: vi.fn(),
    removeMember: vi.fn(),
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

describe('Phase 3 - Owner Decline Join Request Modal with Reason Requirement', () => {
  const mockProject = {
    id: 'proj-100',
    title: 'Autonomous Drone Navigation',
    description: 'Computer vision and ROS flight control system.',
    owner: 'Priya Patel',
    ownerId: '1',
    collaborators: [],
    status: 'In Progress',
  };

  const mockPendingRequest = {
    id: 'req-50',
    projectId: 'proj-100',
    userId: 'user-77',
    userName: 'Kavita Rao',
    role: 'Collaborator',
    message: 'I have 2 years of ROS experience and would love to help.',
    status: 'Pending',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    projectsApi.get.mockResolvedValue(mockProject);
    tasksApi.list.mockResolvedValue([]);
    joinRequestsApi.list.mockResolvedValue([mockPendingRequest]);
    communicationApi.getMessages.mockResolvedValue([]);
  });

  it('opens decline modal, enforces 10 to 500 characters written reason, and calls respond API', async () => {
    renderWithProviders(<OwnedWorkspace />);

    await waitFor(() => {
      expect(screen.getByText('Autonomous Drone Navigation')).toBeDefined();
    });

    // Switch to Members tab
    const membersTab = screen.getByRole('tab', { name: /Members/i });
    fireEvent.click(membersTab);

    // Verify Pending Join Request card is shown
    await waitFor(() => {
      expect(screen.getByText('Kavita Rao')).toBeDefined();
    });

    // Click "Decline" on the join request card
    const declineBtn = screen.getByRole('button', { name: 'Decline' });
    fireEvent.click(declineBtn);

    // Modal opens
    await waitFor(() => {
      expect(screen.getByText('Decline Join Request')).toBeDefined();
    });
    expect(screen.getByText(/Decline join request from/)).toBeDefined();

    // Confirm Decline button is initially disabled (empty reason < 10 chars)
    const confirmDeclineBtn = screen.getByRole('button', { name: 'Confirm Decline' });
    expect(confirmDeclineBtn.hasAttribute('disabled')).toBe(true);

    const reasonInput = screen.getByPlaceholderText(/Explain why this request is declined/);
    expect(reasonInput).toBeDefined();

    // Type 6 chars -> still disabled
    fireEvent.change(reasonInput, { target: { value: 'Too low' } });
    expect(confirmDeclineBtn.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('7 / 500 characters (min 10)')).toBeDefined();

    // Type valid reason (>= 10 chars)
    const validReason = 'We currently need someone with advanced C++ experience for real-time control.';
    fireEvent.change(reasonInput, { target: { value: validReason } });

    expect(confirmDeclineBtn.hasAttribute('disabled')).toBe(false);
    expect(screen.getByText(`${validReason.length} / 500 characters (min 10)`)).toBeDefined();

    // Mock successful response
    joinRequestsApi.respond.mockResolvedValue({ id: 'req-50', status: 'rejected', rejectionReason: validReason });

    // Submit
    fireEvent.click(confirmDeclineBtn);

    await waitFor(() => {
      expect(joinRequestsApi.respond).toHaveBeenCalledWith('req-50', 'rejected', { reason: validReason });
    });
  });
});
