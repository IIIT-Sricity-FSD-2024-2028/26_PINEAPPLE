const fs = require('fs');
const path = require('path');

// 1. Update mentorApplication.css
const mentorAppCssPath = path.resolve(__dirname, '../React-Implementation/React-Implementation/src/pages/mentor/mentorApplication.css');
let mentorAppCss = fs.readFileSync(mentorAppCssPath, 'utf8');

if (!mentorAppCss.includes('tf-mentor-upload-section')) {
  const additionalCss = `
/* Phase 8: Mentor CV & DigiLocker Verification */
.tf-mentor-upload-section {
  border: 1px dashed var(--border, #cbd5e1);
  border-radius: 8px;
  padding: 1.25rem;
  background: var(--card-bg, #f8fafc);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.tf-mentor-upload-btn-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0.6rem 1.1rem;
  background: #ffffff;
  border: 1px solid var(--border, #cbd5e1);
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--fg, #0f172a);
  cursor: pointer;
  width: fit-content;
  transition: all 0.15s ease-in-out;
}

.tf-mentor-upload-btn-label:hover {
  background: #f1f5f9;
  border-color: var(--primary, #2563eb);
}

.tf-mentor-file-pill {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.tf-mentor-file-info {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.9rem;
}

.tf-mentor-file-name {
  font-weight: 600;
  color: var(--fg, #0f172a);
}

.tf-mentor-file-size {
  font-size: 0.8rem;
  color: var(--muted-fg, #64748b);
}

.tf-mentor-remove-btn {
  background: transparent;
  border: none;
  color: #dc2626;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}

.tf-mentor-remove-btn:hover {
  background: #fee2e2;
}

.tf-mentor-digilocker-banner {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.tf-mentor-digilocker-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
}

.tf-mentor-digilocker-badge.verified {
  background: #dcfce7;
  color: #15803d;
}

.tf-mentor-digilocker-badge.mismatch {
  background: #fee2e2;
  color: #b91c1c;
}

.tf-mentor-cert-item {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  background: #ffffff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-top: 0.5rem;
}
`;
  fs.writeFileSync(mentorAppCssPath, mentorAppCss + '\n' + additionalCss, 'utf8');
  console.log('Appended Phase 8 styles to mentorApplication.css');
}

// 2. Update AdminMentorApps.css
const adminMentorCssPath = path.resolve(__dirname, '../React-Implementation/React-Implementation/src/pages/admin/AdminMentorApps.css');
let adminMentorCss = fs.readFileSync(adminMentorCssPath, 'utf8');

if (!adminMentorCss.includes('admin-digilocker-banner')) {
  const adminAddCss = `
/* Phase 8: Admin DigiLocker & CV styles */
.admin-digilocker-banner {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 10px;
  padding: 12px 18px;
  color: #1e40af;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 10px;
}

.admin-cv-box {
  background: var(--secondary, #f8fafc);
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 8px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.admin-doc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 10px;
  margin-top: 8px;
}

.admin-doc-card {
  border: 1px solid var(--border, #e2e8f0);
  background: var(--card, #ffffff);
  border-radius: 8px;
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.admin-rejection-alert {
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: 8px;
  padding: 10px 14px;
  color: #b91c1c;
  font-size: 0.875rem;
}
`;
  fs.writeFileSync(adminMentorCssPath, adminMentorCss + '\n' + adminAddCss, 'utf8');
  console.log('Appended Phase 8 styles to AdminMentorApps.css');
}
