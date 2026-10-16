import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import joinRequestsApi from '../../services/joinRequestsApi';
import projectsApi, { isProjectLocked } from '../../services/projectsApi';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import DataTable from '../../components/common/DataTable';
import './appliedProjects.css';

const AppliedProjects = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const effectiveUserId = user?.id || (typeof localStorage !== 'undefined' && localStorage.getItem('teamforge.backendUserId')) || '';

  useEffect(() => {
    let isMounted = true;
    const loadApplications = async () => {
      try {
        const [requests, allProjects] = await Promise.all([
          joinRequestsApi.list({ userId: effectiveUserId }).catch(() => []),
          projectsApi.list().catch(() => []),
        ]);

        const projectsMap = new Map();
        if (Array.isArray(allProjects)) {
          allProjects.forEach((p) => projectsMap.set(p.id, p));
        }

        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('teamforge.invites');
          localStorage.removeItem('runtime.invites');
          localStorage.removeItem('invites');
        }

        const enriched = (Array.isArray(requests) ? requests : [])
          .filter((req) => req.status !== 'Invited' && req.status !== 'Declined')
          .map((req) => {
            const matchedProject = projectsMap.get(req.projectId) || {};
            const removedRec = Array.isArray(matchedProject.removedUsers)
              ? matchedProject.removedUsers.find(
                  (r) =>
                    String(r.userId) === String(effectiveUserId) ||
                    (user?.name && r.userName && r.userName.toLowerCase() === user.name.toLowerCase())
                )
              : null;
            const status = req.status || (removedRec ? 'Removed' : 'Pending');
            const removalReason = req.removalReason || req.reason || removedRec?.reason;
            return {
              id: req.id,
              projectId: req.projectId,
              project: matchedProject.title || matchedProject.name || req.projectName || 'Project',
              owner: matchedProject.owner || req.owner || 'Project Owner',
              applied: req.createdAt ? new Date(req.createdAt).toLocaleDateString() : 'Recent',
              status,
              removalReason,
              isLocked: isProjectLocked(matchedProject),
            };
          });

        if (Array.isArray(allProjects)) {
          allProjects.forEach((p) => {
            if (Array.isArray(p.removedUsers)) {
              const rec = p.removedUsers.find(
                (r) =>
                  String(r.userId) === String(effectiveUserId) ||
                  (user?.name && r.userName && r.userName.toLowerCase() === user.name.toLowerCase())
              );
              if (rec && !enriched.some((item) => item.projectId === p.id)) {
                enriched.push({
                  id: `removed-${p.id}`,
                  projectId: p.id,
                  project: p.title || p.name || 'Project',
                  owner: p.owner || 'Project Owner',
                  applied: rec.removedAt ? new Date(rec.removedAt).toLocaleDateString() : 'Recent',
                  status: 'Removed',
                  removalReason: rec.reason,
                  isLocked: isProjectLocked(p),
                });
              }
            }
          });
        }

        if (isMounted) {
          setApplications(enriched);
        }
      } catch (err) {
        console.error('Failed to load applied projects:', err);
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
  }, [effectiveUserId, refreshKey, user?.name]);

  const handleDeleteRequest = async (requestId) => {
    const target = applications.find((item) => item.id === requestId);
    if (target?.isLocked) {
      setFeedback({ type: 'error', message: 'Project is locked. Join requests cannot be withdrawn.' });
      return;
    }
    setDeletingId(requestId);
    setFeedback(null);
    try {
      await joinRequestsApi.remove(requestId);
      setApplications((prev) => prev.filter((item) => item.id !== requestId));
      setFeedback({ type: 'success', message: 'Application request cancelled successfully.' });
      setTimeout(() => setFeedback(null), 3500);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      if (err.message && (err.message.toLowerCase().includes('not found') || err.message.includes('404'))) {
        setApplications((prev) => prev.filter((item) => item.id !== requestId));
        setFeedback({ type: 'success', message: 'Application request was already removed.' });
        setTimeout(() => setFeedback(null), 3500);
      } else {
        console.error('Failed to cancel application request:', err);
        setFeedback({ type: 'error', message: err.message || 'Failed to cancel application request.' });
      }
    } finally {
      setDeletingId(null);
    }
  };

  const columns = [
    {
      header: 'Project',
      accessor: 'project',
      sortable: true,
      render: (item) => <span className="tf-applied-project-name">{item.project}</span>,
    },
    {
      header: 'Owner',
      accessor: 'owner',
      sortable: true,
      render: (item) => <span className="tf-applied-owner">{item.owner}</span>,
    },
    {
      header: 'Applied',
      accessor: 'applied',
      sortable: true,
      render: (item) => <span className="tf-applied-date">{item.applied}</span>,
    },
    {
      header: 'Status',
      accessor: 'status',
      sortable: true,
      render: (item) => (
        <div className="tf-applied-status-wrap">
          {item.status === 'Pending' ? (
            <>
              <Badge variant={item.status}>{item.status}</Badge>
              {!item.isLocked && (
                <button
                  type="button"
                  className="tf-applied-btn-sm tf-applied-btn-outline"
                  disabled={deletingId === item.id}
                  onClick={() => handleDeleteRequest(item.id)}
                >
                  {deletingId === item.id ? 'Deleting...' : 'Delete Request'}
                </button>
              )}
            </>
          ) : item.status === 'Removed' ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
              <Badge variant="removed">Removed</Badge>
              {item.removalReason && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: '#be123c',
                    fontStyle: 'italic',
                    maxWidth: '240px',
                    lineHeight: '1.2',
                  }}
                  title={item.removalReason}
                >
                  Reason: {item.removalReason}
                </span>
              )}
            </div>
          ) : (
            <Badge variant={item.status}>{item.status}</Badge>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="tf-applied-container">
      <div className="tf-applied-header">
        <h1 className="tf-applied-title">Applied Projects</h1>
        <p className="tf-applied-subtitle">Track the status of your project applications.</p>
        {feedback && (
          <div className={`tf-applied-feedback ${feedback.type === 'error' ? 'tf-applied-feedback-error' : 'tf-applied-feedback-success'}`}>
            {feedback.message}
          </div>
        )}
      </div>

      <div style={{ marginTop: '20px' }}>
        <DataTable
          columns={columns}
          data={applications}
          loading={loading}
          loadingMessage="Loading application statuses..."
          emptyMessage={
            <EmptyState
              title="No applications found"
              message="Explore the Marketplace to discover and apply for projects!"
              actionLabel="Browse Marketplace"
              onAction={() => navigate('/projects')}
            />
          }
        />
      </div>
    </div>
  );
};

export default AppliedProjects;
