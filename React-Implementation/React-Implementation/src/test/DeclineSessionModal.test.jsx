import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import MentorRequests from '../pages/mentor/MentorRequests';
import mentorMarketplaceApi from '../services/mentorMarketplaceApi';
import projectsApi from '../services/projectsApi';
import { renderWithProviders } from './test-utils';

vi.mock('../services/mentorMarketplaceApi', () => ({
  default: {
    mentorSessions: vi.fn(),
    acceptSession: vi.fn(),
    declineSession: vi.fn(),
  },
}));

vi.mock('../services/projectsApi', () => ({
  default: {
    list: vi.fn(),
  },
}));

describe('Phase 4 - Mentor Decline Session Modal with Mandatory Reason (10 to 500 chars)', () => {
  const mockSession = {
    id: 'session-404',
    mentorId: 'mentor-1',
    studentId: 'user-2',
    projectId: 'proj-1',
    projectName: 'AI Study Planner',
    ownerName: 'Priya Patel',
    projectDescription: 'Need mentorship on model serving and pipeline optimization.',
    agreedPrice: 1500,
    status: 'escrow_funded',
    createdAt: '2026-11-01T10:00:00.000Z',
    respondBy: '2026-11-04T10:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mentorMarketplaceApi.mentorSessions.mockResolvedValue([mockSession]);
    projectsApi.list.mockResolvedValue([
      { id: 'proj-1', name: 'AI Study Planner', owner: 'Priya Patel', skills: ['React', 'Python'] },
    ]);
  });

  it('opens decline modal, enforces 10 to 500 chars reason, and submits to declineSession API', async () => {
    mentorMarketplaceApi.declineSession.mockResolvedValue({
      id: 'session-404',
      status: 'refunded',
      declineReason: 'Currently at full capacity with existing mentees and unable to take new projects.',
      declinedBy: 'mentor',
    });

    renderWithProviders(<MentorRequests />);

    await waitFor(() => {
      expect(screen.getByText('AI Study Planner')).toBeDefined();
    });

    // Decline button on the row
    const declineBtn = screen.getByRole('button', { name: /Decline/i });
    fireEvent.click(declineBtn);

    // Modal opens
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Decline Mentorship Booking/i })).toBeDefined();
    });

    const reasonInput = screen.getByLabelText(/Decline Reason/i);
    const confirmBtn = screen.getByRole('button', { name: /Confirm Decline & Refund/i });

    // Confirm button is initially disabled (length < 10)
    expect(confirmBtn.hasAttribute('disabled')).toBe(true);

    // Type short reason (< 10 chars)
    fireEvent.change(reasonInput, { target: { value: 'Too busy' } });
    expect(confirmBtn.hasAttribute('disabled')).toBe(true);

    // Type valid reason (>= 10 chars)
    const validReason = 'Currently at full capacity with existing mentees and unable to take new projects.';
    fireEvent.change(reasonInput, { target: { value: validReason } });
    expect(confirmBtn.hasAttribute('disabled')).toBe(false);

    // Click confirm decline
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mentorMarketplaceApi.declineSession).toHaveBeenCalledWith(
        'session-404',
        expect.objectContaining({
          reason: validReason,
        }),
      );
    });

    // Modal closes and row reflects refunded state and reason
    await waitFor(() => {
      expect(screen.getByText(/Declined \(Refunded\)/i)).toBeDefined();
      expect(screen.getByText(new RegExp(validReason, 'i'))).toBeDefined();
    });
  });
});
