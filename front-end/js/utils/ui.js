
function toggleSidebar() {
  STATE.sidebarCollapsed = !STATE.sidebarCollapsed;
  document
    .getElementById("sidebar")
    .classList.toggle("collapsed", STATE.sidebarCollapsed);
}

function toggleDropdown(id) {
  const menu = document.getElementById(id);
  const isOpen = menu.classList.contains("open");
  closeDropdowns();
  if (!isOpen) menu.classList.add("open");
}

function closeDropdowns() {
  document
    .querySelectorAll(".dropdown-menu")
    .forEach((m) => m.classList.remove("open"));
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".dropdown")) closeDropdowns();
});

let toastTimer;
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2800);
}

// ══════════════════════════════════════════════

