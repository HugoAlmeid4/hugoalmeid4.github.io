/* ────────────────────────────────────────────────────────────────────────
   projects.js — Projects page renderer
   ────────────────────────────────────────────────────────────────────────
   Reads data/projects.json (English-only source), then translates each
   text field at runtime via window.i18n.translateText() — the same
   pipeline posts.js uses. Mirrors posts.js: caches translations in
   memory + localStorage, shows a one-time accuracy warning the first
   time the visitor picks a non-English language, hides silently after
   that. Status badges / chips / links use the existing site styling
   (status-completed / status-processing / status-planned palette,
   tech-chip chip vocabulary). Detail overlay reuses the global
   .project-fullscreen-overlay CSS that posts.js introduced.

   Data shape (English-only):
     {
       intro: "Things I've built…",
       items: [{
         id, title, description, body, status, year,
         tech: ["Python", "PyQt"], repo_url, live_url, image
       }]
     }

   INVARIANT: this script runs AFTER i18n.js via <script defer> ordering
   (projects.html lists `i18n.js` before `projects.js`). Do not reorder.
   ──────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escAttr(s) {
    return String(s == null ? '' : s).replace(/"/g, '&quot;');
  }

  /* i18n bridge — fall back to identity / English so tests / pre-paint
     runs don't throw before i18n.js loads. */
  var t        = function (k) { return (window.i18n && typeof k === 'string') ? window.i18n.t(k) : k; };
  var safeUrl  = function (u) { return window.i18n ? window.i18n.safeUrl(u) : (u || '#'); };

  var STATUS = {
    'completed':  { labelKey: 'projectsStatusCompleted',  cssClass: 'status-completed'  },
    'in-progress':{ labelKey: 'projectsStatusInProgress', cssClass: 'status-processing' },
    'planned':    { labelKey: 'projectsStatusPlanned',    cssClass: 'status-planned'    }
  };

  /* Mobile detection: returns true when the viewport is at or below the
     768px breakpoint — i.e., the same width used for the slide/overlay
     controls elsewhere in projects.css. Centralised here so the URL /
     navigation logic and the CSS stay in lockstep (changing the breakpoint
     here would force a matching change in the @media block in projects.css). */
  function isMobileFullPageMode() {
    return typeof window.matchMedia === 'function' &&
           window.matchMedia('(max-width: 768px)').matches;
  }

  var DATA = null;
  var ITEMS = [];

  /* Module-local language state. Initialised to 'en' so it diverges
     from window.i18n.lang on boot — that's how posts.js detects the
     non-English first-load case and fires the translation warning.
     Synced to i18n.lang whenever a languageChange event sets it. */
  var currentLanguage = 'en';

  /* Caches for runtime Google Translate output. Keyed by `${id}_${lang}`
     so changing the dataset / project / language never collides with an
     older entry. i18n.translateText also persists to localStorage so
     reloads skip the network call entirely. */
  var itemCache = {};
  var introCache = {};

