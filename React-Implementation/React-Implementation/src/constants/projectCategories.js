export const PROJECT_CATEGORIES = [
  'Web App',
  'Mobile App',
  'Data & AI',
  'Design',
  'Research',
  'Open Source',
  'Hardware',
  'Other',
  'General',
];

export const STARTER_TASK_CONSTRAINTS = {
  minTitleLength: 5,
  maxTitleLength: 80,
  minDescriptionLength: 20,
  maxDescriptionLength: 300,
};

export function formatStarterTaskError(code, fallbackMessage = '') {
  switch (String(code || '').toUpperCase()) {
    case 'TASK_LIMIT_REACHED':
      return 'Project task limit reached (maximum 30 tasks allowed per project).';
    case 'TEMPLATE_TASK_EXISTS':
      return 'A task with this title already exists in this project.';
    case 'CONTENT_NOT_ALLOWED':
      return fallbackMessage || 'Starter task contains content that is not allowed on TeamForge.';
    default:
      return fallbackMessage || 'Unable to add starter task.';
  }
}

export default {
  PROJECT_CATEGORIES,
  STARTER_TASK_CONSTRAINTS,
  formatStarterTaskError,
};
