import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import AppliedProjects from '../pages/collaborator/AppliedProjects';
import joinRequestsApi from '../services/joinRequestsApi';
import projectsApi from '../services/projectsApi';
import { renderWithProviders } from './test-utils';

vi.mock('../services/joinRequestsApi', () => ({
  default: {
    getMyRequests: vi.fn(),
    list: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('../services/projectsApi', () => ({
  default: {
    list: vi.fn(),
  },
  isProjectLocked: vi.fn(() => false),
}));

describe('Phase 3 - AppliedProjects Rejection Reason & Request Count UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders table displaying status badges, rejection reasons, and remaining requests', async () => {
    const mockRequests = [
      {
        id: 'req-1',
        projectId: 'proj-1',
        projectName: 'AI Study Assistant',
        owner: 'Priya Patel',
        status: 'pending',
        createdAt: '2026-11-01T10:00:00Z',
        requestsUsed: 1,
        requestsLeft: 1,
      },
      {
        id: 'req-2',
        projectId: 'proj-2',
        projectName: 'Smart Campus Shuttle',
        owner: 'Arjun Sharma',
        status: 'rejected',
        rejectionReason: 'Need more experience with mobile development and Flutter.',
        createdAt: '2026-11-02T10:00:00Z',
        requestsUsed: 1,
        requestsLeft: 1,
      },
      {
        id: 'req-3',
        projectId: 'proj-3',
        projectName: 'Blockchain Voting',
        owner: 'Vikram Nair',
        status: 'rejected',
        rejectionReason: 'Position filled by another candidate.',
        createdAt: '2026-11-03T10:00:00Z',
        requestsUsed: 2,
        requestsLeft: 0,
      },
      {
        id: 'req-4',
        projectId: 'proj-4',
        projectName: 'Dorm Room Marketplace',
        owner: 'Sneha Iyer',
        status: 'system_closed',
        createdAt: '2026-11-04T10:00:00Z',
        requestsUsed: 0,
        requestsLeft: 2,
      },
    ];

    const mockProjects = [
      { id: 'proj-1', title: 'AI Study Assistant', owner: 'Priya Patel' },
      { id: 'proj-2', title: 'Smart Campus Shuttle', owner: 'Arjun Sharma' },
      { id: 'proj-3', title: 'Blockchain Voting', owner: 'Vikram Nair' },
      { id: 'proj-4', title: 'Dorm Room Marketplace', owner: 'Sneha Iyer' },
    ];

    joinRequestsApi.getMyRequests.mockResolvedValue(mockRequests);
    projectsApi.list.mockResolvedValue(mockProjects);

    renderWithProviders(<AppliedProjects />);

    // 1. Pending application shows "Request pending" badge and "Delete Request" button
    await waitFor(() => {
      expect(screen.getByText('AI Study Assistant')).toBeDefined();
    });
    expect(screen.getByText('Request pending')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Delete Request' })).toBeDefined();

    // 2. First rejection shows "Rejected (1 request left)" and the owner reason
    expect(screen.getByText('Rejected (1 request left)')).toBeDefined();
    expect(screen.getByText(/Need more experience with mobile development/)).toBeDefined();

    // 3. Second rejection shows "Request rejected" tag and the rejection reason
    expect(screen.getByText('Request rejected')).toBeDefined();
    expect(screen.getByText(/Position filled by another candidate/)).toBeDefined();

    // 4. System closed request shows "System Closed" badge
    expect(screen.getByText('System Closed')).toBeDefined();
  });
});
