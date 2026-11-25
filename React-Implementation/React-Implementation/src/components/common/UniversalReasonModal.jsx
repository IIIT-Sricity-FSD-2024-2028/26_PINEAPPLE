import { useState, useEffect, useMemo, useId } from 'react';
import Modal from './Modal';
import feedbackApi, { OTHER_REASON_ID } from '../../services/feedbackApi';
import './UniversalReasonModal.css';

export const FALLBACK_ACTION_CONFIGS = {
  REJECT_WORK: {
    actionType: 'REJECT_WORK',
    title: 'Reject Task Submission',
    description: 'Select the reasons for rejecting this task submission and provide required revision instructions.',
    confirmLabel: 'Confirm Rejection',
    placeholder: 'Explain what issues were found and what needs to be fixed (10 to 500 characters)...',
    minReasons: 1,
    explanationRequired: true,
    explanationMin: 10,
    explanationMax: 500,
    reasons: [],
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
    reasons: [],
  },
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
    reasons: [],
  },
  REJECT_APPLICATION: {
    actionType: 'REJECT_APPLICATION',
    title: 'Decline Join Request',
    description: 'Select the reasons for declining this application and provide constructive feedback.',
    confirmLabel: 'Confirm Decline',
    placeholder: 'Explain why this request is declined (10 to 500 characters)...',
    minReasons: 1,
    explanationRequired: false,
    explanationMin: 10,
    explanationMax: 500,
    reasons: [],
  },
  REMOVE_COLLABORATOR: {
    actionType: 'REMOVE_COLLABORATOR',
    title: 'Remove Team Member',
    description: 'Select the reasons for removing this collaborator from the project.',
    confirmLabel: 'Confirm Remove',
    placeholder: 'Explain why this member is being removed (minimum 10 characters)...',
    minReasons: 1,
    explanationRequired: false,
    explanationMin: 10,
    explanationMax: 500,
    reasons: [],
  },
  CANCEL_PROJECT: {
    actionType: 'CANCEL_PROJECT',
    title: 'Close / Cancel Project',
    description: 'Select the reasons for closing or cancelling this project.',
    confirmLabel: 'Confirm Closure',
    placeholder: 'Optional explanation...',
    minReasons: 1,
    explanationRequired: false,
    explanationMin: 0,
    explanationMax: 500,
    reasons: [],
  },
  DELETE_PROJECT: {
    actionType: 'DELETE_PROJECT',
    title: 'Delete Project',
    description: 'Select the reasons for deleting this project.',
    confirmLabel: 'Delete Project',
    placeholder: 'Explain why you are deleting this project (10 to 500 characters)...',
    minReasons: 1,
    explanationRequired: false,
    explanationMin: 0,
    explanationMax: 500,
    reasons: [
      { id: 'CREATED_BY_MISTAKE', label: 'Created by mistake' },
      { id: 'DUPLICATE_PROJECT', label: 'Duplicate project' },
      { id: 'PROJECT_NO_LONGER_REQUIRED', label: 'Project no longer required' },
      { id: 'LACK_OF_RESOURCES', label: 'Lack of resources' },
      { id: 'CHANGE_IN_PROJECT_DIRECTION', label: 'Change in project direction' },
      { id: 'INSUFFICIENT_PARTICIPATION', label: 'Insufficient participation' },
      { id: 'OTHER', label: 'Other' },
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
    reasons: [],
  },
  UNASSIGN_FROM_TASK: {
    actionType: 'UNASSIGN_FROM_TASK',
    title: 'Unassign Task',
    description: 'Select the reasons for unassigning this task from collaborator.',
    confirmLabel: 'Confirm Unassign',
    placeholder: 'Explain why collaborator is being unassigned...',
    minReasons: 1,
    explanationRequired: false,
    explanationMin: 0,
    explanationMax: 500,
    reasons: [],
  },
  LEAVE_PROJECT: {
    actionType: 'LEAVE_PROJECT',
    title: 'Leave Project',
    description: 'Select the reasons why you are leaving this project.',
    confirmLabel: 'Confirm Leave Project',
    placeholder: 'Explanation of your departure (minimum 10 characters)...',
    minReasons: 1,
    explanationRequired: false,
    explanationMin: 10,
    explanationMax: 500,
    reasons: [],
  },
  WITHDRAW_APPLICATION: {
    actionType: 'WITHDRAW_APPLICATION',
    title: 'Withdraw Application',
    description: 'Select the reasons for withdrawing your application.',
    confirmLabel: 'Confirm Withdraw',
    placeholder: 'Optional explanation...',
    minReasons: 1,
    explanationRequired: false,
    explanationMin: 0,
    explanationMax: 500,
    reasons: [],
  },
  CANCEL_INVITATION: {
    actionType: 'CANCEL_INVITATION',
    title: 'Cancel Invitation',
    description: 'Select the reasons for cancelling this invitation.',
    confirmLabel: 'Cancel Invitation',
    placeholder: 'Optional explanation...',
    minReasons: 1,
    explanationRequired: false,
    explanationMin: 0,
    explanationMax: 500,
    reasons: [],
  },
  MENTOR_DECLINE_ASSIGNMENT: {
    actionType: 'MENTOR_DECLINE_ASSIGNMENT',
    title: 'Decline Mentorship Booking',
    description: 'Select reasons for declining mentorship booking.',
    confirmLabel: 'Confirm Decline & Refund',
    placeholder: 'Explain why you cannot take on this mentorship...',
    minReasons: 1,
    explanationRequired: false,
    explanationMin: 10,
    explanationMax: 500,
    reasons: [],
  },
  STUDENT_CANCEL_MENTORSHIP: {
    actionType: 'STUDENT_CANCEL_MENTORSHIP',
    title: 'Cancel Mentorship Session',
    description: 'Select reasons for cancelling mentorship session.',
    confirmLabel: 'Confirm Cancellation',
    placeholder: 'Optional explanation...',
    minReasons: 1,
    explanationRequired: false,
    explanationMin: 0,
    explanationMax: 500,
    reasons: [],
  },
  ADMIN_REJECT_MENTOR_APP: {
    actionType: 'ADMIN_REJECT_MENTOR_APP',
    title: 'Reject Mentor Application',
    description: 'Select reasons for rejecting this mentor application.',
    confirmLabel: 'Confirm Rejection',
    placeholder: 'Provide constructive feedback for the applicant...',
    minReasons: 1,
    explanationRequired: false,
    explanationMin: 0,
    explanationMax: 500,
    reasons: [],
  },
  REJECT_LEAVE_REQUEST: {
    actionType: 'REJECT_LEAVE_REQUEST',
    title: 'Reject Leave Request',
    description: 'Select reasons for rejecting this leave request and explain why the collaborator should stay.',
    confirmLabel: 'Confirm Rejection',
    placeholder: 'Explanation for rejecting this leave request (required, 10 to 500 characters)...',
    minReasons: 1,
    explanationRequired: true,
    explanationMin: 10,
    explanationMax: 500,
    reasons: [
      { id: 'CRITICAL_PROJECT_PHASE', label: 'Critical Project Phase' },
      { id: 'PENDING_DELIVERABLES', label: 'Pending Deliverables' },
      { id: 'NO_REPLACEMENT_AVAILABLE', label: 'No Replacement Available' },
      { id: 'TASKS_IN_PROGRESS', label: 'Tasks Currently In Progress' },
      { id: 'DEADLINE_APPROACHING', label: 'Project Deadline Approaching' },
      { id: 'OTHER', label: 'Other' },
    ],
  },
};

