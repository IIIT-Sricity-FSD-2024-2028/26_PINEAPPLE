import { useState, useEffect, useMemo, useId } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Modal from './Modal';
import { OTHER_REASON_ID } from '../../constants/feedbackConfig';
import { fetchFeedbackReasons } from '../../store/thunks/feedbackThunks';
import { selectReasonConfigByAction } from '../../store/selectors/feedbackSelectors';
import './UniversalReasonModal.css';

const UniversalReasonModalBody = ({
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
  const dispatch = useDispatch();
  const currentConfig = useSelector((state) =>
    selectReasonConfigByAction(state, actionType),
  );

  const [selectedReasons, setSelectedReasons] = useState(initialReasons);
  const [explanation, setExplanation] = useState(initialExplanation);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState(null);

  const textareaId = useId();

  useEffect(() => {
    if (!isOpen) return;
    dispatch(fetchFeedbackReasons());
  }, [dispatch, isOpen, actionType]);

  const reasonsList = useMemo(
    () => (Array.isArray(currentConfig?.reasons) ? currentConfig.reasons : []),
    [currentConfig],
  );

  const isOtherSelected = useMemo(
    () => selectedReasons.includes(OTHER_REASON_ID),
    [selectedReasons],
  );

  const isWorkRejection = useMemo(
    () =>
      actionType === 'REJECT_WORK' ||
      actionType === 'REQUEST_CHANGES' ||
      currentConfig?.explanationRequired === true,
    [actionType, currentConfig],
  );

  const trimmedExplanation = explanation.trim();

  const minReasons = currentConfig?.minReasons || 1;
  const hasMinReasons = selectedReasons.length >= minReasons;

  const minExplanationLength = isWorkRejection
    ? currentConfig?.explanationMin || 10
    : 0;
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
  }, [
    isWorkRejection,
    isOtherSelected,
    trimmedExplanation,
    minExplanationLength,
    maxExplanationLength,
  ]);

  const isValid = hasMinReasons && isExplanationValid;

  const toggleReason = (reasonId) => {
    setSelectedReasons((prev) =>
      prev.includes(reasonId)
        ? prev.filter((id) => id !== reasonId)
        : [...prev, reasonId],
    );
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
        err?.serverMessage ||
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
          <div
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--text-secondary, #4b5563)',
            }}
          >
            Target:{' '}
            <span style={{ color: 'var(--text-primary, #111827)' }}>
              {entityName}
            </span>
          </div>
        )}

        <p className="tf-reason-modal-desc">{modalDesc}</p>

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
          <div
            className="tf-reason-chips"
            role="group"
            aria-label="Reason options"
          >
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
              !isExplanationValid && (isOtherSelected || isWorkRejection)
                ? 'invalid'
                : ''
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
            <p
              className={`tf-reason-help-text ${
                trimmedExplanation.length < minExplanationLength
                  ? 'required'
                  : ''
              }`}
            >
              Please explain what needs to be changed so the collaborator can
              revise their work (minimum {minExplanationLength} characters).
            </p>
          ) : isOtherSelected ? (
            <p
              className={`tf-reason-help-text ${
                trimmedExplanation.length === 0 ? 'required' : ''
              }`}
            >
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

/**
 * Universal Action Reason & Feedback Modal (Fix 4).
 * Reads reason options dynamically from `actionFeedbackSlice`.
 */
const UniversalReasonModalContent = (props) => {
  const modalKey = `${props.isOpen ? 'open' : 'closed'}:${props.actionType || ''}:${props.entityName || ''}`;
  return <UniversalReasonModalBody key={modalKey} {...props} />;
};

const UniversalReasonModal = UniversalReasonModalContent;

export default UniversalReasonModal;
