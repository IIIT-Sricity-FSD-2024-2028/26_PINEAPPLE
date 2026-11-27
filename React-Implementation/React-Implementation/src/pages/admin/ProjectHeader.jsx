import Badge from '../../components/common/Badge';

const ProjectHeader = ({
  project,
  isClosed,
  isCompleted,
  activeTab,
  setActiveTab,
  onDeleteProject,
  navigate,
}) => {
  const statusLower = String(project.status || '').toLowerCase();
  const badgeVariant = project.deletedAt
    ? 'danger'
    : isCompleted
    ? 'completed'
    : isClosed
    ? 'danger'
    : statusLower === 'in progress'
    ? 'in-progress'
    : 'open';

  const badgeLabel = project.deletedAt
    ? 'Deleted'
    : isCompleted
    ? 'Completed'
    : isClosed
    ? 'Closed'
    : project.status || 'Open';

  return (
    <section className="admin-project-header-wrapper" aria-label="Project details header">
      <div className="admin-project-header-top">
        <button
          type="button"
          className="btn btn-outline admin-back-btn"
          onClick={() => navigate('/admin/projects')}
        >
          ← Back to Projects
        </button>
      </div>

      <div className="admin-project-header-row">
        <div className="admin-project-title-group">
          <h1 className="admin-project-title">
            {project.title || project.name || 'Untitled'}
          </h1>
          <Badge variant={badgeVariant} className="admin-project-status-badge">
            {badgeLabel}
          </Badge>
        </div>

        <div className="admin-project-header-actions">
          <div className="admin-project-tabs" role="tablist" aria-label="Project detail sections">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'overview'}
              className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveTab('overview')}
            >
              Overview &amp; Tasks
            </button>
            <button
              type="button"
              role="tab"
              data-testid="admin-project-escrow-tab"
              aria-selected={activeTab === 'escrow'}
              className={`btn ${activeTab === 'escrow' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveTab('escrow')}
            >
              Escrow &amp; Financials
            </button>
          </div>

          {!project.deletedAt && (
            <button
              type="button"
              data-testid="admin-delete-project-btn"
              className="btn btn-outline admin-delete-btn"
              onClick={onDeleteProject}
            >
              Delete Project
            </button>
          )}
        </div>
      </div>
    </section>
  );
};

export default ProjectHeader;
