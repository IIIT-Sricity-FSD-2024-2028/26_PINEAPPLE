import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import UniversalReasonModal from '../components/common/UniversalReasonModal';
import feedbackApi from '../services/feedbackApi';

describe('UniversalReasonModal (Fix 4)', () => {
  const mockOnClose = vi.fn();
  const mockOnConfirm = vi.fn();

  const mockConfigData = {
    DECLINE_INVITATION: {
      actionType: 'DECLINE_INVITATION',
      title: 'Decline Project Invitation',
      description: 'Select the reasons why you are declining this invitation.',
      confirmLabel: 'Decline Invitation',
      placeholder: 'Optional explanation (required if Other is selected)...',
      minReasons: 1,
      explanationRequired: false,
      explanationMin: 0,
      explanationMax: 500,
      reasons: [
        { id: 'CURRENTLY_UNAVAILABLE', label: 'Currently Unavailable' },
        { id: 'OTHER', label: 'Other' },
      ],
    },
    REQUEST_CHANGES: {
      actionType: 'REQUEST_CHANGES',
      title: 'Request Changes on Task',
      description: 'Select the reasons and explain what changes are requested before this work can be approved.',
      confirmLabel: 'Send Back for Revision',
      placeholder: 'Explain what changes are needed so the collaborator can revise (10 to 500 characters)...',
      minReasons: 1,
      explanationRequired: true,
      explanationMin: 10,
      explanationMax: 500,
      reasons: [
        { id: 'INCOMPLETE_WORK', label: 'Incomplete Work' },
      ],
    },
    DROP_TASK: {
      actionType: 'DROP_TASK',
      title: 'Drop Task',
      description: 'Select the reasons for dropping this task.',
      confirmLabel: 'Confirm Drop Task',
      placeholder: 'Optional explanation (required if Other is selected)...',
      minReasons: 1,
      explanationRequired: false,
      explanationMin: 0,
      explanationMax: 500,
      reasons: [
        { id: 'INSUFFICIENT_TIME', label: 'Insufficient Time' },
      ],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(feedbackApi, 'getFeedbackReasons').mockResolvedValue(mockConfigData);
  });

  it('renders reason chips, enforces minReasons = 1, and submits valid selection', async () => {
    render(
      <UniversalReasonModal
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        actionType="DECLINE_INVITATION"
        entityName="Project Hyperion"
      />
    );

    // Header & Target info
    expect(await screen.findByText(/Decline Project Invitation/i)).toBeDefined();
    expect(screen.getByText('Project Hyperion')).toBeDefined();

    // Confirm button is disabled initially (no reasons selected)
    const confirmBtn = screen.getByTestId('universal-reason-confirm-btn');
    expect(confirmBtn.hasAttribute('disabled')).toBe(true);

    // Helper text for minimum reason tags
    expect(screen.getByText(/Please select at least 1 reason tag/i)).toBeDefined();

    // Select reason chip: CURRENTLY_UNAVAILABLE
    const reasonChip = await screen.findByTestId('reason-chip-CURRENTLY_UNAVAILABLE');
    fireEvent.click(reasonChip);

    // Confirm button should now be enabled
    expect(confirmBtn.hasAttribute('disabled')).toBe(false);

    // Submit
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockOnConfirm).toHaveBeenCalledWith({
        reasons: ['CURRENTLY_UNAVAILABLE'],
        explanation: undefined,
      });
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('requires explanation when OTHER is selected', async () => {
    render(
      <UniversalReasonModal
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        actionType="DECLINE_INVITATION"
      />
    );

    const confirmBtn = await screen.findByTestId('universal-reason-confirm-btn');
    const otherChip = await screen.findByTestId('reason-chip-OTHER');
    fireEvent.click(otherChip);

    // When OTHER is picked, explanation is strictly required
    expect(confirmBtn.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(/An explanation is required when "Other" is selected/i)).toBeDefined();

    // Type explanation
    const textarea = screen.getByTestId('universal-reason-textarea');
    fireEvent.change(textarea, { target: { value: 'Academic exam preparation period.' } });

    expect(confirmBtn.hasAttribute('disabled')).toBe(false);

    fireEvent.click(confirmBtn);
    await waitFor(() => {
      expect(mockOnConfirm).toHaveBeenCalledWith({
        reasons: ['OTHER'],
        explanation: 'Academic exam preparation period.',
      });
    });
  });

  it('enforces 10 to 500 characters explanation for work rejection (REJECT_WORK / REQUEST_CHANGES)', async () => {
    render(
      <UniversalReasonModal
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        actionType="REQUEST_CHANGES"
      />
    );

    const confirmBtn = await screen.findByTestId('universal-reason-confirm-btn');
    const reasonChip = await screen.findByTestId('reason-chip-INCOMPLETE_WORK');
    fireEvent.click(reasonChip);

    // Confirm button is disabled because explanation is < 10 chars
    expect(confirmBtn.hasAttribute('disabled')).toBe(true);
    expect(
      screen.getByText(/Please explain what needs to be changed so the collaborator can revise their work/i),
    ).toBeDefined();

    const textarea = screen.getByTestId('universal-reason-textarea');

    // Type 6 chars (<10)
    fireEvent.change(textarea, { target: { value: 'Fix it' } });
    expect(confirmBtn.hasAttribute('disabled')).toBe(true);

    // Type valid explanation (>=10 chars)
    fireEvent.change(textarea, {
      target: { value: 'Missing input sanitization on profile submission form.' },
    });
    expect(confirmBtn.hasAttribute('disabled')).toBe(false);

    fireEvent.click(confirmBtn);
    await waitFor(() => {
      expect(mockOnConfirm).toHaveBeenCalledWith({
        reasons: ['INCOMPLETE_WORK'],
        explanation: 'Missing input sanitization on profile submission form.',
      });
    });
  });

  it('preserves user input and displays error banner when submission fails', async () => {
    mockOnConfirm.mockRejectedValueOnce(new Error('Network connection timeout.'));

    render(
      <UniversalReasonModal
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        actionType="DROP_TASK"
      />
    );

    const chip = await screen.findByTestId('reason-chip-INSUFFICIENT_TIME');
    fireEvent.click(chip);

    const textarea = screen.getByTestId('universal-reason-textarea');
    fireEvent.change(textarea, { target: { value: 'Medical leave required.' } });

    const confirmBtn = screen.getByTestId('universal-reason-confirm-btn');
    fireEvent.click(confirmBtn);

    // Error banner appears without closing modal or losing typed input
    await waitFor(() => {
      expect(screen.getByText(/Network connection timeout/i)).toBeDefined();
    });

    expect(textarea.value).toBe('Medical leave required.');
    expect(mockOnClose).not.toHaveBeenCalled();
  });
});
