import Avatar from '../../components/common/Avatar';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import { getProjectRole } from '../../utils/projectRole';

const TeamMembersCard = ({ project }) => {
  const members = Array.isArray(project.members) && project.members.length > 0
    ? project.members
    : Array.isArray(project.collaborators) && project.collaborators.length > 0
    ? project.collaborators
    : [];

  return (
    <div className="card admin-team-card">
      <h2 className="admin-card-title">Team Members</h2>
      <div className="admin-team-card-body">
        {members.length > 0 ? (
          <ul className="admin-team-members-list">
            {members.map((member, index) => {
              const memberId = member.id || member;
              const memberName = member.name || member.id || 'Member';
              const role = getProjectRole(project, memberId, member.name) || member.role || 'Collaborator';
              const isFormer = role === 'Former member';
              const badgeVariant =
                role === 'Owner'
                  ? 'warning'
                  : role === 'Mentor'
                  ? 'purple'
                  : 'info';

              return (
                <li key={member.id || index} className="admin-team-member-row">
                  <div className="admin-team-member-info">
                    <Avatar name={memberName} size="sm" />
                    <span className="admin-team-member-name" title={memberName}>
                      {memberName}
                    </span>
                  </div>
                  <div className="admin-team-member-badge">
                    {!isFormer ? (
                      <Badge variant={badgeVariant}>{role}</Badge>
                    ) : (
                      <span className="text-muted text-sm">Former member</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon="👥"
            title="No team members yet"
            message="This project currently has no assigned team members."
          />
        )}
      </div>
    </div>
  );
};

export default TeamMembersCard;
