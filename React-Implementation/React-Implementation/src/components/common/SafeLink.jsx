import { useState } from 'react';
import { isSafeHttpUrl, isExternalUrl } from '../../utils/urlUtil';
import Modal from './Modal';
import './SafeLink.css';

/**
 * SafeLink Component:
 * - Renders an anchor only for valid http(s) URLs; invalid/dangerous URLs render as plain text.
 * - External URLs open the shared accessible confirmation Modal showing the destination domain in bold and the full URL beneath.
 * - Internal links open directly without a modal.
 */
const SafeLink = ({
  href,
  url,
  children,
  className = '',
  style = {},
  target = '_blank',
  rel = 'noopener noreferrer',
  onClick: userOnClick,
  ...rest
}) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const targetUrl = (href || url || '').trim();

  // 1. If not a valid http(s) URL, render plain text
  if (!isSafeHttpUrl(targetUrl)) {
    return (
      <span
        className={`tf-safelink-plain ${className}`.trim()}
        style={style}
        onClick={userOnClick}
        data-testid="safelink-plain"
      >
        {children || targetUrl}
      </span>
    );
  }

  const isExternal = isExternalUrl(targetUrl);

  let domain;
  try {
    domain = new URL(targetUrl).hostname;
  } catch {
    domain = targetUrl;
  }

  const handleClick = (e) => {
    if (typeof userOnClick === 'function') {
      userOnClick(e);
    }
    if (isExternal) {
      e.preventDefault();
      e.stopPropagation();
      setShowConfirm(true);
    }
  };

  const handleContinue = (e) => {
    if (e) {
      e.stopPropagation();
    }
    setShowConfirm(false);
    if (typeof window !== 'undefined') {
      window.open(targetUrl, target, rel);
    }
  };

  const handleCancel = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setShowConfirm(false);
  };

  return (
    <>
      <a
        href={targetUrl}
        className={`tf-safelink-anchor ${className}`.trim()}
        style={style}
        onClick={handleClick}
        target={target}
        rel={rel}
        data-testid="safelink-anchor"
        {...rest}
      >
        {children || targetUrl}
      </a>

      <Modal
        isOpen={showConfirm}
        title="Leaving TeamForge"
        onClose={handleCancel}
        size="sm"
        testId="safelink-dialog"
        footer={
          <div className="tf-safelink-actions" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="tf-safelink-btn tf-safelink-btn-cancel"
              onClick={handleCancel}
              data-testid="safelink-cancel-btn"
            >
              Cancel
            </button>
            <button
              type="button"
              className="tf-safelink-btn tf-safelink-btn-continue"
              onClick={handleContinue}
              data-testid="safelink-continue-btn"
            >
              Continue
            </button>
          </div>
        }
      >
        <div onClick={(e) => e.stopPropagation()}>
          <p className="tf-safelink-desc">
            You are about to open an external website. Ensure you trust this domain before continuing.
          </p>

          <div className="tf-safelink-domain-card">
            <div className="tf-safelink-domain-label">Destination Domain</div>
            <div className="tf-safelink-domain-name" data-testid="safelink-domain">
              <strong>{domain}</strong>
            </div>
            <div className="tf-safelink-full-url" data-testid="safelink-full-url">
              {targetUrl}
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default SafeLink;
