/* ────────────────────────────────────────────────────────────────────────
   qol.js — Site-wide quality-of-life engine
   ────────────────────────────────────────────────────────────────────────
   Self-contained, loads with `defer` on every HTML page after the existing
   scripts. Adds three small features with zero conflict risk:

   1. Back-to-top button (QOL rail was removed; the post-overlay ships
      its own progress bar via .reading-progress-container in posts.css).
   2. prefers-reduced-motion JS gate — even when CSS animation is fully
      neutralized by the @media block in style.css, the JS `scrollTo`
      calls in overlays + nav still respect `behavior:'auto'` here so
      reduced-motion users get pure instant scroll. Listens for changes
      to the media query (system-level toggle) and re-applies.
   3. "New posts since last visit" badge on the home `#postsList` head —
      reads /posts/index.json, diffs against a localStorage cap-50 list
      of slugs, paints a small `NEW` pill on the H2 when there's a diff,
      and writes the current set back.
   4. Exposes `window.__qol` so other scripts (posts.js) can ask "is
      reduced motion on?" without re-parsing the media query.

   Reads: posts/index.json (F16), localStorage('qol.lastSeenPosts'),
          document.documentElement.scrollTop, [prefers-reduced-motion].
   Writes: localStorage (capped to last 50 slugs; JSON envelope with
           timestamp + slugs array).

   CSS lives in style.css (alongside reduced-motion block) and posts.css
   (TOC + related-posts mini-cards).
   ────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  /* ── Reduced-motion detection (F5) ─────────────────────────────────────
     Single source of truth. Other scripts can read window.__qol.reducedMotion
     instead of redoing the MediaQueryList dance. Live-updates when the user
     toggles the system setting mid-session (reduced-motion queries support
     change events). */
  var mql = null;
  var reducedMotion = false;
  try {
    mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion = !!(mql && mql.matches);
    if (mql && typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', function (e) {
        reducedMotion = !!e.matches;
      });
    } else if (mql && typeof mql.addListener === 'function') {
      /* Safari < 14 fallback */
      mql.addListener(function (e) { reducedMotion = !!e.matches; });
    }
  } catch (_) { /* matchMedia may exist but throw on locked-down sandboxes */ }

  /* Expose for posts.js / nav / overlay scrolls. */
  window.__qol = {
    reducedMotion: function () { return reducedMotion; }
  };

  /* helper: scroll that respects reduced-motion */
  function smoothScrollTo(target, behavior) {
    try {
      var b = reducedMotion ? 'auto' : (behavior === 'auto' ? 'auto' : 'smooth');
      target.scrollTo({ top: 0, behavior: b });
    } catch (_) {
      try { target.scrollTo(0, 0); } catch (__) {}
    }
  }

  /* ── 1. Back-to-top button ─────────────────────────────────────────────
     One element appended to <body>:
       #siteBackToTop — fixed, bottom-right, appears at scrollY > SHOW_AT.
     Scoped with a `qol-` prefixed class so it never collides with the
     existing `.project-fullscreen-close` vocabulary. Purely decorative
     until scroll-driven — zero CLS risk because the button starts
     `hidden` (display:none via [hidden] attr, not opacity).
     (The earlier site-wide scroll progress rail was removed: the
      post overlay already ships its own progress bar, and showing the
      rail on every page added visual noise without value.) */
  var SHOW_AT = 600;
  function mountBackToTop() {
    if (document.getElementById('siteBackToTop')) return null;

    var btn = document.createElement('button');
    btn.id = 'siteBackToTop';
    btn.className = 'qol-back-to-top';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Back to top');
    btn.hidden = true;
    btn.innerHTML = '\u2191'; /* ↑ */
    btn.addEventListener('click', function () {
      smoothScrollTo(window, 'smooth');
    });

  document.body.appendChild(btn);
  return btn;
  }

