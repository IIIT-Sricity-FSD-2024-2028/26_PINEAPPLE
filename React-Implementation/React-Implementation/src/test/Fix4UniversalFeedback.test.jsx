import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useReasonAction } from '../hooks/useReasonAction';
import FeedbackHistory from '../components/features/FeedbackHistory';
import feedbackApi from '../services/feedbackApi';

// Test component integrating useReasonAction and FeedbackHistory
const TestHarness = ({ onActionSubmit, initialHistory = [] }) => {
  const { requestReason, renderModal } = useReasonAction();
  const [history, setHistory] = vi.importActual ? [initialHistory, () => {}] : [initialHistory, () => {}];

  const handleTriggerAction = async (actionType) => {
    try {
      const result = await requestReason({
        actionType,
        title: 'Custom Action Title',
        entityName: 'Alpha Deliverable',
        onConfirm: async (payload) => {
          return onActionSubmit(payload);
        },
      });
      return result;
    } catch {}
  };

  return (
    <div>
      <button
        type="button"
        data-testid="trigger-reject-btn"
        onClick={() => handleTriggerAction('REJECT_WORK')}
      >
        Reject Work
      </button>

      <button
        type="button"
        data-testid="trigger-decline-btn"
        onClick={() => handleTriggerAction('DECLINE_INVITATION')}
      >
        Decline Invitation
      </button>

      {renderModal()}

      <FeedbackHistory
        entityType="TASK"
        entityId="test-task-1"
        initialFeedback={initialHistory}
      />
    </div>
  );
};

describe('FIX 4: Universal Action Reason and Feedback Integration', () => {
  const mockSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(feedbackApi, 'getFeedbackReasons').mockResolvedValue({
      DECLINE_INVITATION: {
        actionType: 'DECLINE_INVITATION',
        title: 'Custom Action Title',
        description: 'Select the reasons why you are declining this invitation.',
        confirmLabel: 'Confirm Decline',
        minReasons: 1,
        explanationRequired: false,
        reasons: [{ id: 'CURRENTLY_UNAVAILABLE', label: 'Currently Unavailable' }],
      },
      REJECT_WORK: {
        actionType: 'REJECT_WORK',
        title: 'Reject Task Submission',
        description: 'Select the reasons for rejecting this task submission.',
        confirmLabel: 'Confirm Rejection',
        minReasons: 1,
        explanationRequired: true,
        explanationMin: 10,
        explanationMax: 500,
        reasons: [{ id: 'INCOMPLETE_WORK', label: 'Incomplete Work' }],
      },
    });
  });

  it('triggers action reason flow through hook, enforces rules, and submits structured feedback', async () => {
    mockSubmit.mockResolvedValueOnce({ success: true });

    render(<TestHarness onActionSubmit={mockSubmit} />);

    // Click trigger button
    fireEvent.click(screen.getByTestId('trigger-decline-btn'));

    // Modal opens
    expect(await screen.findByText('Custom Action Title')).toBeDefined();
    expect(screen.getByText('Alpha Deliverable')).toBeDefined();

    // Select reason
    const chip = await screen.findByTestId('reason-chip-CURRENTLY_UNAVAILABLE');
    fireEvent.click(chip);

    // Add explanation
    const textarea = screen.getByTestId('universal-reason-textarea');
    fireEvent.change(textarea, { target: { value: 'Committed to ongoing research grant.' } });

    // Confirm
    const confirmBtn = screen.getByTestId('universal-reason-confirm-btn');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith({
        reasons: ['CURRENTLY_UNAVAILABLE'],
        explanation: 'Committed to ongoing research grant.',
      });
    });
  });

  it('requires 10 to 500 characters explanation for REJECT_WORK action', async () => {
    mockSubmit.mockResolvedValueOnce({ success: true });

    render(<TestHarness onActionSubmit={mockSubmit} />);

    fireEvent.click(screen.getByTestId('trigger-reject-btn'));

    const chip = await screen.findByTestId('reason-chip-INCOMPLETE_WORK');
    fireEvent.click(chip);

    const confirmBtn = screen.getByTestId('universal-reason-confirm-btn');
    expect(confirmBtn.hasAttribute('disabled')).toBe(true);

    const textarea = screen.getByTestId('universal-reason-textarea');
    fireEvent.change(textarea, { target: { value: 'Code does not pass unit test assertions.' } });

    expect(confirmBtn.hasAttribute('disabled')).toBe(false);
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith({
        reasons: ['INCOMPLETE_WORK'],
        explanation: 'Code does not pass unit test assertions.',
      });
    });
  });
});
