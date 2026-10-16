import { useEffect } from 'react';
import './Modal.css';

/**
 * Reusable accessible modal dialog with backdrop and escape key listener.
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {string} props.title
 * @param {() => void} props.onClose
 * @param {React.ReactNode} props.children
 * @param {React.ReactNode} [props.footer]
 * @param {'sm'|'md'|'lg'} [props.size='md']
 */
const Modal = ({ isOpen, title, onClose, children, footer, size = 'md' }) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="tf-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className={`tf-modal-container tf-modal--${size}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tf-modal-header">
          <h3 className="tf-modal-title">{title}</h3>
          <button
            type="button"
            className="tf-modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="tf-modal-body">{children}</div>

        {footer && <div className="tf-modal-footer">{footer}</div>}
      </div>
    </div>
  );
};

export default Modal;
