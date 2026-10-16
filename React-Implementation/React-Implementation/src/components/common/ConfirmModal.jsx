import Modal from './Modal';
import './ConfirmModal.css';

/**
 * Reusable confirmation dialog built on top of the shared Modal component.
 * Replaces browser window.confirm with accessible, branded modal.
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {string} [props.title='Confirm Action']
 * @param {React.ReactNode} props.message
 * @param {string} [props.confirmLabel='Confirm']
 * @param {string} [props.cancelLabel='Cancel']
 * @param {'danger'|'warning'|'primary'} [props.variant='danger']
 * @param {() => void} props.onConfirm
 * @param {() => void} props.onCancel
 * @param {boolean} [props.loading=false]
 */
const ConfirmModal = ({
  isOpen,
  title = 'Confirm Action',
  message,
  confirmLabel = 'Confirm',
  confirmText,
  cancelLabel = 'Cancel',
  cancelText,
  variant = 'danger',
  onConfirm,
  onCancel,
  onClose,
  loading = false,
  icon,
}) => {
  const finalConfirm = confirmText || confirmLabel;
  const finalCancel = cancelText || cancelLabel;
  const handleClose = onCancel || onClose;

  return (
    <Modal
      isOpen={isOpen}
      title={title}
      onClose={handleClose}
      size="sm"
      footer={
        <div className="tf-confirm-modal-actions">
          <button
            type="button"
            className="tf-confirm-btn tf-confirm-btn--secondary"
            onClick={handleClose}
            disabled={loading}
          >
            {finalCancel}
          </button>
          <button
            type="button"
            className={`tf-confirm-btn tf-confirm-btn--${variant}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Processing...' : finalConfirm}
          </button>
        </div>
      }
    >
      <div className="tf-confirm-modal-body">
        <div className={`tf-confirm-icon-wrap tf-confirm-icon--${variant}`}>
          {icon ? (
            icon
          ) : variant === 'danger' ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          ) : variant === 'warning' ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 16 12 12 12 8" />
            </svg>
          )}
        </div>
        <div className="tf-confirm-message">{message}</div>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
