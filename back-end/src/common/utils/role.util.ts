/**
 * Normalizes role names into canonical role identifiers:
 * - 'project owner', 'project-owner', 'owner' -> 'project-owner'
 * - 'admin', 'administrator', 'portal admin', 'portal_admin', 'portal-admin' -> 'admin'
 * - 'superuser', 'super user', 'super-user', 'super_user', 'superadmin', 'super-admin' -> 'superuser'
 * - 'mentor' -> 'mentor'
 * - 'collaborator', 'collab', 'member' -> 'collaborator'
 * - 'user' -> 'user'
 */
export function normalizeRole(role: string): string {
  const normalized = String(role || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-');
  if (['project-owner', 'owner', 'projectowner'].includes(normalized)) {
    return 'project-owner';
  }
  if (
    [
      'superuser',
      'super-user',
      'super_user',
      'superadmin',
      'super-admin',
      'super_admin',
    ].includes(normalized)
  ) {
    return 'superuser';
  }
  if (
    [
      'admin',
      'administrator',
      'portal-admin',
      'portaladmin',
      'finance-admin',
    ].includes(normalized)
  ) {
    return 'admin';
  }
  if (['mentor'].includes(normalized)) {
    return 'mentor';
  }
  if (['collaborator', 'collab', 'member'].includes(normalized)) {
    return 'collaborator';
  }
  if (['user'].includes(normalized)) {
    return 'user';
  }
  return normalized;
}

/**
 * Checks whether the given user is the project owner of the specified project.
 * Compares by user ID only.
 * The role requirement is the role claim "Project Owner" (normalised in one place)
 * plus ownership of this specific project.
 */
export function isProjectOwner(project: any, user: any): boolean {
  if (!project || !user) {
    return false;
  }

  // Extract project's owner ID
  const projectOwnerId = project.ownerId !== undefined && project.ownerId !== null
    ? String(project.ownerId).trim()
    : (project.owner && typeof project.owner === 'object' && project.owner.id
        ? String(project.owner.id).trim()
        : '');
  if (!projectOwnerId) {
    return false;
  }

  // Extract user ID
  const userId = typeof user === 'string'
    ? user.trim()
    : String(user.uid || user.id || user.userId || user.sub || '').trim();
  if (!userId) {
    return false;
  }

  // Role requirement: The role claim "Project Owner" (normalised in one place)
  const role = typeof user === 'object' && user !== null
    ? (user.role || user.roleName || user.userRole || user.claims?.role)
    : undefined;

  if (role) {
    const normalizedRole = normalizeRole(role);
    if (normalizedRole !== 'project-owner') {
      return false;
    }
  }

  // Comparing by user id only
  return projectOwnerId === userId;
}

/**
 * Checks whether the given user has platform administrator or superuser role.
 */
export function isPlatformAdminOrSuperUser(user: any): boolean {
  if (!user) return false;
  const role = typeof user === 'string'
    ? user
    : (user.role || user.roleName || user.userRole || user.claims?.role);
  if (!role) return false;
  const normalized = normalizeRole(role);
  return normalized === 'admin' || normalized === 'superuser';
}

export type ProjectMemberRole = 'Owner' | 'Mentor' | 'Collaborator' | 'Former member' | null;

/**
 * Computes a person's role inside a project based ONLY on that project's membership:
 * - Owner: project.ownerId matches userId
 * - Mentor: project.mentorId / accepted mentor matches userId
 * - Collaborator: an approved collaborator / member of the project (not removed)
 * - Former member: in removedUsers
 * - null: not a member of the project
 *
 * Enforces role priority: Owner > Mentor > Collaborator > Former member.
 * Compares by user ID only to prevent accidental name collisions.
 */
export function getProjectRole(project: any, userIdOrUser: any): ProjectMemberRole {
  if (!project || !userIdOrUser) return null;

  const targetId = String(
    typeof userIdOrUser === 'object' && userIdOrUser !== null
      ? (userIdOrUser.id || userIdOrUser.uid || userIdOrUser.userId || '')
      : (userIdOrUser || ''),
  ).trim();

  if (!targetId) return null;

  // 1. Owner check
  const ownerId = String(
    project.ownerId !== undefined && project.ownerId !== null
      ? project.ownerId
      : (typeof project.owner === 'object' && project.owner !== null ? (project.owner.id || project.owner.userId || '') : ''),
  ).trim();

  if (ownerId && ownerId === targetId) {
    return 'Owner';
  }

  // 2. Mentor check (accepted or assigned mentor)
  const mentorId = String(
    project.mentorId !== undefined && project.mentorId !== null
      ? project.mentorId
      : (typeof project.mentor === 'object' && project.mentor !== null ? (project.mentor.id || project.mentor.userId || '') : ''),
  ).trim();

  if (mentorId && mentorId === targetId) {
    return 'Mentor';
  }

  // 3. Removed / Former member check
  const removedUsers = Array.isArray(project.removedUsers) ? project.removedUsers : [];
  const isRemoved = removedUsers.some((r: any) => {
    const rId = String(typeof r === 'object' ? (r.userId || r.id || '') : r).trim();
    return rId && rId === targetId;
  });

  // 4. Collaborator check (approved member, not removed)
  if (!isRemoved) {
    const collabs = [
      ...(Array.isArray(project.collaborators) ? project.collaborators : []),
      ...(Array.isArray(project.members) ? project.members : []),
    ];

    const isCollab = collabs.some((c: any) => {
      if (!c) return false;
      const cRole = typeof c === 'object' && c.role ? String(c.role).trim().toLowerCase() : '';
      // Ignore if this entry was labeled Owner or Mentor
      if (cRole === 'owner' || cRole === 'mentor') return false;

      const cId = String(typeof c === 'object' ? (c.id || c.userId || '') : c).trim();
      return cId && cId === targetId;
    });

    if (isCollab) {
      return 'Collaborator';
    }
  }

  if (isRemoved) {
    return 'Former member';
  }

  return null;
}

export function isProjectMember(project: any, userIdOrUser: any): boolean {
  const role = getProjectRole(project, userIdOrUser);
  return role === 'Owner' || role === 'Mentor' || role === 'Collaborator';
}

