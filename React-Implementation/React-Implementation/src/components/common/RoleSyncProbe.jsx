import { useEffect } from 'react';

export function RoleSyncProbe() {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const timer = setTimeout(() => {
      const navbarEl = document.querySelector('[data-testid="navbar-role"]');
      const sidebarEl = document.querySelector('[data-testid="sidebar-role"]');
      const pageEl = document.querySelector('[data-testid="page-role"]');

      if (!navbarEl || !sidebarEl || !pageEl) return;

      const navbarRole = navbarEl.getAttribute('data-active-role');
      const sidebarRole = sidebarEl.getAttribute('data-active-role');
      const pageRole = pageEl.getAttribute('data-active-role');

      if (navbarRole && sidebarRole && pageRole) {
        if (navbarRole !== sidebarRole || navbarRole !== pageRole) {
          console.error(
            `ROLE OUT OF SYNC: navbar="${navbarRole}", sidebar="${sidebarRole}", page="${pageRole}"`
          );
        }
      }
    }, 0);

    return () => clearTimeout(timer);
  });

  return null;
}

export default RoleSyncProbe;
