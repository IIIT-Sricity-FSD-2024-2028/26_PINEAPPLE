/* ==========================================================
   script.js — TeamForge Vanilla JS
   ========================================================== */

(function () {
  "use strict";

  /* ----------------------------------------------------------
     FOOTER YEAR
  ---------------------------------------------------------- */
  var yearEl = document.getElementById("footer-year");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  /* ----------------------------------------------------------
     MOBILE NAV TOGGLE
  ---------------------------------------------------------- */
  var menuToggle = document.querySelector(".header__menu-toggle");
  var mobileNav  = document.getElementById("mobile-menu");

  if (menuToggle && mobileNav) {

    menuToggle.addEventListener("click", function () {
      var isOpen = menuToggle.getAttribute("aria-expanded") === "true";

      // Toggle state
      menuToggle.setAttribute("aria-expanded", String(!isOpen));

      if (isOpen) {
        mobileNav.setAttribute("hidden", "");
      } else {
        mobileNav.removeAttribute("hidden");
      }
    });

    // Close mobile nav when a link inside it is clicked
    var mobileLinks = mobileNav.querySelectorAll(".header__mobile-link");
    mobileLinks.forEach(function (link) {
      link.addEventListener("click", function () {
        menuToggle.setAttribute("aria-expanded", "false");
        mobileNav.setAttribute("hidden", "");
      });
    });

    // Close mobile nav on resize to desktop
    window.addEventListener("resize", function () {
      if (window.innerWidth >= 768) {
        menuToggle.setAttribute("aria-expanded", "false");
        mobileNav.setAttribute("hidden", "");
      }
    });
  }

  /* ----------------------------------------------------------
     SMOOTH-SCROLL ANCHOR LINKS (fallback for older browsers)
  ---------------------------------------------------------- */
  var anchorLinks = document.querySelectorAll('a[href^="#"]');
  anchorLinks.forEach(function (anchor) {
    anchor.addEventListener("click", function (e) {
      var targetId = anchor.getAttribute("href");
      if (!targetId || targetId === "#") return;

      var target = document.querySelector(targetId);
      if (!target) return;

      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });

      // Keep focus accessible after scroll
      target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    });
  });

  /* ----------------------------------------------------------
     HEADER SHADOW ON SCROLL
  ---------------------------------------------------------- */
  var header = document.querySelector(".header");

  if (header) {
    var onScroll = function () {
      if (window.scrollY > 8) {
        header.style.boxShadow = "0 2px 12px rgba(0,0,0,0.08)";
      } else {
        header.style.boxShadow = "none";
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll(); // run once on load in case page is already scrolled
  }

  /* ----------------------------------------------------------
     FEATURE CARDS — INTERSECTION OBSERVER ENTRANCE ANIMATION
     (CSS class toggled; animation defined in CSS via @keyframes
      would go here, but we wire the trigger in JS for flexibility)
  ---------------------------------------------------------- */
  var animatedEls = document.querySelectorAll(
    ".features__card, .roles__card, .process__card, .gamification__card, .stats__item"
  );

  if ("IntersectionObserver" in window && animatedEls.length) {
    // Add the initial hidden state via an attribute so CSS can target it
    animatedEls.forEach(function (el) {
      el.setAttribute("data-animate", "hidden");
    });

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-animate", "visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -48px 0px" }
    );

    animatedEls.forEach(function (el) {
      observer.observe(el);
    });
  }

  /* ----------------------------------------------------------
     CTA / SIGN-IN / SIGN-UP BUTTON PLACEHOLDERS
     (Wire up your routing / modal logic here)
  ---------------------------------------------------------- */
  function handleCTA(label) {
    // Replace with real navigation or modal open logic
    console.log("[TeamForge] CTA clicked:", label);
  }

  var ctaBtn = document.querySelector(".cta__btn");
  if (ctaBtn) {
    ctaBtn.addEventListener("click", function () { handleCTA("Get Started"); });
  }

  var heroPrimary = document.querySelector(".hero__btn--primary");
  if (heroPrimary) {
    heroPrimary.addEventListener("click", function () { handleCTA("Start Collaborating"); });
  }

  var heroSecondary = document.querySelector(".hero__btn--secondary");
  if (heroSecondary) {
    heroSecondary.addEventListener("click", function () { handleCTA("Explore Projects"); });
  }

  var signInBtns = document.querySelectorAll(".header__btn--primary");
  signInBtns.forEach(function (btn) {
    btn.addEventListener("click", function () { handleCTA("Sign In"); });
  });

  var signUpBtns = document.querySelectorAll(".header__btn--secondary");
  signUpBtns.forEach(function (btn) {
    btn.addEventListener("click", function () { handleCTA("Sign Up"); });
  });

})();
