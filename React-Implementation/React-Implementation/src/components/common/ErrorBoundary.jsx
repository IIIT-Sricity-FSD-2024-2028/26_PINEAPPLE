import React from 'react';
import { navigateWithAppRouter } from '../../routes/navigationRef';

function extractComponentName(componentStack) {
  if (!componentStack || typeof componentStack !== 'string') return '';
  const lines = componentStack.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const match = line.match(/^(?:at|in)\s+([A-Za-z0-9_$.]+)/);
    if (match && match[1]) return match[1];
  }
  return '';
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      componentStack: '',
      componentName: '',
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    const componentStack = errorInfo?.componentStack || '';
    const componentName = extractComponentName(componentStack);
    this.setState({ componentStack, componentName });
    console.error('Unhandled UI error caught by ErrorBoundary:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleBackToUsers = () => {
    this.setState(
      { hasError: false, error: null, componentStack: '', componentName: '' },
      () => {
        navigateWithAppRouter('/admin/users', { replace: true });
      },
    );
  };

  handleGoBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.setState(
        { hasError: false, error: null, componentStack: '', componentName: '' },
        () => {
          navigateWithAppRouter('/dashboard', { replace: true });
        },
      );
    }
  };

  render() {
    if (this.state.hasError) {
      const isDev =
        typeof this.props.isDev === 'boolean'
          ? this.props.isDev
          : Boolean(import.meta.env?.DEV);
      const currentPath =
        typeof this.props.pathname === 'string'
          ? this.props.pathname
          : typeof window !== 'undefined'
          ? window.location.pathname
          : '';
      const isAdminRoute = currentPath.startsWith('/admin');

      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            padding: '2rem',
            textAlign: 'center',
            color: '#1e293b',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          }}
        >
          <div
            style={{
              maxWidth: '520px',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
              padding: '2rem',
            }}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>⚠️</div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 0.5rem 0', color: '#0f172a' }}>
              Something went wrong. Reload the page
            </h2>
            <p style={{ fontSize: '0.925rem', color: '#64748b', margin: '0 0 1.5rem 0', lineHeight: 1.5 }}>
              An unexpected error occurred while rendering this page. You can reload the page or go back.
            </p>
            {isDev && this.state.error?.message && (
              <details
                data-testid="error-boundary-details"
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '0.75rem',
                  fontSize: '0.8rem',
                  color: '#e11d48',
                  textAlign: 'left',
                  marginBottom: '1.5rem',
                }}
              >
                <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#0f172a' }}>
                  Technical details
                  {this.state.componentName ? ` (${this.state.componentName})` : ''}
                </summary>
                <pre
                  style={{
                    margin: '0.5rem 0 0 0',
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    color: '#e11d48',
                  }}
                >
                  {this.state.error.message}
                  {this.state.componentName ? `\nComponent: ${this.state.componentName}` : ''}
                </pre>
              </details>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              {isAdminRoute && (
                <button
                  type="button"
                  onClick={this.handleBackToUsers}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#f8fafc',
                    color: '#0f172a',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Back to Users
                </button>
              )}
              <button
                type="button"
                onClick={this.handleGoBack}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#4f46e5',
                  color: '#ffffff',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
