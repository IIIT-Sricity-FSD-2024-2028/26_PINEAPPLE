import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  createPortalAdmin,
  deletePortalAdmin,
  fetchPortalAdmins,
  updatePortalAdmin,
} from '../../store/thunks/portalAdminsThunks';
import {
  closeAdminModal,
  openAdminModal,
  setAdminToEraseId,
  setPortalAdminModalError,
} from '../../store/slices/portalAdminsSlice';
import {
  selectAllPortalAdmins,
  selectEditingPortalAdmin,
  selectErasePortalAdmin,
  selectPortalAdminsError,
  selectPortalAdminsStatus,
  selectPortalAdminsWorking,
} from '../../store/selectors/portalAdminsSelectors';
import {
  canAccess,
  selectIsSessionConfigured,
  selectSession,
} from '../../store/selectors/sessionSelectors';
import Modal from '../../components/common/Modal';
import FormInput from '../../components/common/FormInput';
import Avatar from '../../components/common/Avatar';
import Badge from '../../components/common/Badge';
import DataTable from '../../components/common/DataTable';
import ConfirmModal from '../../components/common/ConfirmModal';
import './SuperuserAdmins.css';

const permOptions = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'users', label: 'User Control' },
  { key: 'projects', label: 'Projects' },
  { key: 'mentor_apps', label: 'Mentors' },
  { key: 'revenue', label: 'Revenue & Escrow' },
  { key: 'reports', label: 'Reports' },
  { key: 'support', label: 'Support Inbox' },
  { key: 'audit', label: 'Audit' },
];

const permLabels = permOptions.reduce((acc, opt) => {
  acc[opt.key] = opt.label;
  return acc;
}, {});

const AdminModal = ({ admin, saving, error, onSave, onValidationError, onClose }) => {
  const isEdit = Boolean(admin);

  const [name, setName] = useState(admin ? admin.name : '');
  const [email, setEmail] = useState(admin ? admin.email : '');
  const [password, setPassword] = useState('');
  const [permissions, setPermissions] = useState(admin ? admin.permissions || [] : []);

  const BASIC_EMAIL_RE = /^[a-zA-Z0-9._%+-]{1,64}@[a-zA-Z0-9.-]{1,255}\.[a-zA-Z]{2,}$/;
  const STRONG_PASS_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,72}$/;

  const togglePermission = (key) => {
    setPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key],
    );
  };

  const handleSave = () => {
    onValidationError('');

    if (!name.trim()) return onValidationError('Display name is required.');
    if (name.length > 60) return onValidationError('Display name must be 60 characters or fewer.');
    if (!email.trim()) return onValidationError('Email address is required.');
    if (!BASIC_EMAIL_RE.test(email)) return onValidationError('Enter a valid email address.');

    if (!isEdit && !password) return onValidationError('Password is required for new admins.');
    if (password && !STRONG_PASS_RE.test(password)) {
      return onValidationError(
        'Password must be 8+ chars with uppercase, lowercase, number, and special character.',
      );
    }
    if (permissions.length === 0) return onValidationError('Select at least one permission.');

    const payload = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      permissions,
      ...(password ? { password } : {}),
    };
    if (!isEdit) {
      payload.status = 'active';
      payload.portalRole = 'admin';
    }
    onSave(payload);
  };

  return (
    <Modal
      isOpen={true}
      title={isEdit ? 'Edit Admin Instance' : 'Provision New Admin'}
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
          <button
            className="btn btn-outline"
            style={{ flex: 1, height: '44px', borderRadius: '10px' }}
            onClick={onClose}
            disabled={saving}
          >
            Discard
          </button>
          <button
            className="btn btn-primary"
            style={{ flex: 2, height: '44px', borderRadius: '10px' }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : isEdit ? 'Save Protocol' : 'Authorize Admin'}
          </button>
        </div>
      }
    >
      <div id="su-admin-modal">
        {error && (
          <div id="su-admin-form-error" className="su-form-error" style={{ marginBottom: '16px' }}>
            {error}
          </div>
        )}

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
            placeholder={isEdit ? 'Enter to rotate key' : 'Min 8 chars, 1 upper, 1 digit'}
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

