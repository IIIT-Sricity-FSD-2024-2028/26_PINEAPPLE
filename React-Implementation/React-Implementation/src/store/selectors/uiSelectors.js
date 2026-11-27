import { createSelector } from '@reduxjs/toolkit';

export const selectUIState = (state) => state?.ui;
export const selectTheme = (state) => state?.ui?.theme || 'light';
export const selectSidebarOpen = (state) => state?.ui?.sidebarOpen ?? true;
export const selectToasts = (state) => state?.ui?.toasts || [];
export const selectOpenDropdowns = (state) => state?.ui?.openDropdowns || {};
export const selectIsDropdownOpen = (name) => (state) =>
  Boolean(state?.ui?.openDropdowns?.[name]);
export const selectActiveModal = (state) => state?.ui?.activeModal || null;
export const selectModalProps = (state) => state?.ui?.modalProps || null;
export const selectMaintenance = (state) =>
  state?.ui?.maintenance || { active: false, message: '' };
export const selectResettingBanner = (state) =>
  state?.ui?.resettingBanner || { active: false, message: '' };

export const selectHasAnyOpenDropdown = createSelector(
  [selectOpenDropdowns],
  (dropdowns) => Object.values(dropdowns).some(Boolean),
);
