import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { dismissToast } from '../../store/slices/uiSlice';
import { selectToasts } from '../../store/selectors/uiSelectors';

function ToastViewport() {
  const toasts = useSelector(selectToasts);
  const dispatch = useDispatch();

  useEffect(() => {
    if (!Array.isArray(toasts) || toasts.length === 0) return undefined;
    const timers = toasts
      .filter((t) => typeof t.durationMs === 'number' && t.durationMs > 0)
      .map((t) =>
        setTimeout(() => {
          dispatch(dismissToast(t.id));
        }, t.durationMs),
      );
    return () => {
      timers.forEach((id) => clearTimeout(id));
    };
  }, [toasts, dispatch]);

  if (!Array.isArray(toasts) || toasts.length === 0) {
    return null;
  }

  return (
    <div
      data-testid="global-toast-viewport"
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 9998,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        maxWidth: '360px',
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          aria-live="polite"
          data-testid={`ui-toast-${toast.id}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '10px 14px',
            borderRadius: '8px',
            backgroundColor:
              toast.type === 'error'
                ? '#fee2e2'
                : toast.type === 'success'
                  ? '#dcfce7'
                  : 'var(--surface, #ffffff)',
            color:
              toast.type === 'error'
                ? '#991b1b'
                : toast.type === 'success'
                  ? '#166534'
                  : 'var(--fg, #111827)',
            border: '1px solid var(--border, #e2e8f0)',
            boxShadow: 'var(--shadow-card, 0 2px 8px rgba(0, 0, 0, 0.08))',
            fontSize: '0.9rem',
            fontWeight: 500,
          }}
        >
          <span>{toast.message}</span>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => dispatch(dismissToast(toast.id))}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'inherit',
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

export default ToastViewport;