const SuperuserAdminsContent = () => {
  const dispatch = useDispatch();

  const admins = useSelector(selectAllPortalAdmins);
  const status = useSelector(selectPortalAdminsStatus);
  const listError = useSelector(selectPortalAdminsError);
  const working = useSelector(selectPortalAdminsWorking);
  const editingAdmin = useSelector(selectEditingPortalAdmin);
  const adminToErase = useSelector(selectErasePortalAdmin);
  const session = useSelector(selectSession);
  const isSessionConfigured = useSelector(selectIsSessionConfigured);

  const canManageAdmins = isSessionConfigured
    ? canAccess(session, 'manage_admins')
    : true;

  const loading = status === 'idle' || status === 'loading';
  const modalOpen = Boolean(working.modalOpen);
  const modalError = working.modalError || '';
  const saving = Boolean(working.saving);
  const erasing = Boolean(working.erasing);
  const error = listError || working.actionError || null;

  useEffect(() => {
    dispatch(fetchPortalAdmins());
  }, [dispatch]);

  const handleToggleStatus = (admin) => {
    if (!canManageAdmins) return;
    if (admin.email === 'admin@teamforge.io') {
      return;
    }
    const newStatus = admin.status === 'active' ? 'suspended' : 'active';
    dispatch(updatePortalAdmin({ id: admin.id, payload: { status: newStatus } }));
  };

  const handleDelete = (admin) => {
    if (!canManageAdmins) return;
    if (admin.email === 'admin@teamforge.io') {
      return;
    }
    dispatch(setAdminToEraseId(admin.id));
  };

  const handleConfirmErase = () => {
    if (!adminToErase || !canManageAdmins) return;
    dispatch(deletePortalAdmin(adminToErase.id));
  };

  const handleModalSave = (payload) => {
    if (!canManageAdmins) return;
    if (editingAdmin) {
      dispatch(updatePortalAdmin({ id: editingAdmin.id, payload }));
    } else {
      dispatch(createPortalAdmin(payload));
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
          {Array.isArray(a.permissions) &&
            a.permissions.map((p) => (
              <span key={p} className="su-perm-tag">
                {permLabels[p] || p}
              </span>
            ))}
        </div>
      ),
    },
    {
      header: 'Authorized Since',
      key: 'createdAt',
      render: (a) => (
        <span style={{ color: 'var(--muted-fg)' }}>
          {a.createdAt
            ? new Date(a.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : '—'}
        </span>
      ),
    },
    {
      header: 'State',
      key: 'status',
      render: (a) => {
        const isSuspended = a.status !== 'active';
        return (
          <Badge variant={!isSuspended ? 'active' : 'locked'}>
            {!isSuspended ? 'Active' : 'Suspended'}
          </Badge>
        );
      },
    },
    {
      header: 'Operations',
      key: 'actions',
      align: 'right',
      render: (a) => {
        const isSuspended = a.status !== 'active';
        const isProtected = a.email === 'admin@teamforge.io';
        return (
          <div className="su-row-actions">
            <button
              className="btn btn-outline btn-xs su-action-btn"
              disabled={!canManageAdmins}
              onClick={() => dispatch(openAdminModal(a.id))}
            >
              Edit
            </button>
            {!isProtected ? (
              <>
                <button
                  className="btn btn-outline btn-xs su-action-btn"
                  disabled={!canManageAdmins}
                  onClick={() => handleToggleStatus(a)}
                >
                  {!isSuspended ? 'Suspend' : 'Activate'}
                </button>
                <button
                  className="btn btn-xs su-btn-danger su-action-btn"
                  disabled={!canManageAdmins}
                  onClick={() => handleDelete(a)}
                >
                  Erase
                </button>
              </>
            ) : (
              <span style={{ fontSize: '0.7rem', color: 'var(--muted-fg)', fontStyle: 'italic' }}>
                Protected
              </span>
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
        <button
          className="btn btn-primary"
          data-testid="new-portal-admin-btn"
          disabled={!canManageAdmins}
          title={!canManageAdmins ? 'Super User / manage_admins permission required' : undefined}
          onClick={() => dispatch(openAdminModal(null))}
        >
          + New Admin
        </button>
      </div>

      {!canManageAdmins && (
        <div className="su-form-error mt-3" data-testid="portal-admins-permission-notice">
          Super User or manage_admins permission is required to modify portal admins.
        </div>
      )}

      {error && <div className="su-form-error mt-4" data-testid="portal-admins-error">{error}</div>}

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

      {modalOpen && (
        <AdminModal
          admin={editingAdmin}
          saving={saving}
          error={modalError}
          onSave={handleModalSave}
          onValidationError={(msg) => dispatch(setPortalAdminModalError(msg))}
          onClose={() => dispatch(closeAdminModal())}
        />
      )}

      <ConfirmModal
        isOpen={Boolean(adminToErase)}
        title="Erase Administrator"
        message={`Are you sure you want to permanently erase admin "${adminToErase?.name}" (${adminToErase?.email})? All associated permissions will be revoked.`}
        confirmLabel="Erase Admin"
        variant="danger"
        loading={erasing}
        onConfirm={handleConfirmErase}
        onCancel={() => dispatch(setAdminToEraseId(null))}
      />
    </div>
  );
};

const SuperuserAdmins = SuperuserAdminsContent;
export default SuperuserAdmins;
