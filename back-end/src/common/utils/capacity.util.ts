/**
 * Shared Project Capacity Utilities
 * Enforces collaborator capacity rules across projects, join requests, and platform configs.
 */

export function getApprovedCollaboratorsCount(project: any): number {
  if (!project) return 0;
  const collabs = Array.isArray(project.collaborators) ? project.collaborators : [];
  const ownerId = String(project.ownerId || (typeof project.owner === 'object' && project.owner ? project.owner.id || project.owner.userId : '') || '').trim();
  const mentorId = String(project.mentorId || project.mentorUserId || (typeof project.mentor === 'object' && project.mentor ? project.mentor.id || project.mentor.userId : '') || '').trim();
  const seen = new Set<string>();

  return collabs.filter((c: any) => {
    if (typeof c === 'object' && c !== null) {
      const cRole = String(c.role || '').trim().toLowerCase();
      if (cRole === 'owner' || cRole === 'mentor') return false;
    }
    const cId = typeof c === 'string' ? String(c).trim() : String(c?.id || c?.userId || '').trim();
    if (!cId) return false;
    if (ownerId && cId === ownerId) return false;
    if (mentorId && cId === mentorId) return false;
    if (seen.has(cId)) return false;

    const isRemoved = Array.isArray(project.removedUsers) && project.removedUsers.some((r: any) => {
      const rId = typeof r === 'object' ? String(r.userId || r.id || '').trim() : String(r || '').trim();
      return rId && rId === cId;
    });
    if (isRemoved) return false;

    seen.add(cId);
    return true;
  }).length;
}

export function getEffectiveMaxCollaborators(project: any, platformCap?: number): number {
  const maxCapLimit = platformCap && Number(platformCap) > 0 ? Number(platformCap) : 20;
  const projectMax =
    project && Number(project.maxCollaborators) > 0
      ? Number(project.maxCollaborators)
      : project && Number(project.teamSize) > 0
        ? Number(project.teamSize)
        : 5;
  return Math.min(projectMax, maxCapLimit);
}

export function isProjectFull(project: any, platformCap?: number): boolean {
  if (!project) return false;
  const count = getApprovedCollaboratorsCount(project);
  const max = getEffectiveMaxCollaborators(project, platformCap);
  return count >= max;
}
