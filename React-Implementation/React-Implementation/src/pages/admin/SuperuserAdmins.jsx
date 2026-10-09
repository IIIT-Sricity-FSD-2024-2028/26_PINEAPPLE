import React, { useState, useEffect } from 'react';
import portalAdminsApi from '../../services/portalAdminsApi';
import './SuperuserAdmins.css';

const permOptions = [
  { key: "dashboard", label: "Dashboard" },
  { key: "users", label: "User Control" },
  { key: "projects", label: "Projects" },
  { key: "mentor_apps", label: "Mentors" },
  { key: "revenue", label: "Revenue & Escrow" },
  { key: "audit", label: "Audit" },
];

const permLabels = permOptions.reduce((acc, opt) => {
  acc[opt.key] = opt.label;
  return acc;
}, {});

const AdminModal = ({ admin, onClose, onSuccess }) => {
  const isEdit = !!admin;
  
  const [name, setName] = useState(admin ? admin.name : '');
  const [email, setEmail] = useState(admin ? admin.email : '');
  const [password, setPassword] = useState('');
  const [permissions, setPermissions] = useState(admin ? admin.permissions : []);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const BASIC_EMAIL_RE = /^[a-zA-Z0-9._%+-]{1,64}@[a-zA-Z0-9.-]{1,255}\.[a-zA-Z]{2,}$/;
  const STRONG_PASS_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,72}$/;

  const togglePermission = (key) => {
    setPermissions(prev => 
      prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]
    );
  };

  const handleSave = async () => {
    setError('');
    
    if (!name.trim()) return setError("Display name is required.");
    if (name.length > 60) return setError("Display name must be 60 characters or fewer.");
    if (!email.trim()) return setError("Email address is required.");
    if (!BASIC_EMAIL_RE.test(email)) return setError("Enter a valid email address.");
    
    if (!isEdit && !password) return setError("Password is required for new admins.");
    if (password && !STRONG_PASS_RE.test(password)) return setError("Password must be 8+ chars with uppercase, lowercase, number, and special character.");
    if (permissions.length === 0) return setError("Select at least one permission.");

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        permissions,
        ...(password ? { password } : {})
      };

      if (isEdit) {
        await portalAdminsApi.update(admin.id, payload);
      } else {
        payload.status = 'active';
        await portalAdminsApi.create(payload);
      }
      onSuccess();
    } catch (err) {
      setError(err.message || 'An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div id="su-admin-modal" className="su-admin-modal-wrapper">
      <div className="su-modal-backdrop" onClick={onClose}></div>
      <div className="su-modal-card">
        <div className="su-modal-header">
          <h2 className="su-modal-title">{isEdit ? "Edit Admin Instance" : "Provision New Admin"}</h2>
          <button className="su-modal-close" onClick={onClose}>✕</button>
        </div>

        {error && <div id="su-admin-form-error" className="su-form-error">{error}</div>}

        <div className="su-form-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="input-group">
            <label className="label" style={{ fontWeight: 700 }}>Display Identity <span className="su-required">*</span></label>
            <input className="input su-modal-input" type="text" maxLength="60"
              placeholder="e.g. Operations Lead"
              value={name} onChange={e => setName(e.target.value)} />
          </div>

          <div className="input-group">
            <label className="label" style={{ fontWeight: 700 }}>Network Email <span className="su-required">*</span></label>
            <input className="input su-modal-input" type="email" maxLength="254"
              placeholder="admin@teamforge.io"
              value={email} onChange={e => setEmail(e.target.value)} />
          </div>

          <div className="input-group">
            <label className="label" style={{ fontWeight: 700 }}>Secure Access Key {isEdit ? "(optional)" : <span className="su-required">*</span>}</label>
            <input className="input su-modal-input" type="password" maxLength="72"
              placeholder={isEdit ? "Enter to rotate key" : "Min 8 chars, 1 upper, 1 digit"}
              value={password} onChange={e => setPassword(e.target.value)} />
          </div>

          <div className="input-group">
            <label className="label" style={{ fontWeight: 700 }}>Permission Protocol <span className="su-required">*</span></label>
            <div className="su-perm-grid">
              {permOptions.map((p) => (
                <label key={p.key} className="su-perm-item">
                  <input type="checkbox" className="su-perm-cb" value={p.key}
                    checked={permissions.includes(p.key)}
                    onChange={() => togglePermission(p.key)} />
                  <span>{p.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="su-modal-footer" style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
          <button className="btn btn-outline" style={{ flex: 1, height: '48px', borderRadius: '14px' }} onClick={onClose} disabled={saving}>Discard</button>
          <button className="btn btn-primary" style={{ flex: 2, height: '48px', borderRadius: '14px' }} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : (isEdit ? "Save Protocol" : "Authorize Admin")}
          </button>
        </div>
      </div>
    </div>
  );
};

const SuperuserAdmins = () => {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const data = await portalAdminsApi.list();
      setAdmins(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load admins');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleOpenModal = (admin = null) => {
    setEditingAdmin(admin);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setEditingAdmin(null);
    setModalOpen(false);
  };

  const handleModalSuccess = () => {
    handleCloseModal();
    fetchAdmins();
  };

  const handleToggleStatus = async (admin) => {
    if (admin.email === "admin@teamforge.io") {
      alert("Default admin status cannot be changed");
      return;
    }
    try {
      const newStatus = admin.status === "active" ? "suspended" : "active";
      await portalAdminsApi.update(admin.id, { status: newStatus });
      fetchAdmins();
    } catch (err) {
      alert(err.message || "Failed to update status");
    }
  };

  const handleDelete = async (admin) => {
    if (admin.email === "admin@teamforge.io") {
      alert("Default admin account cannot be deleted");
      return;
    }
    if (!window.confirm(`Are you sure you want to erase "${admin.name}"?`)) return;
    try {
      await portalAdminsApi.remove(admin.id);
      fetchAdmins();
    } catch (err) {
      alert(err.message || "Failed to delete admin");
    }
  };

  return (
    <div id="su-admins" className="admin-page su-admins-page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1>Manage Admins <span className="su-page-badge">Super User Only</span></h1>
          <p className="page-subtitle mt-1">Create, edit, suspend, or delete admin accounts and their permissions.</p>
        </div>
        <button className="btn btn-primary" onClick={() => handleOpenModal(null)}>+ New Admin</button>
      </div>

      {error && <div className="su-form-error mt-4">{error}</div>}

      <div className="card mt-4 su-card-container">
        <div id="su-admins-list" className="overflow-x-auto">
          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center' }}>Loading admins...</div>
          ) : admins.length === 0 ? (
            <div className="admin-users-empty">No administrator instances identified.</div>
          ) : (
            <div className="su-table-container">
              <table className="su-table">
                <thead>
                  <tr>
                    <th style={{ borderRadius: '16px 0 0 0' }}>Identity</th>
                    <th>Network Endpoint</th>
                    <th>Operational Scope</th>
                    <th>Authorized Since</th>
                    <th>State</th>
                    <th style={{ textAlign: 'right', borderRadius: '0 16px 0 0' }}>Operations</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((a) => {
                    const isSuspended = a.status !== "active";
                    const statusClass = !isSuspended ? "status-active" : "status-rejected";
                    const isProtected = a.email === "admin@teamforge.io";
                    
                    return (
                      <tr key={a.id} style={{ opacity: isSuspended ? 0.75 : 1 }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div className="su-avatar">
                              {(a.name || "A").charAt(0).toUpperCase()}
                            </div>
                            <div style={{ fontWeight: 700, color: 'var(--fg)' }}>{a.name}</div>
                          </div>
                        </td>
                        <td style={{ color: 'var(--muted-fg)' }}>{a.email}</td>
                        <td>
                          <div className="su-perm-tags">
                            {Array.isArray(a.permissions) && a.permissions.map(p => (
                              <span key={p} className="su-perm-tag">{permLabels[p] || p}</span>
                            ))}
                          </div>
                        </td>
                        <td style={{ color: 'var(--muted-fg)' }}>{a.createdAt ? new Date(a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                        <td><span className={`status-badge ${statusClass}`}>{!isSuspended ? "Active" : "Suspended"}</span></td>
                        <td>
                          <div className="su-row-actions">
                            <button className="btn btn-outline btn-xs su-action-btn" onClick={() => handleOpenModal(a)}>Edit</button>
                            {!isProtected ? (
                              <>
                                <button className="btn btn-outline btn-xs su-action-btn" onClick={() => handleToggleStatus(a)}>
                                  {!isSuspended ? "Suspend" : "Activate"}
                                </button>
                                <button className="btn btn-xs su-btn-danger su-action-btn" onClick={() => handleDelete(a)}>Erase</button>
                              </>
                            ) : (
                              <span style={{ fontSize: '0.7rem', color: 'var(--muted-fg)', fontStyle: 'italic' }}>Protected</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {modalOpen && <AdminModal admin={editingAdmin} onClose={handleCloseModal} onSuccess={handleModalSuccess} />}
    </div>
  );
};

export default SuperuserAdmins;
