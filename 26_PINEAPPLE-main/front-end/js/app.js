// Expose handlers for existing inline onclick bindings in HTML/templates.
[
  "navigate",
  "toggleSidebar",
  "toggleDropdown",
  "closeDropdowns",
  "showToast",
  "setRole",
  "tryMentor",
  "initializeMentorStatus",
  "switchLeaderboard",
  "viewUserProfile",
  "addSkill",
  "removeSkill",
  "applyTheme",
  "saveProfileSettings",
  "saveNotificationSettings",
  "savePrivacySettings",
  "saveAppearanceSettings",
  "filterFaq",
  "toggleFaq",
  "submitSupportRequest",
  "filterProjects",
  "submitMentorApp",
  "showAdmin",
  "hideAdmin",
  "exitAdmin",
  "adminLogin",
  "showAdminPage",
  "renderAdminUsers",
  "setAdminUsersSearch",
  "setAdminUsersFilter",
  "setAdminMentorFilter",
  "toggleAdminMentorAppDetails",
  "setAdminAuditSearch",
  "setAdminAuditFilter",
  "toggleAdminUserMenu",
  "adminModerateUser",
  "adminViewUser",
  "approveApp",
  "rejectApp",
  "createProject",
  "openWorkspace",
  "openCollaboratorProjectPreview",
  "applyToPreviewProject",
  "setCollaboratorWorkspaceTab",
  "startCollaboratorTask",
  "openCollaboratorSubmitModal",
  "closeCollaboratorSubmitModal",
  "updateCollaboratorProofLink",
  "submitCollaboratorProof",
  "sendCollaboratorChatMessage",
  "openOwnedProject",
  "openOwnedSummary",
  "closeOwnedSummary",
  "setOwnedWorkspaceTab",
  "requestOwnedMentor",
  "sendOwnedChatMessage",
  "openOwnedTaskModal",
  "closeOwnedTaskModal",
  "inviteOwnedTaskMember",
  "createOwnedTask",
  "openArchiveModal",
  "closeArchiveModal",
  "openReportModal",
  "closeReportModal",
  "backToArchive",
  "openContributionSummary",
  "closeContributionSummary",
  "renderMyWork",
  "resetCreatedProjects",
  "removeProjectMentor",
  "leaveMentorProject",
  "deleteMentorRequest",
  "deleteJoinRequest",
  "suOpenAdminModal",
  "suCloseAdminModal",
  "suSaveAdmin",
  "suDeleteAdmin",
  "suToggleAdminStatus",
  "suDeleteProject",
  "suSaveConfig",
  "openSuperuserAdmin",
  "renderSuperuserAdminButton",
  "isSuperUser",
].forEach((handlerName) => {
  if (typeof window[handlerName] === "function") {
    window[handlerName] = window[handlerName];
  }
});

function init() {
  try {
    const currentEmail = typeof localStorage !== "undefined" ? localStorage.getItem("currentUser") : null;
    if (currentEmail && typeof reinitializeStateForUser === "function") {
      reinitializeStateForUser(currentEmail);
    }

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
    
    console.log("Starting init pipeline");
    initializeMentorStatus();
    console.log("Passed initializeMentorStatus");
    renderSuperuserAdminButton();
    console.log("Passed renderSuperuserAdminButton");
    updateRoleUI();
    console.log("Passed updateRoleUI");
    renderSettings();
    console.log("Passed renderSettings");
    renderProjects();
    console.log("Passed renderProjects");
    renderApplied();
    console.log("Passed renderApplied");
    renderMyProjects();
    console.log("Passed renderMyProjects");
    renderMentors();
    console.log("Passed renderMentors");
    renderMentorRequests();
    console.log("Passed renderMentorRequests");
    renderMentoredProjects();
    console.log("Passed renderMentoredProjects");
    switchLeaderboard("weekly", document.querySelector("#page-leaderboard .tab"));
    console.log("Passed switchLeaderboard");
    initializeBrowserNavigation();
    console.log("Init complete");
  } catch (error) {
    console.error("CRASH IN INIT", error);
    if (typeof showToast === 'function') showToast("Init Error: " + error.message, "error");
  }
}

init();