/**
 * Universal Action Reason & Feedback Modal (Fix 4).
 * Inspired by Amazon return reasons flow:
 * - Central modal for Reject, Decline, Remove, Withdraw, Cancel actions
 * - Fetches reason configuration dynamically from GET /feedback/reasons
 * - Enforces minimum reasons, OTHER explanation requirements, and 10-500 char work rejection explanations
 * - Preserves user input on submission error
 */
const UniversalReasonModal = ({
  isOpen,
  onClose,
  onConfirm,
  actionType,
  title: customTitle,
  description: customDescription,
  confirmLabel: customConfirmLabel,
  entityName,
  initialReasons = [],
  initialExplanation = '',
}) => {
  const [configs, setConfigs] = useState(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configError, setConfigError] = useState(null);

  const [selectedReasons, setSelectedReasons] = useState(initialReasons);
  const [explanation, setExplanation] = useState(initialExplanation);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState(null);

  const textareaId = useId();

  // Load config when opened
  useEffect(() => {
    if (!isOpen) {
      setSelectedReasons(initialReasons);
      setExplanation(initialExplanation);
      setActionError(null);
      return;
    }

    let isMounted = true;
    setConfigLoading(true);
    setConfigError(null);

    feedbackApi
      .getFeedbackReasons()
      .then((data) => {
        if (!isMounted) return;
        const actionMap = data?.actions || data || {};
        setConfigs(actionMap);
        setConfigLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        // Fall back gracefully to built-in configs
        setConfigs(FALLBACK_ACTION_CONFIGS);
        setConfigLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, actionType]);

  const currentConfig = useMemo(() => {
    const key = String(actionType || '').toUpperCase().trim();
    if (configs && configs[key]) {
      return configs[key];
    }
    return FALLBACK_ACTION_CONFIGS[key] || null;
  }, [configs, actionType]);

  const reasonsList = useMemo(() => {
    return currentConfig?.reasons || [];
  }, [currentConfig]);

  const isOtherSelected = useMemo(() => {
    return selectedReasons.includes(OTHER_REASON_ID);
  }, [selectedReasons]);

  const isWorkRejection = useMemo(() => {
    return (
      actionType === 'REJECT_WORK' ||
      actionType === 'REQUEST_CHANGES' ||
      currentConfig?.explanationRequired === true
    );
  }, [actionType, currentConfig]);

  const trimmedExplanation = explanation.trim();

  // Validation
  const minReasons = currentConfig?.minReasons || 1;
  const hasMinReasons = selectedReasons.length >= minReasons;

  const minExplanationLength = isWorkRejection ? (currentConfig?.explanationMin || 10) : 0;
  const maxExplanationLength = currentConfig?.explanationMax || 500;

  const isExplanationValid = useMemo(() => {
    if (trimmedExplanation.length > maxExplanationLength) {
      return false;
    }
    if (isWorkRejection) {
      return trimmedExplanation.length >= minExplanationLength;
    }
    if (isOtherSelected) {
      return trimmedExplanation.length > 0;
    }
    return true;
  }, [isWorkRejection, isOtherSelected, trimmedExplanation, minExplanationLength, maxExplanationLength]);

  const isValid = hasMinReasons && isExplanationValid;

  const toggleReason = (reasonId) => {
    setSelectedReasons((prev) => {
      if (prev.includes(reasonId)) {
        return prev.filter((id) => id !== reasonId);
      } else {
        return [...prev, reasonId];
      }
    });
    setActionError(null);
  };

  const handleExplanationChange = (e) => {
    setExplanation(e.target.value);
    setActionError(null);
  };

  const handleConfirm = async () => {
    if (!isValid || submitting) return;

    setSubmitting(true);
    setActionError(null);

    try {
      await onConfirm({
        reasons: selectedReasons,
        explanation: trimmedExplanation || undefined,
      });
      setSubmitting(false);
      onClose();
    } catch (err) {
      setSubmitting(false);
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'An error occurred while processing your request.';
      setActionError(Array.isArray(msg) ? msg.join(', ') : msg);
    }
  };

  const modalTitle = customTitle || currentConfig?.title || 'Provide Reason';
  const modalDesc =
    customDescription ||
    currentConfig?.description ||
    'Please select the reason for this action.';
  const confirmBtnLabel =
    customConfirmLabel || currentConfig?.confirmLabel || 'Confirm';

  return (
    <Modal
      isOpen={isOpen}
      title={modalTitle}
      onClose={onClose}
      closeDisabled={submitting}
      size="md"
      testId="universal-reason-modal"
      footer={
        <div className="tf-reason-modal-actions">
          <button
            type="button"
            className="tf-reason-btn tf-reason-btn--secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="tf-reason-btn tf-reason-btn--primary"
            onClick={handleConfirm}
            disabled={!isValid || submitting}
            data-testid="universal-reason-confirm-btn"
          >
            {submitting ? 'Processing...' : confirmBtnLabel}
          </button>
        </div>
      }
    >
      <div className="tf-reason-modal-body">
        {entityName && (
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary, #4b5563)' }}>
            Target: <span style={{ color: 'var(--text-primary, #111827)' }}>{entityName}</span>
          </div>
        )}

        <p className="tf-reason-modal-desc">{modalDesc}</p>

        {configError && (
          <div className="tf-reason-error-banner" role="alert">
            <span>⚠️</span>
            <span>{configError}</span>
          </div>
        )}

        {actionError && (
          <div className="tf-reason-error-banner" role="alert">
            <span>⚠️</span>
            <span>{actionError}</span>
          </div>
        )}

        <div className="tf-reason-section">
          <div className="tf-reason-section-title">
            <span>Select Reasons</span>
            <span className="tf-reason-required-badge">Required</span>
          </div>
          <div className="tf-reason-chips" role="group" aria-label="Reason options">
            {reasonsList.map((reason) => {
              const isSelected = selectedReasons.includes(reason.id);
              return (
                <button
                  key={reason.id}
                  type="button"
                  className={`tf-reason-chip ${isSelected ? 'selected' : ''}`}
                  onClick={() => toggleReason(reason.id)}
                  aria-pressed={isSelected}
                  disabled={submitting}
                  data-testid={`reason-chip-${reason.id}`}
                >
                  <span>{isSelected ? '✓' : '+'}</span>
                  <span>{reason.label}</span>
                </button>
              );
            })}
          </div>
          {!hasMinReasons && (
            <p className="tf-reason-help-text required">
              Please select at least {minReasons} reason tag.
            </p>
          )}
        </div>

        <div className="tf-reason-explanation-wrap">
          <div className="tf-reason-explanation-header">
            <label htmlFor={textareaId}>
              Detailed Explanation
              {(isOtherSelected || isWorkRejection) && (
                <span style={{ color: '#dc2626', marginLeft: '4px' }}>*</span>
              )}
            </label>
            <span
              className={`tf-reason-char-count ${
                trimmedExplanation.length > maxExplanationLength
                  ? 'error'
                  : trimmedExplanation.length >= maxExplanationLength - 20
                  ? 'warning'
                  : ''
              }`}
            >
              {trimmedExplanation.length} / {maxExplanationLength}
            </span>
          </div>
          <textarea
            id={textareaId}
            className={`tf-reason-textarea ${
              (!isExplanationValid && (isOtherSelected || isWorkRejection)) ? 'invalid' : ''
            }`}
            placeholder={
              currentConfig?.placeholder ||
              'Add any additional notes or details (optional unless required)...'
            }
            value={explanation}
            onChange={handleExplanationChange}
            disabled={submitting}
            rows={3}
            maxLength={maxExplanationLength + 50}
            data-testid="universal-reason-textarea"
          />
          {isWorkRejection ? (
            <p className={`tf-reason-help-text ${trimmedExplanation.length < minExplanationLength ? 'required' : ''}`}>
              Please explain what needs to be changed so the collaborator can revise their work (minimum {minExplanationLength} characters).
            </p>
          ) : isOtherSelected ? (
            <p className={`tf-reason-help-text ${trimmedExplanation.length === 0 ? 'required' : ''}`}>
              An explanation is required when &quot;Other&quot; is selected.
            </p>
          ) : (
            <p className="tf-reason-help-text">
              Optional. Maximum {maxExplanationLength} characters.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default UniversalReasonModal;

