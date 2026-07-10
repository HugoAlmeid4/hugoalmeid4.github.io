/* ────────────────────────────────────────────────────────────────────────
   projects.js — Projects page renderer
   ────────────────────────────────────────────────────────────────────────
   Reads data/projects.json, renders a card grid and opens a long-form
   overlay for the full description. Reuses the existing
   .project-fullscreen-overlay CSS already declared in style.css
   (originally authored for posts.js's long-form overlay). Supports
   pre-translated { en, pt, es, hi, zh } strings via i18n.localize(),
   like cv.js and gallery.js do. Re-renders on every languageChange
   event from i18n.js so the whole projects wall swaps with no page
   reload. Status badges map to the same .status-completed /
   .status-processing / .status-planned palette that style.css uses
   for the data-log-table. Esc/click handlers close the overlay, same
   vocabulary as the gallery lightbox. Safe URL filter prevents
   admin-provided links from being a script-injection vector.
   ──────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escAttr(s) {
    return String(s == null ? '' : s).replace(/"/g, '&quot;');
  }

  /* INVARIANT: this script runs AFTER i18n.js via <script defer> ordering
     (projects.html lists `i18n.js` before `projects.js`). Do not reorder. */
  var t      = function (k) { return (window.i18n && typeof k === 'string') ? window.i18n.t(k) : k; };
  var loc    = function (v) { return (window.i18n && typeof window.i18n.localize === 'function') ? window.i18n.localize(v) : (typeof v === 'string' ? v : (v && v.en) || ''); };
  var safeUrl= function (u) { return window.i18n ? window.i18n.safeUrl(u) : (u || '#'); };

  /* Status badge ↔ i18n key + status-badge CSS class. Keep this table
     exhaustive — adding a new status means one key, one CSS class, one
     row here, and the corresponding string in i18n.js. */
  var STATUS = {
    'completed':  { labelKey: 'projectsStatusCompleted',  cssClass: 'status-completed'  },
    'in-progress':{ labelKey: 'projectsStatusInProgress', cssClass: 'status-processing' },
    'planned':    { labelKey: 'projectsStatusPlanned',    cssClass: 'status-planned'    }
  };

  var ITEMS = [];
  var DATA  = null;

  /* ── Card render ───────────────────────────────────────────────── */
  function renderIntro() {
    var introEl = document.getElementById('projects-intro');
    if (!introEl || !DATA) return;
    var intro = loc(DATA.intro);
    if (intro) {
      introEl.textContent = intro;
      introEl.hidden = false;
    } else {
      introEl.textContent = '';
      introEl.hidden = true;
    }
  }

  function renderCard(item) {
    var title = loc(item.title) || item.id || '';
    var desc  = loc(item.description) || '';
    var safeImageSrc = item.image ? safeUrl(item.image) : '';
    var previewHTML;
    if (item.image) {
      previewHTML =
        '<img src="' + escAttr(safeImageSrc) + '" alt="' + escAttr(title) + '" loading="lazy" decoding="async">';
    } else {
      /* No image: a text placeholder so the card has the same height
         as image cards in the same grid row. Keeps the grid tidy. */
      previewHTML = '<div class="preview-placeholder" aria-hidden="true"><span>' + esc(t('projectsImagePlaceholder')) + '</span></div>';
    }

    var statusHTML = '';
    if (item.status && STATUS[item.status]) {
      var st = STATUS[item.status];
      statusHTML = '<div class="project-card-status"><span class="status-badge ' + st.cssClass + '">' + esc(t(st.labelKey)) + '</span></div>';
    }

    var yearHTML = item.year
      ? '<span class="project-card-year">' + esc(String(item.year)) + '</span>'
      : '';

    var techHTML = '';
    if (Array.isArray(item.tech) && item.tech.length) {
      techHTML = '<div class="project-card-tech">' +
        item.tech.map(function (chip) { return '<span class="tech-chip">' + esc(chip) + '</span>'; }).join('') +
        '</div>';
    }

    var card = document.createElement('article');
    card.className = 'project-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', t('projectOpenAria', title) /* best-effort */ || (title));
    card.dataset.id = item.id || '';
    card.innerHTML =
      '<div class="project-card-preview">' + previewHTML + '</div>' +
      '<div class="project-card-body">' +
        '<div class="project-card-header">' +
          '<h3 class="project-card-title">' + esc(title) + '</h3>' +
          yearHTML +
        '</div>' +
        statusHTML +
        '<p class="project-card-desc">' + esc(desc) + '</p>' +
        techHTML +
      '</div>';

    /* Fade-in once the preview image has actually loaded. Otherwise
       the placeholder keeps a stable height while the image swaps in
       without a layout jump. */
    var img = card.querySelector('img');
    if (img) {
      img.addEventListener('load', function () { img.classList.add('loaded'); }, { once: true });
      img.addEventListener('error', function () { img.classList.add('loaded'); /* swallow error — keep alt text visible */ }, { once: true });
    }
    return card;
  }

  function renderGrid() {
    var grid = document.getElementById('projects-grid');
    var statusEl = document.getElementById('projects-status');
    if (!grid) return;
    grid.innerHTML = '';
    if (!ITEMS.length) {
      grid.innerHTML =
        '<div class="project-card-empty-state">' +
          '<p>' + esc(t('projectsEmpty')) + '</p>' +
        '</div>';
      if (statusEl) statusEl.textContent = '';
      return;
    }

    var frag = document.createDocumentFragment();
    ITEMS.forEach(function (item) {
      var card = renderCard(item);
      card.addEventListener('click', function () { openOverlay(item); });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openOverlay(item); }
      });
      frag.appendChild(card);
    });
    grid.appendChild(frag);
    if (statusEl) statusEl.textContent = ITEMS.length + ' ' + (ITEMS.length === 1 ? t('projectsCountSingular') : t('projectsCountPlural'));
  }

  /* ── Detail overlay ─────────────────────────────────────────────── */
  var overlayEl = null, overlayContent = null, overlayCloseBtn = null,
      overlayTitle = null, overlayType = null, overlayMeta = null,
      overlayBody = null, overlayLinks = null;

  function openOverlay(item) {
    if (!overlayEl) return;
    var title = loc(item.title) || item.id || '';
    overlayTitle.textContent = title;
    overlayType.textContent = t('projectsOverlayType');

    /* Meta row: status badge + year chip, both as `.meta-chip` elements
       so the overlay reads like the rest of the site's tiny data pills. */
    var metaBits = [];
    if (item.status && STATUS[item.status]) {
      var st = STATUS[item.status];
      metaBits.push('<span class="meta-chip"><span class="status-badge ' + st.cssClass + '">' + esc(t(st.labelKey)) + '</span></span>');
    }
    if (item.year) {
      metaBits.push('<span class="meta-chip"><span class="meta-chip-label">' + esc(t('projectsOverlayYear')) + '</span> <span class="meta-chip-value">' + esc(String(item.year)) + '</span></span>');
    }
    overlayMeta.innerHTML = metaBits.join('');

    /* Body: optional image at top (if set), tech chips, long description
       from data/projects.json#body. Plain `<p>` only — long-form projects
       almost never need markdown. */
    var bodyBits = [];
    var safeImageSrc = item.image ? safeUrl(item.image) : '';
    if (item.image) {
      bodyBits.push('<p><img src="' + escAttr(safeImageSrc) + '" alt="' + escAttr(title) + '" loading="lazy" decoding="async"></p>');
    }
    if (Array.isArray(item.tech) && item.tech.length) {
      bodyBits.push('<div class="project-fullscreen-tech">' +
        item.tech.map(function (chip) { return '<span class="tech-chip">' + esc(chip) + '</span>'; }).join('') +
        '</div>');
    }
    var inlineDesc = loc(item.description);
    if (inlineDesc) {
      bodyBits.push('<p>' + esc(inlineDesc) + '</p>');
    }
    var longBody = loc(item.body);
    if (longBody) {
      bodyBits.push('<p>' + esc(longBody) + '</p>');
    }
    overlayBody.innerHTML = bodyBits.join('');

    /* Link row: repo + live URLs, always rendered as "ghost"-style
       buttons matching .cv-download-link / .certificate-btn vocabulary. */
    var linkBits = [];
    if (item.repo_url) {
      linkBits.push('<a href="' + escAttr(safeUrl(item.repo_url)) + '" target="_blank" rel="noopener" class="fullscreen-link-btn">&#8599; ' + esc(t('projectsLinkRepo')) + '</a>');
    }
    if (item.live_url) {
      linkBits.push('<a href="' + escAttr(safeUrl(item.live_url)) + '" target="_blank" rel="noopener" class="fullscreen-link-btn">&#9654; ' + esc(t('projectsLinkLive')) + '</a>');
    }
    overlayLinks.innerHTML = linkBits.join('');

    overlayEl.classList.add('active');
    overlayEl.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    /* Focus close button so keyboard users can dismiss without mouse. */
    overlayCloseBtn.focus({ preventScroll: true });
  }

  function closeOverlay() {
    if (!overlayEl || !overlayEl.classList.contains('active')) return;
    overlayEl.classList.remove('active');
    overlayEl.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  /* ── Boot ──────────────────────────────────────────────────────── */
  function cacheOverlayEls() {
    overlayEl        = document.getElementById('projectOverlay');
    overlayContent   = document.getElementById('projectOverlayContent');
    overlayCloseBtn  = document.getElementById('projectOverlayClose');
    overlayTitle     = document.getElementById('projectOverlayTitle');
    overlayType      = document.getElementById('projectOverlayType');
    overlayMeta      = document.getElementById('projectOverlayMeta');
    overlayBody      = document.getElementById('projectOverlayBody');
    overlayLinks     = document.getElementById('projectOverlayLinks');
    if (!overlayEl) return;
    overlayCloseBtn.addEventListener('click', closeOverlay);
    /* Click-on-backdrop closes. Click inside the content panel does
       not — matches gallery.js / posts.js overlay vocabulary. */
    overlayEl.addEventListener('click', function (e) {
      if (e.target === overlayEl) closeOverlay();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlayEl && overlayEl.classList.contains('active')) {
      closeOverlay();
    }
  });

  async function load() {
    var grid = document.getElementById('projects-grid');
    var statusEl = document.getElementById('projects-status');
    if (grid) grid.innerHTML = '<p class="projects-status">' + esc(t('projectsLoading')) + '</p>';
    if (statusEl) statusEl.textContent = '';

    try {
      var res = await fetch('data/projects.json?t=' + Date.now());
      if (!res.ok) throw new Error('HTTP ' + res.status);
      DATA = await res.json();
      ITEMS = Array.isArray(DATA.items) ? DATA.items : [];
      renderIntro();
      renderGrid();
    } catch (err) {
      console.warn('Projects JSON load failed; nothing to show:', err.message);
      if (grid) grid.innerHTML = '<p class="projects-status">' + esc(t('projectsErrorLoading')) + '</p>';
    }
  }

  window.addEventListener('languageChange', function () {
    if (!DATA) return;
    renderIntro();
    renderGrid();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { cacheOverlayEls(); load(); });
  } else {
    cacheOverlayEls();
    load();
  }
})();
