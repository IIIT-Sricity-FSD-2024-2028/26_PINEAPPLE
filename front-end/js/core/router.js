let __suppressHashNavigation = false;

function getActivePageName() {
  return document.querySelector(".page.active")?.id?.replace("page-", "") || "";
}

function renderPageByName(page) {
  const renders = {
    dashboard: () => window.renderDashboard?.(),
    projects: () => window.renderProjects?.(),
    leaderboard: () =>
      window.switchLeaderboard?.("weekly", document.querySelector(".tab")),
    notifications: () => window.renderNotifications?.(),
    profile: () => window.renderProfile?.(null),
    settings: () => window.renderSettings?.(),
    help: () => window.renderHelp?.(),
    "applied-projects": () => window.renderApplied?.(),
    "my-projects": () => window.renderMyProjects?.(),
    "my-work": () => window.renderMyWork?.(),
    "project-workspace": () => window.renderProjectWorkspace?.(),
    mentors: () => window.renderMentors?.(),
    "mentor-requests": () => window.renderMentorRequests?.(),
    "mentored-projects": () => window.renderMentoredProjects?.(),
  };
  if (renders[page]) renders[page]();
}

function setHashPage(page, replaceHistory) {
  const nextHash = `#${page}`;
  if (window.location.hash === nextHash) return;
  __suppressHashNavigation = true;
  if (replaceHistory && typeof history !== "undefined" && history.replaceState) {
    history.replaceState({ page }, "", nextHash);
  } else {
    window.location.hash = page;
  }
  window.setTimeout(() => {
    __suppressHashNavigation = false;
  }, 0);
}

function navigate(page, options = {}) {
  closeDropdowns();
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  const target = document.getElementById("page-" + page);
  if (target) target.classList.add("active");

  document
    .querySelectorAll(".sidebar-nav-item")
    .forEach((b) => b.classList.remove("active"));
  const btn = document.querySelector(`[data-page="${page}"]`);
  if (btn) btn.classList.add("active");

  renderPageByName(page);

  if (!options.skipHistory) {
    setHashPage(page, Boolean(options.replaceHistory));
  }
  if (typeof saveViewState === "function") {
    saveViewState();
  }
}

function initializeBrowserNavigation() {
  const pageFromHash = window.location.hash.replace(/^#/, "");
  const initialPage =
    pageFromHash && document.getElementById("page-" + pageFromHash)
      ? pageFromHash
      : "dashboard";

  navigate(initialPage, { skipHistory: true });
  setHashPage(initialPage, true);
  if (typeof saveViewState === "function") {
    saveViewState();
  }

  window.addEventListener("hashchange", () => {
    if (__suppressHashNavigation) return;
    const targetPage = window.location.hash.replace(/^#/, "") || "dashboard";
    if (!document.getElementById("page-" + targetPage)) return;
    navigate(targetPage, { skipHistory: true });
    if (typeof saveViewState === "function") {
      saveViewState();
    }
  });
}
