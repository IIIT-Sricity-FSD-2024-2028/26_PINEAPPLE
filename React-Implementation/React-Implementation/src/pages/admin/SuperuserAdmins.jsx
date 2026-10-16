import { useState, useEffect } from 'react';
import portalAdminsApi from '../../services/portalAdminsApi';
import Modal from '../../components/common/Modal';
import FormInput from '../../components/common/FormInput';
import Avatar from '../../components/common/Avatar';
import Badge from '../../components/common/Badge';
import DataTable from '../../components/common/DataTable';
import ConfirmModal from '../../components/common/ConfirmModal';
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
        payload.portalRole = 'admin';
        await portalAdminsApi.create(payload);
      }
      onSuccess();
    } catch (err) {
      const msg = err.message || 'An error occurred while saving.';
      setError(msg.replace(/^Validation Error:\s*/i, ''));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      title={isEdit ? "Edit Admin Instance" : "Provision New Admin"}
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
          <button className="btn btn-outline" style={{ flex: 1, height: '44px', borderRadius: '10px' }} onClick={onClose} disabled={saving}>Discard</button>
          <button className="btn btn-primary" style={{ flex: 2, height: '44px', borderRadius: '10px' }} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : (isEdit ? "Save Protocol" : "Authorize Admin")}
          </button>
        </div>
      }
    >
      <div id="su-admin-modal">
        {error && <div id="su-admin-form-error" className="su-form-error" style={{ marginBottom: '16px' }}>{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <FormInput
            label="Display Identity"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Operations Lead"
            maxLength={60}
            required
          />

          <FormInput
            label="Network Email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@teamforge.io"
            maxLength={254}
            required
          />

          <FormInput
            label={`Secure Access Key ${isEdit ? '(optional)' : ''}`}
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isEdit ? "Enter to rotate key" : "Min 8 chars, 1 upper, 1 digit"}
            maxLength={72}
            required={!isEdit}
          />

          <div className="input-group">
            <label className="label" style={{ fontWeight: 700, marginBottom: '6px', display: 'block' }}>
              Permission Protocol <span className="su-required">*</span>
            </label>
            <div className="su-perm-grid">
              {permOptions.map((p) => (
                <label key={p.key} className="su-perm-item">
                  <input
                    type="checkbox"
                    className="su-perm-cb"
                    value={p.key}
                    checked={permissions.includes(p.key)}
                    onChange={() => togglePermission(p.key)}
                  />
                  <span>{p.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

const SuperuserAdmins = () => {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const loadAdmins = async () => {
      try {
        const data = await portalAdminsApi.list();
        if (isMounted) {
          setAdmins(Array.isArray(data) ? data : []);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to load admins');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadAdmins();

    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

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
    setRefreshKey((k) => k + 1);
  };

  const handleToggleStatus = async (admin) => {
    if (admin.email === "admin@teamforge.io") {
      alert("Default admin status cannot be changed");
      return;
    }
    const newStatus = admin.status === "active" ? "suspended" : "active";
    try {
      await portalAdminsApi.update(admin.id, { status: newStatus });
      setAdmins((prev) => prev.map((a) => a.id === admin.id ? { ...a, status: newStatus } : a));
    } catch (err) {
      alert(err.message || "Failed to update status");
    }
  };

  const [adminToErase, setAdminToErase] = useState(null);
  const [erasing, setErasing] = useState(false);

  const handleDelete = (admin) => {
    if (admin.email === "admin@teamforge.io") {
      alert("Default admin account cannot be deleted");
      return;
    }
    setAdminToErase(admin);
  };

  const handleConfirmErase = async () => {
    if (!adminToErase) return;
    setErasing(true);
    try {
      await portalAdminsApi.remove(adminToErase.id);
      setAdmins((prev) => prev.filter((a) => a.id !== adminToErase.id));
      setAdminToErase(null);
    } catch (err) {
      alert(err.message || "Failed to delete admin");
    } finally {
      setErasing(false);
    }
  };

  const columns = [
    {
      header: 'Identity',
      key: 'name',
      render: (a) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Avatar name={a.name} size="sm" />
          <div style={{ fontWeight: 700, color: 'var(--fg)' }}>{a.name}</div>
        </div>
      ),
    },
    {
      header: 'Network Endpoint',
      key: 'email',
      render: (a) => <span style={{ color: 'var(--muted-fg)' }}>{a.email}</span>,
    },
    {
      header: 'Operational Scope',
      key: 'permissions',
      render: (a) => (
        <div className="su-perm-tags">
          {Array.isArray(a.permissions) && a.permissions.map(p => (
            <span key={p} className="su-perm-tag">{permLabels[p] || p}</span>
          ))}
        </div>
      ),
    },
    {
      header: 'Authorized Since',
      key: 'createdAt',
      render: (a) => (
        <span style={{ color: 'var(--muted-fg)' }}>
          {a.createdAt ? new Date(a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
        </span>
      ),
    },
    {
      header: 'State',
      key: 'status',
      render: (a) => {
        const isSuspended = a.status !== "active";
        return (
          <Badge variant={!isSuspended ? "active" : "locked"}>
            {!isSuspended ? "Active" : "Suspended"}
          </Badge>
        );
      },
    },
    {
      header: 'Operations',
      key: 'actions',
      align: 'right',
      render: (a) => {
        const isSuspended = a.status !== "active";
        const isProtected = a.email === "admin@teamforge.io";
        return (
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
        );
      },
    },
  ];

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
          <DataTable
            columns={columns}
            data={admins}
            loading={loading}
            loadingRows={3}
            emptyTitle="No administrator instances identified."
            emptyMessage="No administrators match the criteria or have been created yet."
            tableClassName="su-table"
          />
        </div>
      </div>

      {modalOpen && <AdminModal admin={editingAdmin} onClose={handleCloseModal} onSuccess={handleModalSuccess} />}

      <ConfirmModal
        isOpen={Boolean(adminToErase)}
        title="Erase Administrator"
        message={`Are you sure you want to permanently erase admin "${adminToErase?.name}" (${adminToErase?.email})? All associated permissions will be revoked.`}
        confirmLabel="Erase Admin"
        variant="danger"
        loading={erasing}
        onConfirm={handleConfirmErase}
        onCancel={() => setAdminToErase(null)}
      />
    </div>
  );
};

export default SuperuserAdmins;