var btn = mountBackToTop();
if (btn) {
  var ticking = false;

  function update() {
    var docEl = document.documentElement;
    var y = window.pageYOffset || docEl.scrollTop || 0;
    /* Show/hide the back-to-top button past the SHOW_AT threshold.
       The paired hidden-flip + threshold check survives a race
       between rAF commitment and the script's initial paint where
       hidden=true may not have applied yet. */
    if (y > SHOW_AT) {
      if (btn.hidden) btn.hidden = false;
    } else {
      if (!btn.hidden) btn.hidden = true;
    }
    ticking = false;
  }
  function schedule() {
    if (!ticking) {
      window.requestAnimationFrame(update);
      ticking = true;
    }
  }
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  /* Initial paint without rAF deferral — the button starts hidden,
     so a sync update() at the top of the page is a no-op. */
  update();
}

  /* ── 3. Last-seen / new-posts badge (F16) ───────────────────────────────
     Only mount when the home post-list section is on the page. Bails
     silently on /cv, /gallery, /certificates, /projects where this
     widget makes no sense. Keeps a 50-slug cap so the JSON envelope
     never grows unbounded across years of new posts.

     Note: posts.js also reads /posts/index.json and bumps the cache
     version with `?t=`; we replicate that here so the two reads never
     race against each other on stale HTTP cache. */
  var SEEN_KEY = 'qol.lastSeenPosts';
  var SEEN_CAP = 50;

  function mountNewPostsBadge() {
    var section = document.querySelector('.Posts-Section');
    if (!section) return;
    var header = section.querySelector('h2');
    if (!header) return;

    /* If posts.js already mounted the badge earlier (e.g. cached fast), bail. */
    if (header.querySelector('.qol-new-pill')) return;

    var controller;
    try {
      controller = new AbortController();
    } catch (_) {
      controller = null;
    }

    fetch('posts/index.json?t=' + Date.now(), controller ? { signal: controller.signal } : undefined)
      .then(function (r) { return r && r.ok ? r.json() : null; })
      .then(function (fileList) {
        if (!Array.isArray(fileList) || fileList.length === 0) return;
        var currentSet = Object.create(null);
        fileList.forEach(function (f) {
          if (typeof f === 'string') currentSet[f.replace(/\.md$/i, '')] = true;
        });

        /* Read prior seen set (cap-aware: drop anything not in current
           set so the JSO N never accumulates ghosts of deleted posts). */
        var seen = Object.create(null);
        try {
          var raw = localStorage.getItem(SEEN_KEY);
          if (raw) {
            var parsed = JSON.parse(raw);
            if (parsed && Array.isArray(parsed.slugs)) {
              parsed.slugs.forEach(function (s) {
                if (currentSet[s]) seen[s] = true;
              });
            }
          }
        } catch (_) { /* ignore corrupt JSON */ }

        var newCount = 0;
        Object.keys(currentSet).forEach(function (s) { if (!seen[s]) newCount++; });

        if (newCount > 0 && !header.querySelector('.qol-new-pill')) {
          var pill = document.createElement('span');
          pill.className = 'qol-new-pill';
          pill.textContent = newCount + ' NEW';
          pill.title = newCount + ' new post' + (newCount === 1 ? '' : 's') + ' since last visit';
          pill.setAttribute('aria-label', newCount + ' new posts since last visit');
          header.appendChild(pill);
        }

        /* Write current snapshot back. Cap by trimming oldest first; we
           don't have per-slug timestamps, so we just keep the last 50
           slugs of the current set, plus any "removable" older ghost
           entries get dropped on read above. */
        var allCurrent = Object.keys(currentSet);
        var toStore = allCurrent.slice(-SEEN_CAP);
        try {
          localStorage.setItem(SEEN_KEY, JSON.stringify({
            v: 1,
            timestamp: new Date().toISOString(),
            slugs: toStore
          }));
        } catch (_) { /* localStorage quota — fail silently */ }
      })
      .catch(function (/* err */) { /* network or parse failure — fail silently */ });
  }

  /* Defer until DOM ready — we need the .Posts-Section h2 to exist. */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountNewPostsBadge);
  } else {
    mountNewPostsBadge();
  }
})();
