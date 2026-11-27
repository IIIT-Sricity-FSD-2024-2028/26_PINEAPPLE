import { screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FeedbackHistory from '../components/features/FeedbackHistory';
import feedbackApi from '../services/feedbackApi';
import { renderWithStore } from './test-utils';

describe('FeedbackHistory (Fix 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders history entries with badges, reason tags, and explanation', () => {
    const mockFeedback = [
      {
        id: 'fb-1',
        actionType: 'REQUEST_CHANGES',
        reasons: ['INCOMPLETE_WORK', 'INSUFFICIENT_TESTING'],
        reasonLabels: ['Incomplete Work', 'Insufficient Testing'],
        explanation: 'Unit tests for edge cases are missing. Please add them.',
        createdAt: '2026-11-13T10:00:00.000Z',
      },
      {
        id: 'fb-2',
        actionType: 'DROP_TASK',
        reasons: ['INSUFFICIENT_TIME'],
        reasonLabels: ['Insufficient Time'],
        explanation: 'Semester examinations next week.',
        createdAt: '2026-11-12T15:30:00.000Z',
      },
    ];

    renderWithStore(
      <FeedbackHistory
        entityType="TASK"
        entityId="task-101"
        initialFeedback={mockFeedback}
        title="Task Audit Feedback"
      />
    );

    expect(screen.getByText('Task Audit Feedback')).toBeDefined();

    // Badges
    expect(screen.getByText('Changes Requested')).toBeDefined();
    expect(screen.getByText('Task Dropped')).toBeDefined();

    // Reason tags
    expect(screen.getByText('Incomplete Work')).toBeDefined();
    expect(screen.getByText('Insufficient Testing')).toBeDefined();
    expect(screen.getByText('Insufficient Time')).toBeDefined();

    // Explanations
    expect(screen.getByText(/Unit tests for edge cases are missing/)).toBeDefined();
    expect(screen.getByText(/Semester examinations next week/)).toBeDefined();
  });

  it('fetches feedback from feedbackApi when initialFeedback is not provided', async () => {
    vi.spyOn(feedbackApi, 'getEntityFeedback').mockResolvedValueOnce([
      {
        id: 'fb-3',
        actionType: 'REJECT_APPLICATION',
        reasons: ['REQUIRED_SKILLS_NOT_MATCHED'],
        reasonLabels: ['Required Skills Not Matched'],
        explanation: 'We require senior-level experience in PyTorch.',
        createdAt: '2026-11-13T09:00:00.000Z',
      },
    ]);

    renderWithStore(
      <FeedbackHistory
        entityType="APPLICATION"
        entityId="app-50"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Application Rejected')).toBeDefined();
      expect(screen.getByText('Required Skills Not Matched')).toBeDefined();
      expect(screen.getByText(/We require senior-level experience in PyTorch/)).toBeDefined();
    });

    expect(feedbackApi.getEntityFeedback).toHaveBeenCalledWith('APPLICATION', 'app-50');
  });

  it('renders nothing when history is empty', async () => {
    vi.spyOn(feedbackApi, 'getEntityFeedback').mockResolvedValueOnce([]);

    const { container } = renderWithStore(
      <FeedbackHistory
        entityType="TASK"
        entityId="empty-task"
      />
    );

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });
});
