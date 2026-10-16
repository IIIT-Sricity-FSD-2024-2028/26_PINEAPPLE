export function isProjectLocked(project) {
  if (!project) return false;
  if (project.isCompleted === true || project.is_completed === true) return true;
  const status = String(project.status || '').toLowerCase().trim();
  return status === 'completed';
}

export function isProjectActive(project) {
  if (!project) return false;
  if (isProjectLocked(project)) return false;
  const status = String(project.status || '').toLowerCase().trim();
  return status !== 'completed' && status !== 'cancelled' && status !== 'archived';
}

export default {
  isProjectLocked,
  isProjectActive,
};
