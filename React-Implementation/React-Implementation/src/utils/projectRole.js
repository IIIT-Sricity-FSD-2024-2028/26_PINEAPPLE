/**
 * Canonical helper to determine a person's role inside a project strictly based on project membership.
 * Never uses global role, navbar active role, or time of action.
 *
 * @param {Object} project
 * @param {string|Object} userIdOrUser
 * @param {string} [userName]
 * @returns {'Owner'|'Mentor'|'Collaborator'|'Former member'|null}
 */
export function getProjectRole(project, userIdOrUser, userName = '') {
  if (!project || !userIdOrUser) return null;

  const targetId = String(
    typeof userIdOrUser === 'object' && userIdOrUser !== null
      ? (userIdOrUser.id || userIdOrUser.userId || userIdOrUser.uid || '')
      : userIdOrUser
  ).trim();

  const targetName = (
    userName ||
    (typeof userIdOrUser === 'object' && userIdOrUser !== null
      ? (userIdOrUser.name || userIdOrUser.username || '')
      : (typeof userIdOrUser === 'string' && !/^\d+$/.test(userIdOrUser) ? userIdOrUser : ''))
  ).trim().toLowerCase();

  // 1. Owner check
  const ownerId = String(
    project.ownerId !== undefined && project.ownerId !== null
      ? project.ownerId
      : (typeof project.owner === 'object' && project.owner !== null ? (project.owner.id || project.owner.userId || '') : '')
  ).trim();
  const ownerName = typeof project.owner === 'string'
    ? project.owner.trim().toLowerCase()
    : (typeof project.owner === 'object' && project.owner !== null && project.owner.name ? String(project.owner.name).trim().toLowerCase() : '');

  if ((ownerId && targetId && ownerId === targetId) || (ownerName && targetName && ownerName === targetName)) {
    return 'Owner';
  }

  // 2. Mentor check (accepted mentor)
  const mentorId = String(
    project.mentorId !== undefined && project.mentorId !== null
      ? project.mentorId
      : (typeof project.mentor === 'object' && project.mentor !== null ? (project.mentor.id || project.mentor.userId || '') : '')
  ).trim();
  const mentorName = typeof project.mentor === 'string'
    ? project.mentor.trim().toLowerCase()
    : (typeof project.mentor === 'object' && project.mentor !== null && (project.mentor.name || project.mentor.title) ? String(project.mentor.name || project.mentor.title).trim().toLowerCase() : '');

  if ((mentorId && targetId && mentorId === targetId) || (mentorName && targetName && mentorName === targetName && mentorName !== 'none assigned yet')) {
    return 'Mentor';
  }

  // 3. Former member check (removed or left) - evaluated before collaborator to prevent stale member entries
  const removedUsers = Array.isArray(project.removedUsers) ? project.removedUsers : [];
  const isRemoved = removedUsers.some((r) => {
    const rId = String(typeof r === 'object' ? (r.userId || r.id || '') : r).trim();
    const rName = typeof r === 'object' && r.userName ? String(r.userName).trim().toLowerCase() : '';
    if (rId && targetId && rId === targetId) return true;
    if (rName && targetName && rName === targetName) return true;
    return false;
  });

  if (isRemoved) {
    return 'Former member';
  }

  // 4. Collaborator check (approved member)
  const collabs = [
    ...(Array.isArray(project.collaborators) ? project.collaborators : []),
    ...(Array.isArray(project.members) ? project.members : []),
  ];

  const isCollab = collabs.some((c) => {
    if (!c) return false;
    const cId = String(typeof c === 'object' ? (c.id || c.userId || '') : c).trim();
    const cName = typeof c === 'object' && (c.name || c.username) ? String(c.name || c.username).trim().toLowerCase() : (typeof c === 'string' ? c.trim().toLowerCase() : '');
    const cRole = typeof c === 'object' && c.role ? String(c.role).trim().toLowerCase() : '';

    if (cRole === 'owner' || cRole === 'mentor') return false;

    if (cId && targetId && cId === targetId) return true;
    if (cName && targetName && cName === targetName) return true;
    return false;
  });

  if (isCollab) {
    return 'Collaborator';
  }

  return null;
}
