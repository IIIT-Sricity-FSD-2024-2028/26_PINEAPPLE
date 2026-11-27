import DataTable from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';
import { formatMemberSince } from '../../utils/dateFormatter';
import { getProjectRole } from '../../utils/projectRole';

const TasksMilestonesCard = ({ tasks, project }) => {
  return (
    <div className="card admin-tasks-card">
      <h2 className="admin-card-title">Tasks &amp; Milestones</h2>
      <div className="admin-tasks-table-wrapper">
        <DataTable
          columns={[
            {
              header: 'Task Title',
              key: 'title',
              width: '36%',
              render: (task) => task.title || task.name || 'Untitled Task',
            },
            {
              header: 'Status',
              key: 'status',
              width: '22%',
              render: (task) => {
                const s = (task.status || '').toLowerCase();
                const variant =
                  s === 'completed' || s === 'approved'
                    ? 'completed'
                    : s === 'in review' || s === 'in-review'
                    ? 'in-review'
                    : 'in-progress';
                return (
                  <span className="admin-task-status-group">
                    <Badge variant={variant}>{task.status || 'Open'}</Badge>
                    {task.autoApproved && (
                      <Badge variant="info">Auto-approved after 7 days</Badge>
                    )}
                  </span>
                );
              },
            },
            {
              header: 'Assignee',
              key: 'assignee',
              width: '26%',
              render: (task) => {
                const assigneeName =
                  task.assignee?.name || task.assignee || task.assigneeId || 'Unassigned';
                const assigneeRole =
                  task.assigneeRole ||
                  (assigneeName !== 'Unassigned'
                    ? getProjectRole(project, task.assigneeId || task.assignee, assigneeName)
                    : null);

                if (assigneeName === 'Unassigned') {
                  return <span className="text-muted">Unassigned</span>;
                }

                return (
                  <span className="admin-task-assignee-group">
                    <span>{assigneeName}</span>
                    {assigneeRole && assigneeRole !== 'Former member' && (
                      <Badge
                        variant={
                          assigneeRole === 'Owner'
                            ? 'warning'
                            : assigneeRole === 'Mentor'
                            ? 'purple'
                            : 'info'
                        }
                      >
                        {assigneeRole}
                      </Badge>
                    )}
                  </span>
                );
              },
            },
            {
              header: 'Due Date',
              key: 'dueDate',
              width: '16%',
              render: (task) => (task.dueDate ? formatMemberSince(task.dueDate) : '—'),
            },
          ]}
          data={tasks}
          emptyTitle="No tasks yet"
          emptyMessage="No tasks found for this project."
        />
      </div>
    </div>
  );
};

export default TasksMilestonesCard;
