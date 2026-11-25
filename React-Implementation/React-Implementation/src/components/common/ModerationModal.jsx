import { useState, useEffect, useRef } from 'react';
import Modal from './Modal.jsx';
import FormInput from './FormInput.jsx';
import { adminApi } from '../../services/adminApi.js';

/**
 * Inner content component with fresh state per user/action session.
 */
const ModerationModalContent = ({
  actionType,
  targetUser,
  onClose,
  onSuccess,
  onSubmit,
}) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [resultMessage, setResultMessage] = useState('');
  const closeTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  const normalizedAction = actionType === 'activate' ? 'reactivate' : actionType;
  const trimmed = reason.trim();
  const charCount = trimmed.length;
  const isValid = charCount >= 10 && charCount <= 500;

  let modalTitle = 'Moderate User';
  let submitLabel = 'Submit';
  let buttonClass = 'btn btn-primary';

  if (normalizedAction === 'warn') {
    modalTitle = `Issue Warning to ${targetUser?.name || 'User'}`;
    submitLabel = 'Confirm Warning (-10 Rep)';
    buttonClass = 'btn btn-warning';
  } else if (normalizedAction === 'suspend') {
    modalTitle = `Suspend Account: ${targetUser?.name || 'User'}`;
    submitLabel = 'Suspend User';
    buttonClass = 'btn btn-danger';
  } else if (normalizedAction === 'reactivate') {
    modalTitle = `Reactivate Account: ${targetUser?.name || 'User'}`;
    submitLabel = 'Reactivate User';
    buttonClass = 'btn btn-success';
  }

  const handleAction = async (e) => {
    if (e) e.preventDefault();
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    setServerError('');
    setResultMessage('');

    try {
      let res;
      if (typeof onSubmit === 'function') {
        res = await onSubmit(trimmed, normalizedAction);
      } else {
        const userId = targetUser?.id;
        if (normalizedAction === 'warn') {
          res = await adminApi.warnUser(userId, { reason: trimmed });
        } else if (normalizedAction === 'suspend') {
          res = await adminApi.suspendUser(userId, { reason: trimmed });
        } else if (normalizedAction === 'reactivate') {
          res = await adminApi.reactivateUser(userId, { reason: trimmed });
        }
      }

      let feedback = '';
      if (normalizedAction === 'warn') {
        const count = res?.activeCount || res?.activeWarningsCount || ((targetUser?.activeWarningsCount || 0) + 1);
        if (res?.autoSuspended || count >= 4) {
          feedback = 'User suspended automatically after 4 warnings';
        } else {
          feedback = `Warning ${count}/4 sent`;
        }
      } else if (normalizedAction === 'suspend') {
        feedback = 'User suspended successfully';
      } else if (normalizedAction === 'reactivate') {
        feedback = 'User reactivated successfully';
      }

      setResultMessage(feedback);

      if (typeof onSuccess === 'function') {
        onSuccess(res || { status: 'success' }, feedback);
      }

      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => {
        onClose();
      }, 750);
    } catch (err) {
      const errMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Moderation action failed. Please try again.';
      setServerError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      title={modalTitle}
      onClose={onClose}
      size="md"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={handleAction}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? 'Processing...' : submitLabel}
          </button>
        </div>
      }
    >
      <div className="moderation-modal-content" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {targetUser && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#f8fafc',
              borderRadius: '6px',
              fontSize: '0.875rem',
              color: '#334155',
              border: '1px solid #e2e8f0',
            }}
          >
            <strong>Target User:</strong> {targetUser.name} (@{targetUser.username || targetUser.email})
            {targetUser.activeWarningsCount !== undefined && (
              <span style={{ marginLeft: '12px', color: '#64748b' }}>
                Active Warnings: <strong>{targetUser.activeWarningsCount}/4</strong>
              </span>
            )}
          </div>
        )}

        {serverError && (
          <div
            className="alert alert-danger"
            style={{
              padding: '10px 14px',
              backgroundColor: '#fef2f2',
              color: '#991b1b',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              fontSize: '0.875rem',
            }}
          >
            <strong>Error:</strong> {serverError}
          </div>
        )}

        {resultMessage && (
          <div
            className="alert alert-success"
            style={{
              padding: '10px 14px',
              backgroundColor: '#f0fdf4',
              color: '#166534',
              border: '1px solid #bbf7d0',
              borderRadius: '6px',
              fontSize: '0.875rem',
            }}
          >
            ✓ {resultMessage}
          </div>
        )}

        <form onSubmit={handleAction}>
          <FormInput
            multiline
            rows={4}
            required
            label="Written Explanation"
            name="moderationReason"
            id="moderationReason"
            placeholder="Explain the reason for this action (10 to 500 characters)..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isSubmitting}
            helperText={`${charCount}/500 characters ${charCount < 10 ? `(min 10 characters required)` : ''}`}
            error={charCount > 500 ? 'Explanation cannot exceed 500 characters.' : ''}
          />
        </form>
      </div>
    </Modal>
  );
};

/**
 * Reusable ModerationModal for warning, suspending, and reactivating users.
 * Reuses Modal and FormInput with a live character counter (10-500 chars),
 * disabled submit until valid, server error display, and result feedback.
 */
const ModerationModal = (props) => {
  if (!props.isOpen) return null;
  const key = `${props.targetUser?.id || 'target'}-${props.actionType || 'action'}`;
  return <ModerationModalContent key={key} {...props} />;
};

export default ModerationModal;