/* ── Translation warning (mirrors posts.js) ────────────────────── */
  function showTranslationWarning(targetLang) {
    var overlay = document.createElement('div');
    overlay.id = 'projectsTranslationWarning';
    overlay.className = 'tag-popup';
    overlay.style.zIndex = '5000';
    overlay.innerHTML =
      '<div class="tag-popup-content" style="max-width:400px;">' +
        '<h4 style="margin-bottom:15px;">' + esc(t('projectsAccuracyWarningTitle')) + '</h4>' +
        '<p style="font-size:14px;line-height:1.6;margin-bottom:25px;opacity:0.8;">' + esc(t('projectsAccuracyWarningText')) + '</p>' +
        '<button class="close-popup-btn" id="projectsConfirmWarningBtn">' + esc(t('projectsAccuracyGotIt')) + '</button>' +
      '</div>';
    document.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.classList.add('active'); });
    document.body.style.overflow = 'hidden';
    var btn = document.getElementById('projectsConfirmWarningBtn');
    if (btn) btn.onclick = function () {
      try { localStorage.setItem('translationWarningSeen', 'true'); } catch (e) {}
      overlay.classList.remove('active');
      setTimeout(function () {
        overlay.remove();
        document.body.style.overflow = '';
        executeLanguageChange(targetLang);
      }, 300);
    };
  }

  /* ── Loader for the initial render + first translation ────────────── */
  function showLoader(label) {
    var status = document.getElementById('projects-status');
    if (status) status.innerHTML = '<span class="projects-spinner" aria-hidden="true"></span> ' + esc(label);
  }
  function hideLoader(text) {
    var status = document.getElementById('projects-status');
    if (status) status.textContent = text || '';
  }

  /* ── Translation pipeline ───────────────────────────────────────── */
  async function translateField(enText, lang) {
    if (lang === 'en' || !enText || typeof enText !== 'string') return enText || '';
    if (!window.i18n || typeof window.i18n.translateText !== 'function') return enText;
    return window.i18n.translateText(enText, lang);
  }

  async function translateItem(item, lang) {
    if (!item) return item;
    if (lang === 'en') return item;
    var cacheKey = item.id + '_' + lang;
    if (itemCache[cacheKey]) return Object.assign({}, item, itemCache[cacheKey]);

    var translated = {
      title:       await translateField(item.title, lang),
      description: await translateField(item.description, lang),
      body:        await translateField(item.body, lang)
    };
    itemCache[cacheKey] = translated;
    return Object.assign({}, item, translated);
  }

  async function translateIntro(text, lang) {
    if (!text) return '';
    if (lang === 'en') return text;
    if (introCache[lang]) return introCache[lang];
    var out = await translateField(text, lang);
    introCache[lang] = out;
    return out;
  }

  async function getAllItems(lang) {
    return Promise.all(ITEMS.map(function (item) { return translateItem(item, lang); }));
  }

  /* ── Render ────────────────────────────────────────────────────── */
  async function renderIntro(lang) {
    var introEl = document.getElementById('projects-intro');
    if (!introEl || !DATA) return;
    if (!DATA.intro) {
      introEl.textContent = '';
      introEl.hidden = true;
      return;
    }
    introEl.textContent = await translateIntro(DATA.intro, lang);
    introEl.hidden = false;
  }

  function renderCard(item, lang) {
    /* getAllItems(lang) → translateItem() returns items whose
       title/description/body are already the localized values, so we
       just read the fields directly. The `lang` arg is kept for future
       per-language affordances (e.g. RTL alignment for hi/ur) and for
       clear call signatures. */
    var title = item.title || item.id || '';
    var desc  = item.description || '';

    var safeImageSrc = item.image ? safeUrl(item.image) : '';
    var previewHTML;
    if (item.image) {
      previewHTML = '<img src="' + escAttr(safeImageSrc) + '" alt="' + escAttr(title) + '" loading="lazy" decoding="async">';
    } else {
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
    card.setAttribute('aria-label', title);
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

    var img = card.querySelector('img');
    if (img) {
      img.addEventListener('load', function () { img.classList.add('loaded'); }, { once: true });
      img.addEventListener('error', function () { img.classList.add('loaded'); }, { once: true });
    }
    return card;
  }

  var translatedItemsByLang = {};

  async function renderGrid(lang) {
    var grid = document.getElementById('projects-grid');
    if (!grid) return;

    if (!ITEMS.length) {
      grid.innerHTML =
        '<div class="project-card-empty-state">' +
          '<p>' + esc(t('projectsEmpty')) + '</p>' +
        '</div>';
      hideLoader('');
      return;
    }

    var items = translatedItemsByLang[lang] || await getAllItems(lang);
    translatedItemsByLang[lang] = items;

    grid.innerHTML = '';
    var frag = document.createDocumentFragment();
    items.forEach(function (item) {
      var card = renderCard(item, lang);
      /* Card click goes through openProject (not openOverlay directly) so
         it can update the URL and toggle mobile-fullpage-mode CSS state
         on mobile. openProject forwards to openOverlay after the URL/UX
         hooks are set, so the rest of the rendering path is unchanged. */
      card.addEventListener('click', function () { openProject(item, lang); });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openProject(item, lang); }
      });
      frag.appendChild(card);
    });
    grid.appendChild(frag);

    hideLoader(items.length + ' ' + (items.length === 1 ? t('projectsCountSingular') : t('projectsCountPlural')));
  }

  async function renderAll(lang) {
    lang = lang || (window.i18n ? window.i18n.lang : 'en');
    await renderIntro(lang);
    await renderGrid(lang);
  }

  /* ── Detail overlay ────────────────────────────────────────────── */
  var overlayEl, overlayContent, overlayCloseBtn, overlayTitle, overlayType,
      overlayMeta, overlayBody, overlayLinks, overlayHero;

  /* openProject is the entry point called by project cards. It updates the
     URL so that opening a project is shareable / bookmarkable / reload-safe,
     then forwards to openOverlay.

     - Mobile: pushState + body.mobile-fullpage-mode class. The CSS for that
       class hides the header + projects grid, so the overlay IS the visible
       page. pushState adds a back entry so the browser back button closes
       the overlay and returns to the grid (matching posts.js's mobile UX).
     - PC: replaceState only (no extra back entry). The overlay stays a
       modal that animates over the grid, matching the existing PC behaviour.
       replaceState (not pushState) keeps the back button out of the overlay
       so pressing it doesn't trap users mid-modal.

     The deep-link branch in load() handles the case of directly arriving at
     ?project=X via shared link: it adds the body class but does NOT push
     state (the URL IS the user's current entry). */
  function openProject(item, lang) {
    var url = new URL(window.location.href);
    url.searchParams.set('project', item.id);
    if (isMobileFullPageMode()) {
      window.history.pushState({ projectId: item.id }, '', url);
      document.body.classList.add('mobile-fullpage-mode');
    } else {
      window.history.replaceState({}, '', url);
    }
    openOverlay(item, lang);
  }

  function openOverlay(item, lang) {
    if (!overlayEl) return;
    lang = lang || (window.i18n ? window.i18n.lang : 'en');
    var translated  = (itemCache[item.id + '_' + lang]) || {};
    var title       = (lang === 'en' ? item.title       : translated.title)       || item.id || '';
    var description = (lang === 'en' ? item.description : translated.description) || '';
    var body        = (lang === 'en' ? item.body        : translated.body)        || '';

    overlayTitle.textContent = title;
    overlayType.textContent = t('projectsOverlayType');

    var metaBits = [];
    if (item.status && STATUS[item.status]) {
      var st = STATUS[item.status];
      metaBits.push('<span class="meta-chip"><span class="status-badge ' + st.cssClass + '">' + esc(t(st.labelKey)) + '</span></span>');
    }
    if (item.year) {
      metaBits.push('<span class="meta-chip"><span class="meta-chip-label">' + esc(t('projectsOverlayYear')) + '</span> <span class="meta-chip-value">' + esc(String(item.year)) + '</span></span>');
    }
    overlayMeta.innerHTML = metaBits.join('');

    var bodyBits = [];
    var safeImageSrc = item.image ? safeUrl(item.image) : '';
    /* Image is NOT rendered into the body anymore — it lives in
       overlayHero as a full-viewport-width banner (see CSS). */
    if (Array.isArray(item.tech) && item.tech.length) {
      bodyBits.push('<div class="project-fullscreen-tech">' +
        item.tech.map(function (chip) { return '<span class="tech-chip">' + esc(chip) + '</span>'; }).join('') +
        '</div>');
    }
    if (description) bodyBits.push('<p>' + esc(description) + '</p>');
    if (body)        bodyBits.push('<p>' + esc(body) + '</p>');
    overlayBody.innerHTML = bodyBits.join('');

    /* Hero banner — full-viewport-width image at the top of the overlay.
       Mirrors renderCard(): fade in via .loaded class on img load/error
       so the placeholder background doesn't flash a long-lived image
       (large preview photos can take 200-500ms to decode). */
    if (item.image) {
      overlayHero.innerHTML = '<img src="' + escAttr(safeImageSrc) + '" alt="' + escAttr(title) + '" loading="lazy" decoding="async">';
      overlayHero.hidden = false;
      var heroImg = overlayHero.querySelector('img');
      if (heroImg) {
        heroImg.addEventListener('load',  function () { heroImg.classList.add('loaded'); }, { once: true });
        heroImg.addEventListener('error', function () { heroImg.classList.add('loaded'); heroImg.classList.add('error'); }, { once: true });
      }
    } else {
      overlayHero.innerHTML = '';
      overlayHero.hidden = true;
    }

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
    overlayCloseBtn.focus({ preventScroll: true });
  }

  function closeOverlay() {
    if (!overlayEl || !overlayEl.classList.contains('active')) return;
    overlayEl.classList.remove('active');
    overlayEl.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    /* Always clear the mobile-fullpage body class on close so the page
       chrome (header + projects grid) snaps back into view. Safe to call
       when not in mobile mode — it's a no-op class removal. */
    document.body.classList.remove('mobile-fullpage-mode');

    /* URL cleanup mirrors what openProject / load() did at open time:
       - Mobile pushState branch → history.back() pops the pushed entry so
         the browser back button takes the user back to the project grid
         (not to whatever site they were on before).
       - PC replaceState branch OR a deep-link arrival (no push happened) →
         replaceState strips ?project=X from the current URL.
       In both cases, the resulting URL has no project param, so the page
       returns to its resting "projects grid" state. */
    var url = new URL(window.location.href);
    if (url.searchParams.has('project')) {
      var pushed = window.history.state && window.history.state.projectId;
      if (pushed) {
        window.history.back();
      } else {
        url.searchParams.delete('project');
        window.history.replaceState({}, '', url);
      }
    }
  }

  function cacheOverlayEls() {
    overlayEl       = document.getElementById('projectOverlay');
    overlayContent  = document.getElementById('projectOverlayContent');
    overlayCloseBtn = document.getElementById('projectOverlayClose');
    overlayTitle    = document.getElementById('projectOverlayTitle');
    overlayType     = document.getElementById('projectOverlayType');
    overlayMeta     = document.getElementById('projectOverlayMeta');
    overlayHero     = document.getElementById('projectOverlayHero');
    overlayBody     = document.getElementById('projectOverlayBody');
    overlayLinks    = document.getElementById('projectOverlayLinks');
    if (!overlayEl) return;
    overlayCloseBtn.addEventListener('click', closeOverlay);
    overlayEl.addEventListener('click', function (e) { if (e.target === overlayEl) closeOverlay(); });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlayEl && overlayEl.classList.contains('active')) closeOverlay();
  });

  /* popstate listener handles browser Back / Forward buttons once the page
     is in mobile-fullpage mode. Without this, history.back() from
     closeOverlay() would leave the overlay visible because popstate itself
     doesn't trigger closeOverlay — only the listener does. */

  window.addEventListener('popstate', function () {
    var projectId = new URLSearchParams(window.location.search).get('project');
    if (projectId) {
      /* Forward into another ?project=X (rare; only happens if the user
         manually navigates to a second deep link). Open that project; the
         overlay element is a singleton so this re-uses the same DOM and
         just swaps the rendered content. */
      var matchingItem = ITEMS.find(function (i) { return i.id === projectId; });
      if (matchingItem) {
        var lang = window.i18n ? window.i18n.lang : 'en';
        if (isMobileFullPageMode()) document.body.classList.add('mobile-fullpage-mode');
        openOverlay(matchingItem, lang);
      }
    } else {
      /* Back to the project-less grid. If the overlay element still has
         the .active class (could happen if history.back() fired from
         elsewhere), force-close it. Idempotent: closeOverlay already
         guard-checks .active. */
      if (!overlayEl) return;
      if (overlayEl.classList.contains('active')) {
        overlayEl.classList.remove('active');
        overlayEl.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        document.body.classList.remove('mobile-fullpage-mode');
      }
    }
  });

  /* ── i18n language-change pipeline (mirrors posts.js) ───────────── */
  async function executeLanguageChange(lang) {
    if (!DATA) return; /* load() will pick up current lang and translate */
    showLoader(t('projectsTranslating'));
    await renderAll(lang);
  }

  window.addEventListener('languageChange', async function (e) {
    var lang = e && e.detail && e.detail.lang;
    if (!lang) return;
    /* Module-local currentLanguage (initialised to 'en' above) is the
       key to firing the warning on first non-English load. Comparing
       against window.i18n.lang would always be equal on the boot
       dispatch because i18n.js sets lang BEFORE dispatching, so the
       listener would return early and the warning would never show.
       posts.js uses the same module-local pattern. */
    var prev = currentLanguage;
    currentLanguage = lang;
    if (lang === prev) return;

    if (lang !== 'en') {
      var seen = false;
      try { seen = !!localStorage.getItem('translationWarningSeen'); } catch (e2) {}
      if (!seen) {
        showTranslationWarning(lang);
        return;
      }
    } else if (!DATA) {
      /* English + still loading, let load() finish first */
      return;
    }
    await executeLanguageChange(lang);
  });

  /* ── Boot ──────────────────────────────────────────────────────── */
  async function load() {
    var grid = document.getElementById('projects-grid');
    if (grid) grid.innerHTML = '';
    var lang = window.i18n ? window.i18n.lang : 'en';
    if (lang === 'en') showLoader(t('projectsLoading'));
    else showLoader(t('projectsTranslating'));

    try {
      var res = await fetch('data/projects.json?t=' + Date.now());
      if (!res.ok) throw new Error('HTTP ' + res.status);
      DATA  = await res.json();
      ITEMS = Array.isArray(DATA.items) ? DATA.items : [];
      await renderAll(lang);

      /* Deep-link handling: if the user landed here via a shared
         ?project=X URL (or refreshed one), open that project after the
         grid has rendered. On mobile we add the body class so the page
         chrome hides (matches the in-app openProject behaviour); on PC
         we just open the overlay directly. We do NOT pushState — the URL
         is the user's current history entry, so closeOverlay() will
         replaceState-strip the param rather than call history.back(). */
      var deepLinkedId = new URLSearchParams(window.location.search).get('project');
      if (deepLinkedId) {
        var matchingItem = ITEMS.find(function (i) { return i.id === deepLinkedId; });
        if (matchingItem) {
          if (isMobileFullPageMode()) document.body.classList.add('mobile-fullpage-mode');
          openOverlay(matchingItem, lang);
        }
      }
    } catch (err) {
      console.warn('Projects JSON load failed; nothing to show:', err.message);
      if (grid) grid.innerHTML = '<p class="projects-status">' + esc(t('projectsErrorLoading')) + '</p>';
      hideLoader('');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { cacheOverlayEls(); load(); });
  } else {
    cacheOverlayEls();
    load();
  }
})();
