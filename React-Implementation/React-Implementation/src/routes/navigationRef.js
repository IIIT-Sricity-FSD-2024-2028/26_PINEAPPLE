let registeredNavigate = null;

/**
 * Registers the React Router `navigate` function from the top-level `<App />` shell
 * so non-component helpers (e.g. `apiClient`, `tokenManager`, `ErrorBoundary`) can perform
 * client-side SPA transitions without triggering full-page reloads.
 */
export function setAppNavigate(navigateFn) {
  registeredNavigate = typeof navigateFn === 'function' ? navigateFn : null;
}

export function navigateWithAppRouter(to, options = {}) {
  if (registeredNavigate) {
    registeredNavigate(to, options);
    return true;
  }
  return false;
}
