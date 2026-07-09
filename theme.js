/* ─────────────────────────────────────────────────────────────────────────
   theme.js — Light/dark theme segmented control
   ─────────────────────────────────────────────────────────────────────────
   Replaces the previous single-button theme toggle with a two-button
   segmented control (#theme-light + #theme-dark) so the currently active
   mode is always visible at a glance and one click flips to any choice
   (no "tap and wait to see what changed" round-trip). Falls back to the
   legacy single #theme-toggle button if a page hasn't migrated yet.

   Public surface: none — touches document.body.classList + localStorage.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  var SVG_SUN = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M12 4.5a1 1 0 110-2 1 1 0 010 2zm0 17a1 1 0 110-2 1 1 0 010 2zm9.5-8a1 1 0 110-2 1 1 0 010 2zM4.5 13a1 1 0 110-2 1 1 0 010 2zm12.02-6.78a1 1 0 11-1.42-1.42 1 1 0 011.42 1.42zm-10.04 12.02a1 1 0 11-1.42-1.42 1 1 0 011.42 1.42zm12.02 1.42a1 1 0 11-1.42-1.42 1 1 0 011.42 1.42zM6.46 6.46a1 1 0 11-1.42-1.42 1 1 0 011.42 1.42zM12 8a4 4 0 100 8 4 4 0 000-8z"/>' +
    '</svg>';
  var SVG_MOON = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z"/>' +
    '</svg>';

  function applyTheme(theme, persist) {
    var isDark = theme === 'dark';
    document.body.classList.toggle('dark-mode', isDark);
    if (persist !== false) {
      try { localStorage.setItem('theme', theme); } catch (e) {}
    }
    sync();
  }

  /* Reflect the current body.dark-mode state on whichever buttons exist.
     aria-pressed is the canonical ARIA for toggle buttons — CSS keys
     the visual state off [aria-pressed] alone, so the .active className
     is redundant and would just drift out of sync if a future feature
     ever wanted to inspect it. */
  function sync() {
    var isDark = document.body.classList.contains('dark-mode');
    var light = document.getElementById('theme-light');
    var dark = document.getElementById('theme-dark');
    if (light) {
      light.setAttribute('aria-pressed', String(!isDark));
      if (!light.innerHTML) light.innerHTML = SVG_SUN;
    }
    if (dark) {
      dark.setAttribute('aria-pressed', String(isDark));
      if (!dark.innerHTML) dark.innerHTML = SVG_MOON;
    }

    /* Legacy single-button fallback so un-migrated HTML pages still
       reflect the current state on every theme flip. */
    var legacy = document.getElementById('theme-toggle');
    if (legacy) {
      legacy.innerHTML = isDark ? SVG_SUN : SVG_MOON;
      legacy.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
    }
  }

  function bindSegmented() {
    var light = document.getElementById('theme-light');
    var dark = document.getElementById('theme-dark');
    if (!light && !dark) return false;
    if (light) light.addEventListener('click', function () { applyTheme('light'); });
    if (dark) dark.addEventListener('click', function () { applyTheme('dark'); });
    return true;
  }

  function bindLegacy() {
    var btn = document.getElementById('theme-toggle');
    if (!btn) return false;
    btn.addEventListener('click', function () {
      var newDark = !document.body.classList.contains('dark-mode');
      applyTheme(newDark ? 'dark' : 'light');
      /* sync() updates the icon inside the legacy button automatically. */
    });
    return true;
  }

  /* Bind each control that actually exists in the DOM. Modern pages
     carry BOTH the segmented control (PC header) and the legacy single
     button (mobile hamburger menu), so we attach handlers to whichever
     is present — not "exactly one". The legacy fallback should run in
     parallel with the segmented; gating it behind !bindSegmented() would
     silently leave a mobile menu button unbound whenever a page shipped
     any of #theme-light / #theme-dark. */
  function boot() {
    bindSegmented();
    bindLegacy();
    sync();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
