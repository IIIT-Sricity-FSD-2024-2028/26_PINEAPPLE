export const ROLE_CANONICAL = {
  COLLABORATOR: 'Collaborator',
  PROJECT_OWNER: 'Project Owner',
  MENTOR: 'Mentor',
};

const ROLE_HOMES = {
  [ROLE_CANONICAL.COLLABORATOR]: '/dashboard',
  [ROLE_CANONICAL.PROJECT_OWNER]: '/owner/dashboard',
  [ROLE_CANONICAL.MENTOR]: '/mentor/projects',
};

export function canonicalRole(role) {
  if (!role) return ROLE_CANONICAL.COLLABORATOR;
  const str = String(role).trim().toLowerCase().replace(/[_\s-]+/g, '');
  if (str === 'projectowner' || str === 'owner') return ROLE_CANONICAL.PROJECT_OWNER;
  if (str === 'mentor') return ROLE_CANONICAL.MENTOR;
  if (str === 'collaborator' || str === 'collab' || str === 'member') {
    return ROLE_CANONICAL.COLLABORATOR;
  }
  if (str === 'admin' || str === 'administrator' || str === 'superuser') return role;
  return role;
}

export function getHomePathForRole(role) {
  const canonical = canonicalRole(role);
  return ROLE_HOMES[canonical] || '/dashboard';
}

export function computeAllowedRoles(user, isMentorApproved = false) {
  const roles = [ROLE_CANONICAL.COLLABORATOR, ROLE_CANONICAL.PROJECT_OWNER];
  const explicitMentor = Boolean(
    isMentorApproved ||
      user?.mentorUnlocked ||
      user?.profile?.mentorUnlocked ||
      canonicalRole(user?.role) === ROLE_CANONICAL.MENTOR,
  );
  if (explicitMentor && !roles.includes(ROLE_CANONICAL.MENTOR)) {
    roles.push(ROLE_CANONICAL.MENTOR);
  }
  return roles;
}
