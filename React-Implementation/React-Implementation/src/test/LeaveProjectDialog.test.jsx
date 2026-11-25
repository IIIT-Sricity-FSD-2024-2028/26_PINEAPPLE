import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import CollaboratorWorkspace from '../pages/collaborator/CollaboratorWorkspace';
import projectsApi from '../services/projectsApi';
import tasksApi from '../services/tasksApi';
import communicationApi from '../services/communicationApi';
import { renderWithProviders } from './test-utils';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ projectId: 'proj-200' }),
    useNavigate: () => vi.fn(),
  };
});

vi.mock('../services/projectsApi', () => ({
  default: {
    get: vi.fn(),
    leave: vi.fn(),
  },
  isProjectLocked: vi.fn(() => false),
}));

vi.mock('../services/tasksApi', () => ({
  default: {
    list: vi.fn(),
    updateStatus: vi.fn(),
  },
}));

vi.mock('../services/communicationApi', () => ({
  default: {
    getMessages: vi.fn(),
    sendMessage: vi.fn(),
  },
}));

describe('Phase 3 - Leave Project Dialog with Policy Rules and Reason Category', () => {
  const mockProject = {
    id: 'proj-200',
    title: 'Decentralized Data Marketplace',
    description: 'Peer to peer marketplace for encrypted datasets.',
    owner: 'Arjun Sharma',
    ownerId: '2',
    collaborators: [{ id: 'user-collab-1', name: 'Collaborator One', role: 'Collaborator' }],
    status: 'In Progress',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    projectsApi.get.mockResolvedValue(mockProject);
    tasksApi.list.mockResolvedValue([]);
    communicationApi.getMessages.mockResolvedValue([]);
  });

  it('renders leave modal displaying policy rules, category choices, 10+ char validation, and submits payload', async () => {
    renderWithProviders(<CollaboratorWorkspace />);

    await waitFor(() => {
      expect(screen.getByText('Decentralized Data Marketplace')).toBeDefined();
    });

    // Click "Leave Project" button in workspace header
    const leaveBtn = screen.getByRole('button', { name: 'Leave Project' });
    fireEvent.click(leaveBtn);

    // Verify modal is open
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Leave Project' })).toBeDefined();
    });

    // Verify leaving policy rules are rendered
    expect(screen.getByText(/Project Leaving Policy:/)).toBeDefined();
    expect(screen.getByText(/Unapproved tasks assigned to you will return to/)).toBeDefined();
    expect(screen.getByText(/Approved work and XP will remain permanently on your profile/)).toBeDefined();
    expect(screen.getByText(/Re-applying to this project later consumes 1 of your 2 maximum requests/)).toBeDefined();

    // Verify category select exists with valid options
    const categorySelect = screen.getByLabelText(/Reason Category/i);
    expect(categorySelect).toBeDefined();
    expect(categorySelect.value).toBe('Too busy');

    // Change category to "Project not as described"
    fireEvent.change(categorySelect, { target: { value: 'Project not as described' } });
    expect(categorySelect.value).toBe('Project not as described');

    // Confirm button is initially disabled (empty explanation < 10 chars)
    const confirmLeaveBtn = screen.getByRole('button', { name: 'Confirm Leave' });
    expect(confirmLeaveBtn.hasAttribute('disabled')).toBe(true);

    const explanationInput = screen.getByPlaceholderText(/Please explain why you are leaving this project/);
    expect(explanationInput).toBeDefined();

    // Type 5 chars -> remains disabled
    fireEvent.change(explanationInput, { target: { value: 'Short' } });
    expect(confirmLeaveBtn.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('5 / 500 characters (min 10)')).toBeDefined();

    // Type valid explanation (>= 10 chars)
    const validExplanation = 'Project scope shifted toward Solidity which is not aligned with my goals.';
    fireEvent.change(explanationInput, { target: { value: validExplanation } });

    expect(confirmLeaveBtn.hasAttribute('disabled')).toBe(false);
    expect(screen.getByText(`${validExplanation.length} / 500 characters (min 10)`)).toBeDefined();

    // Mock leave API
    projectsApi.leave.mockResolvedValue({ success: true });

    // Submit
    fireEvent.click(confirmLeaveBtn);

    await waitFor(() => {
      expect(projectsApi.leave).toHaveBeenCalledWith('proj-200', {
        category: 'Project not as described',
        reason: validExplanation,
      });
    });
  });

  it('displays server error message when leave API call fails', async () => {
    projectsApi.leave.mockRejectedValue(new Error('Project is locked and cannot be left.'));

    renderWithProviders(<CollaboratorWorkspace />);

    await waitFor(() => {
      expect(screen.getByText('Decentralized Data Marketplace')).toBeDefined();
    });

    const leaveBtn = screen.getByRole('button', { name: 'Leave Project' });
    fireEvent.click(leaveBtn);

    const explanationInput = screen.getByPlaceholderText(/Please explain why you are leaving this project/);
    fireEvent.change(explanationInput, {
      target: { value: 'Unable to commit due to final exams schedule.' },
    });

    const confirmLeaveBtn = screen.getByRole('button', { name: 'Confirm Leave' });
    fireEvent.click(confirmLeaveBtn);

    await waitFor(() => {
      expect(screen.getByText('Project is locked and cannot be left.')).toBeDefined();
    });
  });
});
