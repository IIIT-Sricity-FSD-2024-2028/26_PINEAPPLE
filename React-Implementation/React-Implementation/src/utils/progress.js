/**
 * Universal project progress calculation.
 * progress = totalTasks === 0 ? 0 : Math.round((approvedTasks / totalTasks) * 100)
 * Only approved/completed tasks count towards progress.
 */
export function calculateProjectProgress(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) return 0;
  const approvedTasks = tasks.filter((t) => {
    if (!t || !t.status) return false;
    const s = String(t.status).trim().toLowerCase();
    return s === 'completed' || s === 'approved' || s === 'done';
  }).length;
  return Math.round((approvedTasks / tasks.length) * 100);
}

export default calculateProjectProgress;
