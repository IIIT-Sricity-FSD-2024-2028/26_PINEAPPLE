// Expose handlers for existing inline onclick bindings in HTML/templates.
Object.assign(window, {
  navigate,
  toggleSidebar,
  toggleDropdown,
  closeDropdowns,
  showToast,
  setRole,
  tryMentor,
  initializeMentorStatus,
  switchLeaderboard,
  viewUserProfile,
  addSkill,
  removeSkill,
  applyTheme,
  saveProfileSettings,
  saveNotificationSettings,
  savePrivacySettings,
  saveAppearanceSettings,
  filterFaq,
  toggleFaq,
  submitSupportRequest,
  filterProjects,
  submitMentorApp,
  showAdmin,
  hideAdmin,
  exitAdmin,
  adminLogin,
  showAdminPage,
  renderAdminUsers,
  setAdminUsersSearch,
  setAdminUsersFilter,
  setAdminMentorFilter,
  toggleAdminMentorAppDetails,
  setAdminAuditSearch,
  setAdminAuditFilter,
  toggleAdminUserMenu,
  adminModerateUser,
  adminViewUser,
  approveApp,
  rejectApp,
  createProject,
  openWorkspace,
  openCollaboratorProjectPreview,
  applyToPreviewProject,
  setCollaboratorWorkspaceTab,
  startCollaboratorTask,
  openCollaboratorSubmitModal,
  closeCollaboratorSubmitModal,
  updateCollaboratorProofLink,
  submitCollaboratorProof,
  sendCollaboratorChatMessage,
  openOwnedProject,
  openOwnedSummary,
  closeOwnedSummary,
  setOwnedWorkspaceTab,
  requestOwnedMentor,
  sendOwnedChatMessage,
  openOwnedTaskModal,
  closeOwnedTaskModal,
  inviteOwnedTaskMember,
  createOwnedTask,
  openArchiveModal,
  closeArchiveModal,
  openReportModal,
  closeReportModal,
  backToArchive,
  openContributionSummary,
  closeContributionSummary,
  renderMyWork,
  resetCreatedProjects,
  // Super User
  suOpenAdminModal,
  suCloseAdminModal,
  suSaveAdmin,
  suDeleteAdmin,
  suToggleAdminStatus,
  suDeleteProject,
  suSaveConfig,
  openSuperuserAdmin,
  renderSuperuserAdminButton,
  // Auth functions
  isSuperUser,
});

function init() {
  if (typeof getCurrentUserRecord === "function") {
    const currentRecord = getCurrentUserRecord();
    if (String(currentRecord?.status || "").trim().toLowerCase() === "suspended") {
      if (typeof logoutUser === "function") {
        logoutUser();
      }
      window.location.href = "log.html";
      return;
    }
  }
  initializeMentorStatus();
  renderSuperuserAdminButton();
  updateRoleUI();
  renderSettings();
  renderProjects();
  renderApplied();
  renderMyProjects();
  renderMentors();
  renderMentorRequests();
  renderMentoredProjects();
  switchLeaderboard("weekly", document.querySelector("#page-leaderboard .tab"));
  initializeBrowserNavigation();
}

init();
