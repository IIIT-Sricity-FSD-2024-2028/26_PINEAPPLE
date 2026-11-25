const fs = require('fs');
const path = require('path');

// 1. AdminMentorApps.jsx
const jsxPath = path.resolve(__dirname, '../React-Implementation/React-Implementation/src/pages/admin/AdminMentorApps.jsx');
let jsx = fs.readFileSync(jsxPath, 'utf8');

// Ensure useRef is imported
jsx = jsx.replace(
  "import { useState, useEffect } from 'react';",
  "import { useState, useEffect, useRef } from 'react';"
);

// Replace loadApplications and handlers
const oldStateBlock = `  const [rejectModalApp, setRejectModalApp] = useState(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('');

  useEffect(() => {
    let isMounted = true;
    const loadApplications = async () => {
      try {
        const data = await mentorApplicationsApi.list();
        if (isMounted) {
          setApplications(Array.isArray(data) ? data : []);
          setError(null);
        }
      } catch (err) {
        console.error('Failed to load mentor applications:', err);
        if (isMounted) {
          setError(err.message || 'Failed to load mentor applications.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadApplications();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleToggleDetails = (id, currentStatus) => {
    setExpandedIds((prev) => {
      const isCurrentlyOpen =
        prev[id] !== undefined ? prev[id] : currentStatus === 'pending';
      return {
        ...prev,
        [id]: !isCurrentlyOpen,
      };
    });
  };

  const handleApprove = async (app) => {
    const normalized = normalizeMentorApp(app);
    if (normalized.years < 4) {
      alert("❌ Cannot approve: Applicant has less than 4 years of experience");
      return;
    }

    setProcessingId(app.id);
    try {
      await mentorApplicationsApi.approve(app.id);
      setApplications((prev) =>
        prev.map((item) =>
          item.id === app.id ? { ...item, status: 'approved' } : item
        )
      );
    } catch (err) {
      console.error('Failed to approve mentor application:', err);
      alert(err.message || 'Failed to approve mentor application');
    } finally {
      setProcessingId(null);
    }
  };

  const handleOpenRejectModal = (app) => {
    setRejectModalApp(app);
    setRejectReasonInput('Application did not meet minimum criteria or credential standards.');
  };

  const handleConfirmReject = async () => {
    if (!rejectModalApp) return;
    setProcessingId(rejectModalApp.id);
    try {
      const reason = rejectReasonInput.trim() || 'Application did not meet requirements.';
      await mentorApplicationsApi.reject(rejectModalApp.id, { reason });
      setApplications((prev) =>
        prev.map((item) =>
          item.id === rejectModalApp.id ? { ...item, status: 'rejected', rejectionReason: reason } : item
        )
      );
      setRejectModalApp(null);
    } catch (err) {
      console.error('Failed to reject mentor application:', err);
      alert(err.message || 'Failed to reject mentor application');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDownloadCv = async (filename, originalName) => {
    try {
      const blob = await uploadsApi.downloadCv(filename);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = originalName || filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert(err.message || 'Failed to download CV file.');
    }
  };

  const handleDeleteCv = async (appId) => {
    if (!window.confirm('Are you sure you want to delete this applicant\\'s CV file? This cannot be undone.')) {
      return;
    }
    setProcessingId(appId);
    try {
      await mentorApplicationsApi.deleteCv(appId);
      setApplications((prev) =>
        prev.map((item) =>
          item.id === appId ? { ...item, cvFileName: null, cvUrl: null } : item
        )
      );
      alert('CV file was permanently deleted.');
    } catch (err) {
      alert(err.message || 'Failed to delete CV file');
    } finally {
      setProcessingId(null);
    }
  };`;

const newStateBlock = `  const [rejectModalApp, setRejectModalApp] = useState(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('');
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });
  const toastTimeoutRef = useRef(null);

  const showToast = (message, type = 'info') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ visible: true, message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 4500);
  };

  const loadApplications = async () => {
    try {
      const data = await mentorApplicationsApi.list();
      setApplications(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      console.error('Failed to load mentor applications:', err);
      setError(err.message || 'Failed to load mentor applications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const handleToggleDetails = (id, currentStatus) => {
    setExpandedIds((prev) => {
      const isCurrentlyOpen =
        prev[id] !== undefined ? prev[id] : currentStatus === 'pending';
      return {
        ...prev,
        [id]: !isCurrentlyOpen,
      };
    });
  };

  const handleApprove = async (app) => {
    const normalized = normalizeMentorApp(app);
    if (normalized.years < 4) {
      showToast('❌ Cannot approve: Applicant has less than 4 years of experience', 'error');
      return;
    }

    setProcessingId(app.id);
    try {
      await mentorApplicationsApi.approve(app.id);
      showToast(\`Mentor application for \${normalized.name} approved successfully.\`, 'success');
      await loadApplications();
    } catch (err) {
      console.error('Failed to approve mentor application:', err);
      showToast(err.message || 'Failed to approve mentor application', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleOpenRejectModal = (app) => {
    setRejectModalApp(app);
    setRejectReasonInput('');
  };

  const handleConfirmReject = async () => {
    if (!rejectModalApp) return;
    setProcessingId(rejectModalApp.id);
    try {
      const reason = rejectReasonInput.trim() || 'Application did not meet minimum criteria or credential standards.';
      await mentorApplicationsApi.reject(rejectModalApp.id, { reason });
      showToast(\`Mentor application for \${rejectModalApp.name} rejected.\`, 'info');
      setRejectModalApp(null);
      await loadApplications();
    } catch (err) {
      console.error('Failed to reject mentor application:', err);
      showToast(err.message || 'Failed to reject mentor application', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDownloadCv = async (filename, originalName) => {
    try {
      const blob = await uploadsApi.downloadCv(filename);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = originalName || filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      showToast(err.message || 'Failed to download CV file.', 'error');
    }
  };

  const handleDeleteCv = async (appId) => {
    if (!window.confirm('Are you sure you want to delete this applicant\\'s CV file? This cannot be undone.')) {
      return;
    }
    setProcessingId(appId);
    try {
      await mentorApplicationsApi.deleteCv(appId);
      setApplications((prev) =>
        prev.map((item) =>
          item.id === appId ? { ...item, cvFileName: null, cvUrl: null } : item
        )
      );
      showToast('CV file was permanently deleted.', 'info');
    } catch (err) {
      showToast(err.message || 'Failed to delete CV file', 'error');
    } finally {
      setProcessingId(null);
    }
  };`;

