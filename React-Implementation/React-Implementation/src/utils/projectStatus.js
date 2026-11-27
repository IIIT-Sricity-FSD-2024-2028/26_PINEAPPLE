/**
 * Shared pure project lifecycle predicates safe for import inside Redux slices,
 * selectors, and React components (zero API/transport coupling).
 */

export function isProjectLocked(project) {
  if (!project) return false;
  if (project.isCompleted === true || project.is_completed === true) return true;
  if (project.deletionScheduledAt) return true;
  const status =
    typeof project.status === 'string' ? project.status.toLowerCase() : '';
  return (
    status === 'completed' ||
    status === 'closed' ||
    status === 'deleted' ||
    status === 'deletion_scheduled'
  );
}

export function isProjectActive(project) {
  if (!project) return false;
  if (isProjectLocked(project)) return false;
  const status = String(project.status || '')
    .toLowerCase()
    .trim();
  return (
    status !== 'completed' &&
    status !== 'closed' &&
    status !== 'cancelled' &&
    status !== 'archived'
  );
}

/**
 * Computes collaborator seat usage and limit strictly from a project entity in the store.
 * Owner and Mentor never count toward used collaborator seats.
 */
export function getProjectSeatCounts(project) {
  if (!project) {
    return { used: 0, limit: 5, isFull: false };
  }

  const limit =
    Number(project.maxCollaborators) > 0
      ? Number(project.maxCollaborators)
      : Number(project.teamSize) > 0
        ? Number(project.teamSize)
        : 5;

  const ownerId = String(
    project.ownerId ||
      (typeof project.owner === 'object' && project.owner
        ? project.owner.id || project.owner.userId || ''
        : '') ||
      '',
  ).trim();
  const mentorId = String(
    project.mentorId ||
      project.mentorUserId ||
      (typeof project.mentor === 'object' && project.mentor
        ? project.mentor.id || project.mentor.userId || ''
        : '') ||
      '',
  ).trim();

  const removedSet = new Set(
    (Array.isArray(project.removedUsers) ? project.removedUsers : [])
      .map((r) =>
        String(typeof r === 'object' && r !== null ? r.userId || r.id || '' : r || '').trim(),
      )
      .filter(Boolean),
  );

  const countCollaborators = (arr) => {
    const seen = new Set();
    let count = 0;
    for (const entry of arr) {
      if (!entry) continue;
      if (typeof entry === 'object') {
        const role = String(entry.role || '').trim().toLowerCase();
        if (role === 'owner' || role === 'mentor') continue;
      }
      const id =
        typeof entry === 'string'
          ? entry.trim()
          : String(entry.id || entry.userId || '').trim();
      if (!id) continue;
      if (ownerId && id === ownerId) continue;
      if (mentorId && id === mentorId) continue;
      if (removedSet.has(id)) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      count += 1;
    }
    return count;
  };

  let used;
  const hasCollabs = Array.isArray(project.collaborators);
  const hasMembers = Array.isArray(project.members) && project.members.length > 0;
  if (hasCollabs) {
    used = countCollaborators(project.collaborators);
  } else if (hasMembers) {
    used = countCollaborators(project.members);
  } else {
    used = Number(project.approvedCollaboratorCount ?? project.collaboratorCount) || 0;
  }

  const hasExplicitCapacity =
    hasCollabs ||
    hasMembers ||
    project.approvedCollaboratorCount !== undefined ||
    project.collaboratorCount !== undefined;

  return {
    used,
    limit,
    isFull: hasExplicitCapacity ? used >= limit : Boolean(project.isFull),
  };
}
