/* ────────────────────────────────────────────────────────────────────────
   banner.js — Site announcement banner
   ────────────────────────────────────────────────────────────────────────
   Reads `data/banner.json`, renders a thin strip at the very top of the
   body when the banner is enabled and there's text for the current
   language. Editable from the /admin dashboard (Sveltia CMS).

   Schema (data/banner.json):
     {
       "enabled":     boolean            // global on/off
       "dismissable": boolean            // user can X it out
       "text":        { en, pt, es, hi, zh }   // message per language
       "url":         string | ""        // optional link (https://... or /
                                          // or /path or #anchor)
     }

   Behaviour:
     - If enabled=false                  → nothing rendered
     - If text[currentLang].trim() == "" → nothing rendered (so admins
                                            can suppress for a single
                                            language by clearing that
                                            field)
     - If dismissable=true && already dismissed at this version
                                        → nothing rendered
     - On languageChange                 → re-render in new language
     - On dismiss click                  → write version key to
                                            localStorage; banner removed
     - On network failure (fetch 404)   → silently bail — page works
                                            without a banner

   Versioned dismissal:
     The dismissal stores a hash derived from the current text+url into
     localStorage under "siteBannerDismissed_v1". When the admin edits
     the banner text or URL in the CMS, the hash changes and previously
     dismissed users see the new banner. Keeps banners usable without
     treading on the visitor's "I closed it" intent.

   Script ordering:
     Loaded with `defer` AFTER i18n.js so `window.i18n.lang` is already
     set by the time boot() runs (defer scripts execute in document
     order). This module never reads i18n.lang before banner.json
     resolves, but the ordering guarantees the gap is closed.
   ──────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var DISMISS_KEY = 'siteBannerDismissed_v1';
  var FALLBACK_LANG = 'en';

  var raw_data = null;
  var currentLang = FALLBACK_LANG;
  var bannerEl = null;

  /* ── Helpers ─────────────────────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* Same allow-list as i18n.safeUrl() — but local so banner.js works
     even before window.i18n is on the page. Mirrors the policy in
     i18n.js so admin-edited URLs can't become script-injection vectors. */
  function safeUrl(u) {
    if (u == null) return '';
    var s = String(u).trim();
    if (!s) return '';
    if (/^#/.test(s)) return s;
    if (/^(https?|mailto|tel):/i.test(s)) return s;
    if (/^[a-z][a-z0-9+.\-]*:/i.test(s)) return '';
    return '/' + encodeURI(s).replace(/^\/+/, '');
  }

  /* Resolve the banner text to a string in the current language, with
     en fallback. Defers to i18n.localize() if available so the supported-
     language list and fallback chain stay single-sourced (banner.js loads
     with `defer` AFTER i18n.js in document order, so window.i18n.localize
     is guaranteed live by the time render() runs). The `|| ''` keeps
     the function call safe if the admin renames / removes i18n.js. */
  function pickText(lang) {
    if (!raw_data) return '';
    if (window.i18n && typeof window.i18n.localize === 'function') {
      return window.i18n.localize(raw_data.text || '', lang);
    }
    /* Fast-path fallback if i18n.js isn't around for some reason. */
    var t = raw_data.text || '';
    if (typeof t === 'string') return t;
    if (t && typeof t === 'object') {
      if (typeof t[lang] === 'string') return t[lang];
      if (typeof t.en === 'string') return t.en;
    }
    return '';
  }

  /* Version key for the dismissable localStorage. Uses the ENGLISH text so
     dismissals cross language switches — if "Welcome" gets dismissed in
     Portuguese, the next reload in English still recognizes the same
     announcement and doesn't re-show it. Any change to EN text or URL
     still invalidates the version, so admin edits naturally re-show
     the banner to previously-dismissed users. */
  function dismissVersion() {
    if (!raw_data) return '';
    var canonicalText = pickText(FALLBACK_LANG);
    return canonicalText + '|' + (raw_data.url || '');
  }

  function isDismissed() {
    if (!raw_data || !raw_data.dismissable) return false;
    try {
      return localStorage.getItem(DISMISS_KEY) === dismissVersion();
    } catch (e) { return false; }
  }
  function setDismissed() {
    if (!raw_data || !raw_data.dismissable) return;
    try { localStorage.setItem(DISMISS_KEY, dismissVersion()); } catch (e) { /* no-op */ }
  }

  /* ── Render ──────────────────────────────────────────────────────────── */
  function removeBanner() {
    if (bannerEl && bannerEl.parentNode) bannerEl.parentNode.removeChild(bannerEl);
    bannerEl = null;
  }

  function render() {
    removeBanner();
    if (!raw_data || !raw_data.enabled) return;
    if (isDismissed()) return;

    var text = pickText(currentLang);
    if (!text || !text.trim()) return;

    var urlRaw = safeUrl(raw_data.url || '');
    var isExternal = /^https?:/i.test(urlRaw);
    /* aria-label follows the page's saved language via i18n.t(); falls
       back to English if the key isn't registered (e.g. future lang
       additions that race the i18n.js update). */
    var dismissLabel = (window.i18n && typeof window.i18n.t === 'function')
      ? window.i18n.t('bannerDismiss')
      : 'Dismiss banner';

    var row = document.createElement('div');
    row.className = 'site-banner';
    row.setAttribute('role', 'status');
    row.setAttribute('aria-live', 'polite');

    if (urlRaw) {
      var a = document.createElement('a');
      a.className = 'site-banner-link';
      a.href = urlRaw;
      if (isExternal) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      var labelSpan = document.createElement('span');
      labelSpan.className = 'site-banner-text';
      labelSpan.textContent = text;
      a.appendChild(labelSpan);
      var arrow = document.createElement('span');
      arrow.className = 'site-banner-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '→';
      a.appendChild(arrow);
      row.appendChild(a);
    } else {
      var p = document.createElement('span');
      p.className = 'site-banner-text';
      p.textContent = text;
      row.appendChild(p);
    }

    if (raw_data.dismissable) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'site-banner-dismiss';
      btn.setAttribute('aria-label', dismissLabel);
      btn.textContent = '\u00d7'; /* × — keyboard-readable, language-neutral */
      btn.addEventListener('click', function () {
        setDismissed();
        removeBanner();
      });
      row.appendChild(btn);
    }

    /* Prepend to <body> so it sits above <header> on every page. */
    document.body.insertBefore(row, document.body.firstChild);
    bannerEl = row;

    /* Fade-in. The keyframe is defined in style.css (smoothFadeUp) and
       keeps the visual vocabulary consistent with the rest of the site. */
    requestAnimationFrame(function () {
      row.classList.add('site-banner-show');
    });

    /* If a post overlay is currently open (e.g. user navigates to a post
       via shared URL `?post=slug` while the overlay is already active),
       re-apply the elevated state to the freshly-rendered banner. */
    syncOverlayElevation();
  }

  /* ── Load / boot ─────────────────────────────────────────────────────── */
  async function loadBanner() {
    try {
      var res = await fetch('data/banner.json?t=' + Date.now());
      if (!res.ok) return;
      var data = await res.json();
      raw_data = data;
      currentLang = (window.i18n && window.i18n.lang) || FALLBACK_LANG;
      render();
    } catch (e) {
      /* Silent — page works fine without a banner. Console-only for
         debugging, since failures here shouldn't interrupt the page. */
      try { console.warn('banner.json load failed; banner disabled:', e && e.message); } catch (e2) { /* no-op */ }
    }
  }

  window.addEventListener('languageChange', function (e) {
    if (!raw_data) return;
    var l = (e && e.detail && e.detail.lang) || (window.i18n && window.i18n.lang) || FALLBACK_LANG;
    if (SUPPORTED.indexOf(l) < 0) l = FALLBACK_LANG;
    currentLang = l;
    render();
  });

  /* ── Post-overlay elevation ────────────────────────────────────
     Posts.js creates two full-viewport overlays (`postFullscreenOverlay`
     for the post reader and `postArchiveOverlay` for the "View all"
     archive list) lazily on first need. Both have stacking-context
     z-indices above the default layer (1000 and 2500 respectively),
     so a banner in normal flow at the top of <body> gets visually
     covered when either opens. Watch for them and switch the banner
     to `position:fixed; z-index:9999` (the `.site-banner-elevated`
     class) while either is `.active`, then revert on close. The body
     overflow:hidden that posts.js applies while the overlays are
     open also prevents the user from scrolling, so the banner's
     position swap is invisible — it stays at viewport top either way.
     ─────────────────────────────────────────────────────────── */
  var POST_OVERLAY_IDS = ['postFullscreenOverlay', 'postArchiveOverlay'];

  function syncOverlayElevation() {
    if (!bannerEl) return;
    var anyOpen = POST_OVERLAY_IDS.some(function (id) {
      var el = document.getElementById(id);
      return !!el && el.classList.contains('active');
    });
    bannerEl.classList.toggle('site-banner-elevated', anyOpen);
  }

  function attachOverlayObserver(overlayEl) {
    if (overlayEl.__bannerElevInstalled) return;
    overlayEl.__bannerElevInstalled = true;
    var obs = new MutationObserver(syncOverlayElevation);
    obs.observe(overlayEl, { attributes: true, attributeFilter: ['class'] });
  }

  function watchOverlays() {
    if (document.body.__bannerElevWired) return;
    document.body.__bannerElevWired = true;
    var bodyObs = new MutationObserver(function () {
      POST_OVERLAY_IDS.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) attachOverlayObserver(el);
      });
      syncOverlayElevation();
    });
    bodyObs.observe(document.body, { childList: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadBanner);
    document.addEventListener('DOMContentLoaded', watchOverlays);
  } else {
    loadBanner();
    watchOverlays();
  }
})();