// Replace normalizing line endings for exact match
jsx = jsx.replace(/\r\n/g, '\n');
const normalizedOld = oldStateBlock.replace(/\r\n/g, '\n');
if (jsx.includes(normalizedOld)) {
  jsx = jsx.replace(normalizedOld, newStateBlock);
  console.log('Replaced handlers and loadApplications');
} else {
  console.error('Could not find oldStateBlock in AdminMentorApps.jsx');
}

// Add Toast render at end of component
const oldReturnEnd = `      {rejectModalApp && (`;
const newReturnEnd = `      {toast.visible && (
        <div className={\`admin-mentor-toast \${toast.type}\`}>
          <span className="admin-mentor-toast-icon">
            {toast.type === 'success' && '✓'}
            {toast.type === 'error' && '✕'}
            {toast.type === 'info' && 'ℹ'}
          </span>
          <span className="admin-mentor-toast-text">{toast.message}</span>
          <button
            type="button"
            className="admin-mentor-toast-close"
            onClick={() => setToast((prev) => ({ ...prev, visible: false }))}
          >
            ✕
          </button>
        </div>
      )}

      {rejectModalApp && (`;

jsx = jsx.replace(oldReturnEnd, newReturnEnd);

// Add optional rejection reason textarea in modal if not present
const oldModalBody = `<div className="admin-mentor-modal-content">
            <h3>Reject Mentor Application</h3>
            <p>
              Are you sure you want to reject the application from{' '}
              <strong>{rejectModalApp.name}</strong>?
            </p>
            <div style={{ marginTop: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--muted-fg)', marginBottom: '4px' }}>
                Rejection Reason:
              </label>
              <textarea
                value={rejectReasonInput}
                onChange={(e) => setRejectReasonInput(e.target.value)}
                placeholder="Reason for rejection (communicated to applicant)"
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--card)',
                  color: 'var(--foreground)',
                  fontSize: '0.9rem',
                }}
              />
            </div>`;

if (!jsx.includes('Rejection Reason:')) {
  jsx = jsx.replace(
    `<p>\n              Are you sure you want to reject the application from{' '}\n              <strong>{rejectModalApp.name}</strong>?\n            </p>`,
    `<p>\n              Are you sure you want to reject the application from{' '}\n              <strong>{rejectModalApp.name}</strong>?\n            </p>\n            <div style={{ marginTop: '12px' }}>\n              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--muted-fg)', marginBottom: '4px' }}>\n                Rejection Reason (Optional):\n              </label>\n              <textarea\n                value={rejectReasonInput}\n                onChange={(e) => setRejectReasonInput(e.target.value)}\n                placeholder="Optional feedback for applicant (e.g. requires additional experience)..."\n                rows={3}\n                style={{\n                  width: '100%',\n                  padding: '8px 12px',\n                  borderRadius: '8px',\n                  border: '1px solid var(--border)',\n                  backgroundColor: 'var(--card)',\n                  color: 'var(--foreground)',\n                  fontSize: '0.9rem',\n                }}\n              />\n            </div>`
  );
}

fs.writeFileSync(jsxPath, jsx, 'utf8');
console.log('Successfully updated AdminMentorApps.jsx');

// 2. AdminMentorApps.css
const cssPath = path.resolve(__dirname, '../React-Implementation/React-Implementation/src/pages/admin/AdminMentorApps.css');
let css = fs.readFileSync(cssPath, 'utf8');

const toastCss = `
/* Toast Notification for Admin Mentor Apps */
.admin-mentor-toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
  border-radius: 10px;
  background: var(--card);
  color: var(--card-fg);
  border: 1px solid var(--border);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.25);
  font-size: 0.92rem;
  font-weight: 500;
  max-width: 480px;
  animation: adminToastSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes adminToastSlideUp {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.admin-mentor-toast.success {
  border-color: #10b981;
}

.admin-mentor-toast.success .admin-mentor-toast-icon {
  color: #10b981;
  font-weight: 700;
}

.admin-mentor-toast.error {
  border-color: #ef4444;
}

.admin-mentor-toast.error .admin-mentor-toast-icon {
  color: #ef4444;
  font-weight: 700;
}

.admin-mentor-toast.info {
  border-color: #3b82f6;
}

.admin-mentor-toast.info .admin-mentor-toast-icon {
  color: #3b82f6;
  font-weight: 700;
}

.admin-mentor-toast-text {
  flex: 1;
}

.admin-mentor-toast-close {
  background: transparent;
  border: none;
  color: var(--muted-fg);
  cursor: pointer;
  padding: 2px 6px;
  font-size: 0.9rem;
  border-radius: 4px;
}

.admin-mentor-toast-close:hover {
  color: var(--foreground);
}
`;

if (!css.includes('admin-mentor-toast')) {
  css += toastCss;
  fs.writeFileSync(cssPath, css, 'utf8');
  console.log('Successfully updated AdminMentorApps.css');
}
