/* ─────────────────────────────────────────────────────────────────────────
   hamburger.js — Mobile hamburger menu for the site header
   ─────────────────────────────────────────────────────────────────────────
   On mobile (≤768px) the header collapses to a 4-column grid
   (img / name / theme toggle / hamburger). The hamburger button toggles a
   slide-down panel below the header containing:
     • the full navigation links (cloned from .Name-Photo > .nav-links)
     • a compact language picker (EN / PT / ES buttons, no dropdown)

   Animations match the rest of the site (cubic-bezier(0.16,1,0.3,1)). The
   menu uses grid-template-rows: 0fr → 1fr so the open/close duration
   tracks the actual content height (no fixed max-height hack).

   Public API: none (single-file IIFE). Uses window.i18n (from i18n.js) –
   only calls i18n.setLanguage() when a language option is clicked.

   Companion CSS lives in style.css under "Mobile header + hamburger menu".
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var LANG_NAMES = { en: 'English', pt: 'Português', es: 'Español', hi: 'हिन्दी', zh: '中文' };

  function $(sel, root) { return (root || document).querySelector(sel); }

  function getToggle() { return $('.hamburger-toggle'); }
  function getMenu() { return document.querySelector('.hamburger-menu'); }

  /* ── Toggle open / close ──────────────────────────────────────────── */
  function openMenu() {
    var menu = getMenu();
    if (!menu) return;
    menu.classList.add('open');
    menu.setAttribute('aria-hidden', 'false');
    var toggle = getToggle();
    if (toggle) {
      toggle.classList.add('open');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Close menu');
    }
    document.documentElement.classList.add('hamburger-open');
  }

  function closeMenu() {
    var menu = getMenu();
    if (!menu || !menu.classList.contains('open')) return;
    menu.classList.remove('open');
    menu.setAttribute('aria-hidden', 'true');
    var toggle = getToggle();
    if (toggle) {
      toggle.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open menu');
    }
    document.documentElement.classList.remove('hamburger-open');
  }

  function toggleMenu() {
    var menu = getMenu();
    if (!menu) return;
    if (menu.classList.contains('open')) closeMenu();
    else openMenu();
  }

  /* ── Language switcher inside the panel ─────────────────────────── */
  function buildLangButtons() {
    var container = $('.hamburger-menu-lang');
    if (!container) return;
    if (!window.i18n) return;

    var html = '<span class="hamburger-menu-lang-label">Language</span>'
             + '<div class="hamburger-menu-lang-options">';
    Object.keys(LANG_NAMES).forEach(function (code) {
      var active = code === window.i18n.lang ? ' active' : '';
      html += '<button class="hamburger-lang-btn' + active
            + '" type="button" data-lang="' + code + '">'
            + LANG_NAMES[code] + '</button>';
    });
    html += '</div>';
    container.innerHTML = html;

    container.querySelectorAll('.hamburger-lang-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = btn.getAttribute('data-lang');
        if (target && window.i18n && target !== window.i18n.lang) {
          window.i18n.setLanguage(target);
        }
        closeMenu();
      });
    });
  }

  function syncLangButtons() {
    var container = $('.hamburger-menu-lang');
    if (!container || !window.i18n) return;
    var lang = window.i18n.lang;
    container.querySelectorAll('.hamburger-lang-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });
  }

  /* ── Clone the desktop nav-links into the panel ──────────────────── */
  function cloneNavLinks() {
    var inner = document.querySelector('.hamburger-menu-inner');
    if (!inner) return;
    if (inner.dataset.cloned === 'true') return;

    var source = $('.Name-Photo > .nav-links');
    if (!source) return;

    var clone = source.cloneNode(true);
    /* Vertical stack doesn't need the "/" separators — strip them. */
    clone.querySelectorAll('.nav-separator').forEach(function (s) { s.remove(); });

    var langContainer = inner.querySelector('.hamburger-menu-lang');
    inner.insertBefore(clone, langContainer);
    inner.dataset.cloned = 'true';

    /* Auto-close the menu when a nav-link is tapped (let the navigation
       navigate first, then close via rAF so we don't block the click). */
    clone.querySelectorAll('.nav-link').forEach(function (link) {
      link.addEventListener('click', function () {
        requestAnimationFrame(closeMenu);
      });
    });
  }

  /* ── Event bindings ──────────────────────────────────────────────── */
  function bindToggle() {
    var toggle = getToggle();
    if (!toggle) return;
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleMenu();
    });
  }

  function bindOutsideClick() {
    document.addEventListener('click', function (e) {
      var menu = getMenu();
      if (!menu || !menu.classList.contains('open')) return;
      /* Clicks inside the panel or on the toggle are handled by their own
         listeners; close on anything else (the page below the menu). */
      if (e.target.closest('.hamburger-menu, .hamburger-toggle')) return;
      closeMenu();
    });
  }

  function bindEscape() {
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var menu = getMenu();
      if (menu && menu.classList.contains('open')) {
        closeMenu();
        var toggle = getToggle();
        if (toggle) toggle.focus();
      }
    });
  }

  function bindLanguageChange() {
    /* Re-mark the active language option, and close the panel so the
       change can apply cleanly without fighting the open animation. */
    window.addEventListener('languageChange', function () {
      syncLangButtons();
      /* Re-rendered translations on cloned copy are handled automatically
         by i18n.js's applyStaticTranslations() — it queries data-i18n
         across the whole DOM, so the cloned nav-link labels update too. */
      closeMenu();
    });
  }

  /* If the user resizes from mobile → desktop while the panel is open
     the CSS hides the panel entirely, but the .open state would stick.
     Close it on resize whenever the viewport leaves mobile. */
  function bindResize() {
    var mq = window.matchMedia('(max-width: 768px)');
    var handler = function (e) {
      if (!e.matches) closeMenu();
    };
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else if (mq.addListener) mq.addListener(handler);
  }

  /* ── Boot ────────────────────────────────────────────────────────── */
  function init() {
    if (!getToggle() || !getMenu()) return;

    buildLangButtons();
    cloneNavLinks();
    bindToggle();
    bindOutsideClick();
    bindEscape();
    bindLanguageChange();
    bindResize();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
