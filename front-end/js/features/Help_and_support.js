
function renderHelp() {
  document.getElementById("faq-sections").innerHTML = FAQS.map(
    (cat, ci) => `
    <div class="card mt-3">
      <div class="card-title">${cat.icon} ${cat.category}</div>
      <div>
        ${cat.items
          .map(
            (item, ii) => `
          <div class="faq-item">
            <button class="faq-q" onclick="toggleFaq(this)" id="faq-${ci}-${ii}">
              ${item.q}
              <span class="faq-chevron">▼</span>
            </button>
            <div class="faq-a" id="faq-a-${ci}-${ii}">${item.a}</div>
          </div>
        `,
          )
          .join("")}
      </div>
    </div>
  `,
  ).join("");
}

function toggleFaq(btn) {
  btn.classList.toggle("open");
  const answer = btn.nextElementSibling;
  answer.classList.toggle("open");
}

function filterFaq() {
  const input = document.getElementById("faq-search");
  const q = String(input?.value || "").toLowerCase();
  document.querySelectorAll(".faq-item").forEach((item) => {
    const text = item.textContent.toLowerCase();
    item.style.display = text.includes(q) ? "" : "none";
  });
}

function submitSupportRequest() {
  const categoryInput = document.getElementById("support-category");
  const messageInput = document.getElementById("support-message");

  if (!categoryInput || !messageInput) {
    showToast("Support form is unavailable");
    return;
  }

  const category = categoryInput.value.trim();
  const message = messageInput.value.trim();
  const validCategories = new Set([
    "Bug Report",
    "Feature Request",
    "Account Issue",
    "Other",
  ]);

  if (!validCategories.has(category)) {
    showToast("Please choose a valid support category");
    return;
  }

  if (!message) {
    showToast("Support message is required");
    return;
  }
  if (message.length < 20 || message.length > 1000) {
    showToast("Support message must be 20 to 1000 characters");
    return;
  }
  if (!/[a-zA-Z0-9]/.test(message)) {
    showToast("Support message must include meaningful details");
    return;
  }

  messageInput.value = "";
  showToast("Support request submitted!");
}

