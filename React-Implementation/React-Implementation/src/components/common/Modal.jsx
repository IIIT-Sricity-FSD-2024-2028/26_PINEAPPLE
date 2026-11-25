import { useEffect, useId, useRef } from 'react';
import './Modal.css';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

let openModalCount = 0;
let savedBodyOverflow = '';

/**
 * Reusable accessible modal dialog with focus management, focus trap,
 * Escape handling (honoring closeDisabled for in-flight money actions),
 * body scroll lock, and ARIA labels.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {string} props.title
 * @param {() => void} props.onClose
 * @param {React.ReactNode} props.children
 * @param {React.ReactNode} [props.footer]
 * @param {'sm'|'md'|'lg'} [props.size='md']
 * @param {boolean} [props.closeDisabled=false]
 * @param {string} [props.testId]
 * @param {string} [props.containerTestId]
 */
const Modal = ({
  isOpen,
  title,
  onClose,
  children,
  footer,
  size = 'md',
  closeDisabled = false,
  preventClose = false,
  testId,
  containerTestId,
}) => {
  const titleId = useId();
  const containerRef = useRef(null);
  const previousActiveRef = useRef(null);
  const wasOpenRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const isCloseLocked = Boolean(closeDisabled || preventClose);
  const isCloseLockedRef = useRef(isCloseLocked);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    isCloseLockedRef.current = isCloseLocked;
  }, [isCloseLocked]);

  // Move focus into dialog on open, lock body scroll, and restore opener focus on close
  useEffect(() => {
    if (!isOpen) {
      if (wasOpenRef.current) {
        wasOpenRef.current = false;
        const prev = previousActiveRef.current;
        previousActiveRef.current = null;
        if (prev && typeof prev.focus === 'function') {
          prev.focus();
        }
      }
      return;
    }

    wasOpenRef.current = true;
    if (typeof document !== 'undefined') {
      previousActiveRef.current = document.activeElement;
      if (openModalCount === 0) {
        savedBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
      }
      openModalCount += 1;

      const container = containerRef.current;
      if (container && !container.contains(document.activeElement)) {
        const focusables = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
          (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true',
        );
        const preferred = focusables.find((el) => el.hasAttribute('data-autofocus')) || focusables[0] || container;
        if (preferred && typeof preferred.focus === 'function') {
          preferred.focus();
        }
      }
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (!isCloseLockedRef.current && typeof onCloseRef.current === 'function') {
          onCloseRef.current();
        }
        return;
      }

      if (e.key === 'Tab' && containerRef.current) {
        const focusables = Array.from(containerRef.current.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
          (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true',
        );
        if (focusables.length === 0) {
          e.preventDefault();
          containerRef.current.focus();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;

        if (!containerRef.current.contains(active)) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
          return;
        }

        if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && (active === first || active === containerRef.current)) {
          e.preventDefault();
          last.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (typeof document !== 'undefined') {
        openModalCount = Math.max(0, openModalCount - 1);
        if (openModalCount === 0) {
          document.body.style.overflow = savedBodyOverflow;
        }
      }
    };
  }, [isOpen]);

  // Restore focus if component unmounts while open
  useEffect(() => {
    return () => {
      if (wasOpenRef.current) {
        wasOpenRef.current = false;
        const prev = previousActiveRef.current;
        previousActiveRef.current = null;
        if (prev && typeof prev.focus === 'function') {
          prev.focus();
        }
      }
    };
  }, []);

  if (!isOpen) return null;

  const handleBackdropClick = () => {
    if (!isCloseLocked && typeof onClose === 'function') {
      onClose();
    }
  };

  return (
    <div className="tf-modal-backdrop" onClick={handleBackdropClick}>
      <div
        ref={containerRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={!title ? 'Dialog' : undefined}
        data-testid={testId || containerTestId || undefined}
        className={`tf-modal-container tf-modal--${size}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tf-modal-header">
          <h3 id={titleId} className="tf-modal-title">{title}</h3>
          <button
            type="button"
            className="tf-modal-close-btn"
            onClick={() => !isCloseLocked && typeof onClose === 'function' && onClose()}
            disabled={isCloseLocked}
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
