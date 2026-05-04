document.addEventListener("DOMContentLoaded", () => {
  const EMAIL_RE =
    /^[a-zA-Z0-9._%+-]{1,64}@[a-zA-Z0-9.-]{1,255}\.[a-zA-Z]{2,}$/;
  const USERNAME_RE = /^[a-zA-Z0-9._-]{3,30}$/;
  const PASSWORD_RE =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,72}$/;

  function clearErrors(form) {
    form.querySelectorAll(".field-error").forEach((el) => el.remove());
    const formError = form.querySelector(".form-error");
    if (formError) formError.remove();
  }

  function showFieldError(input, message) {
    if (!input) return;
    const err = document.createElement("div");
    err.className = "field-error";
    err.style.color = "#b42318";
    err.style.fontSize = "12px";
    err.style.marginTop = "6px";
    err.textContent = message;
    input.setAttribute("aria-invalid", "true");
    const container = input.closest(".input-group") || input.parentElement;
    container.appendChild(err);
  }

  function showFormError(form, message) {
    const err = document.createElement("div");
    err.className = "form-error";
    err.style.color = "#b42318";
    err.style.fontSize = "12px";
    err.style.marginBottom = "10px";
    err.textContent = message;
    form.prepend(err);
  }

  function normalizeIdentifier(raw) {
    const value = String(raw || "").trim();
    return value;
  }

  function validateIdentifier(input) {
    const value = normalizeIdentifier(input?.value);
    if (!value) {
      return "Username or email is required.";
    }
    if (value.length > 320) {
      return "Username or email is too long.";
    }
    if (/\s/.test(value)) {
      return "Username or email cannot contain spaces.";
    }
    if (!EMAIL_RE.test(value.toLowerCase()) && !USERNAME_RE.test(value)) {
      return "Use a valid username or email address.";
    }
    return "";
  }

  function validateEmail(input) {
    const value = normalizeIdentifier(input?.value).toLowerCase();
    if (!value) {
      return "Email is required.";
    }
    if (value.length > 320) {
      return "Email is too long.";
    }
    if (/\s/.test(value)) {
      return "Email cannot contain spaces.";
    }
    if (!EMAIL_RE.test(value)) {
      return "Use a valid email address.";
    }
    return "";
  }

  function validateUsername(input) {
    const value = normalizeIdentifier(input?.value);
    if (!value) {
      return "Username is required.";
    }
    if (!USERNAME_RE.test(value)) {
      return "Username must be 3-30 chars using letters, numbers, . _ -";
    }
    return "";
  }

  function validatePassword(input, isSignup) {
    const value = String(input?.value || "");
    if (!value) {
      return "Password is required.";
    }
    if (value.length > 72) {
      return "Password cannot exceed 72 characters.";
    }
    if (/\s/.test(value)) {
      return "Password cannot contain spaces.";
    }
    if (isSignup && !PASSWORD_RE.test(value)) {
      return "Password must be 8+ chars with uppercase, lowercase, number, and special character.";
    }
    if (!isSignup && value.length < 8) {
      return "Password must be at least 8 characters.";
    }
    return "";
  }

  function sanitizeDisplayName(identifier) {
    const source = identifier.includes("@") ? identifier.split("@")[0] : identifier;
    const cleaned = source.replace(/[^a-zA-Z0-9._ -]/g, " ").trim();
    return cleaned
      .split(/[._ -]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ") || "TeamForge User";
  }

  // --- View Toggle Logic ---
  const loginView = document.getElementById("login-view");
  const signupView = document.getElementById("signup-view");

  const goToSignupBtn = document.getElementById("go-to-signup");
  const goToLoginBtn = document.getElementById("go-to-login");

  function openSignupView() {
    loginView.classList.remove("active");
    signupView.classList.add("active");
  }

  function openLoginView() {
    signupView.classList.remove("active");
    loginView.classList.add("active");
  }

  // Switch to Sign Up
  goToSignupBtn.addEventListener("click", (e) => {
    e.preventDefault();
    openSignupView();
  });

  // Switch to Login
  goToLoginBtn.addEventListener("click", (e) => {
    e.preventDefault();
    openLoginView();
  });

  if (window.location.hash.toLowerCase() === "#signup") {
    openSignupView();
  }

  // --- Password Visibility Toggle Logic ---
  const toggleButtons = document.querySelectorAll(".toggle-password");

  toggleButtons.forEach((button) => {
    button.addEventListener("click", function (e) {
      e.preventDefault();
      // Find the input field that is a sibling
      const input = this.parentElement.querySelector(
        'input[type="password"], input[type="text"]',
      );

      if (input.type === "password") {
        input.type = "text";
        this.textContent = "🙈";
      } else {
        input.type = "password";
        this.textContent = "👁";
      }
    });
  });

  // --- Auth Submit Logic ---
  const loginForm = document.getElementById("login-form");
  const signupForm = document.getElementById("signup-form");

  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      clearErrors(loginForm);

      const identifierInput = document.getElementById("login-username");
      const passwordInput = document.getElementById("login-password");
      if (!identifierInput || !passwordInput) return;

      identifierInput.removeAttribute("aria-invalid");
      passwordInput.removeAttribute("aria-invalid");

      const identifierError = validateIdentifier(identifierInput);
      const passwordError = validatePassword(passwordInput, false);

      if (identifierError) showFieldError(identifierInput, identifierError);
      if (passwordError) showFieldError(passwordInput, passwordError);

      if (identifierError || passwordError) {
        showFormError(
          loginForm,
          "Please fix the highlighted fields before signing in.",
        );
        return;
      }

      const identifier = normalizeIdentifier(identifierInput.value);
      const password = passwordInput.value;

      // Check if credentials match a superuser account
      let isSuperUserLogin = false;
      if (
        typeof PORTAL_ACCOUNTS !== "undefined" &&
        Array.isArray(PORTAL_ACCOUNTS)
      ) {
        const account = PORTAL_ACCOUNTS.find(
          (a) => a.email === identifier && a.password === password,
        );
        if (account && account.portalRole === "superuser") {
          isSuperUserLogin = true;
        }
      }

      if (!isSuperUserLogin) {
        const result =
          typeof validateUserLogin === "function"
            ? validateUserLogin(identifier, password)
            : { ok: false, reason: "Login service unavailable." };

        if (!result.ok) {
          showFormError(loginForm, result.reason || "Invalid username/email or password.");
          showFieldError(identifierInput, "Check your username or email.");
          showFieldError(passwordInput, "Check your password.");
          return;
        }

        if (typeof cleanSessionForNewLogin === "function") {
          cleanSessionForNewLogin();
        }
        if (typeof loginUser === "function") {
          loginUser(result.email, false);
        } else {
          localStorage.setItem("currentUser", result.email);
        }
        if (typeof reinitializeStateForUser === "function") {
          reinitializeStateForUser(result.email);
        }

        // ── Backend Integration: Fetch backend user ID on login ──
        try {
          fetch("http://localhost:3000/users")
            .then((res) => (res.ok ? res.json() : []))
            .then((users) => {
              const match = Array.isArray(users)
                ? users.find(
                    (u) =>
                      String(u.email || "").toLowerCase() ===
                      String(result.email || "").toLowerCase(),
                  )
                : null;
              if (match && match.id) {
                localStorage.setItem("teamforge.backendUserId", match.id);
                console.log("✅ Backend user ID resolved:", match.id);
              }
            })
            .catch((err) =>
              console.warn("Backend unreachable for user lookup:", err.message),
            );
        } catch (e) {
          console.warn("Backend user lookup error:", e);
        }
        // ── End Backend Integration ──

        window.location.replace("teamforge.html#dashboard");
        return;
      }

      if (typeof cleanSessionForNewLogin === "function") {
        cleanSessionForNewLogin();
      }
      if (typeof loginUser === "function") {
        loginUser(identifier.toLowerCase(), isSuperUserLogin);
      } else {
        localStorage.setItem("currentUser", identifier.toLowerCase());
        if (isSuperUserLogin) {
          sessionStorage.setItem("teamforge.isSuperUser", "true");
        }
      }
      if (typeof reinitializeStateForUser === "function") {
        reinitializeStateForUser(identifier.toLowerCase());
      }

      window.location.replace("teamforge.html#dashboard");
    });
  }

  if (signupForm) {
    signupForm.addEventListener("submit", (e) => {
      e.preventDefault();
      clearErrors(signupForm);

      const usernameInput = document.getElementById("signup-username");
      const emailInput = document.getElementById("signup-email");
      const passwordInput = document.getElementById("signup-password");
      const confirmInput = document.getElementById("signup-confirm-password");
      if (!usernameInput || !emailInput || !passwordInput || !confirmInput) return;

      usernameInput.removeAttribute("aria-invalid");
      emailInput.removeAttribute("aria-invalid");
      passwordInput.removeAttribute("aria-invalid");
      confirmInput.removeAttribute("aria-invalid");

      const usernameError = validateUsername(usernameInput);
      const emailError = validateEmail(emailInput);
      const passwordError = validatePassword(passwordInput, true);
      let confirmError = "";

      if (!confirmInput.value) {
        confirmError = "Please confirm your password.";
      } else if (confirmInput.value !== passwordInput.value) {
        confirmError = "Passwords do not match.";
      }

      if (usernameError) showFieldError(usernameInput, usernameError);
      if (emailError) showFieldError(emailInput, emailError);
      if (passwordError) showFieldError(passwordInput, passwordError);
      if (confirmError) showFieldError(confirmInput, confirmError);

      if (usernameError || emailError || passwordError || confirmError) {
        showFormError(
          signupForm,
          "Please fix the highlighted fields before creating your account.",
        );
        return;
      }

      const username = normalizeIdentifier(usernameInput.value);
      const email = normalizeIdentifier(emailInput.value).toLowerCase();
      const signupResult =
        typeof createUserAccount === "function"
          ? createUserAccount({
              email,
              username,
              password: passwordInput.value,
              name: sanitizeDisplayName(username),
            })
          : { ok: false, reason: "Signup service unavailable." };

      if (!signupResult.ok) {
        if ((signupResult.reason || "").toLowerCase().includes("username")) {
          showFieldError(usernameInput, signupResult.reason || "Unable to create account.");
        } else {
          showFieldError(emailInput, signupResult.reason || "Unable to create account.");
        }
        showFormError(signupForm, signupResult.reason || "Unable to create account.");
        return;
      }

      if (typeof cleanSessionForNewLogin === "function") {
        cleanSessionForNewLogin();
      }
      if (typeof loginUser === "function") {
        loginUser(signupResult.email);
      } else {
        localStorage.setItem("currentUser", signupResult.email);
      }
      if (typeof reinitializeStateForUser === "function") {
        reinitializeStateForUser(signupResult.email);
      }

      // ── Backend Integration: Create user in NestJS ──
      try {
        fetch("http://localhost:3000/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: signupResult.user?.name || username,
            email: signupResult.email,
            role: "Collaborator",
            skills: [],
          }),
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data && data.id) {
              localStorage.setItem("teamforge.backendUserId", data.id);
              console.log("✅ User synced to backend with ID:", data.id);
            }
          })
          .catch((err) => console.warn("Backend unreachable for user sync:", err.message));
      } catch (e) {
        console.warn("Backend user sync error:", e);
      }
      // ── End Backend Integration ──

      window.location.replace("teamforge.html#dashboard");
    });
  }
});
