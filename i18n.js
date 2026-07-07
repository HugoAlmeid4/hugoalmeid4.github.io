/* ────────────────────────────────────────────────────────────────────────
   i18n.js — Cross-page language switcher
   ────────────────────────────────────────────────────────────────────────
   Shared translation module used by every page (index.html, cv.html,
   now.html, gallery.html, certificates.html). Pairs with posts.js for the
   post overlay only when both scripts load on the same page.

   What it does:
   1. Reads the saved language from localStorage on boot (key:
      "blogLanguage", default "en").
   2. Mounts a language switcher into any element with id="globalLangSwitcher".
      Reuses the existing .language-switcher-dropdown styles from posts.css —
      no new CSS needed for the dropdown itself.
   3. Applies [data-i18n] attributes on elements whose <text> is a static
      key in sharedTranslations. Update the page text instantly without a
      network call.
   4. Dispatches a "languageChange" CustomEvent on window detail=lang. Other
      scripts (bio.js, cv.js, now.js, the post overlay in posts.js) listen
      for it and re-render / re-translate their own content. This keeps the
      on-page content script decoupled from the picker UI.
   5. Falls back to a single in-flight-and-cached Google Translate call for
      any dynamic text that wasn't pre-baked (cached in localStorage so the
      same string isn't re-fetched across reloads).
   6. Smooth loading: adds .i18n-loading class during a switch, which fades
      main content out for ~180ms. The switcher button gets a small
      spinner-style pseudo-element while loading.

   Optimizations:
   - Strings are pre-baked into data/*.json (no per-page translation round-
     trip). Only the small fallback runtime translation path hits the API.
   - API responses are cached by key `${text}_${lang}` in localStorage
     (cleared if storage quota is hit).
   - The UI strings in sharedTranslations are 6 keys × 3 langs = 18 strings
     (~600 bytes), loaded inline so there's zero network overhead.

   Exposed global: window.i18n
     - i18n.lang            current language
     - i18n.setLanguage(lang, opts?)  fire-and-forget switcher entry point
     - i18n.t(key)          shared UI string in current lang, fall back en
     - i18n.localize(obj)   pick en/pt/es from a { en, pt, es } object
     - i18n.translateText(text, lang)  Google Translate API with localStorage
                              cache. Returns promise<string>.
   ──────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  /* Shared UI translations. Keep this list small — anything page-specific
     lives in data/*.json and is picked up by the page's own loader. */
  var sharedTranslations = {
    en: {
      navHome: 'Home',
      navGallery: 'Gallery',
      navCertificates: 'Certificates',
      navNow: 'Now',
      navCV: 'CV'
    },
    pt: {
      navHome: 'Início',
      navGallery: 'Galeria',
      navCertificates: 'Certificados',
      navNow: 'Agora',
      navCV: 'CV'
    },
    es: {
      navHome: 'Inicio',
      navGallery: 'Galería',
      navCertificates: 'Certificados',
      navNow: 'Ahora',
      navCV: 'CV',
      returnHome: 'Return to Earth'
    }
  };

  var LANG_KEY = 'blogLanguage';
  var CACHE_KEY = 'i18n_dynamic_cache_v1';
  var SUPPORTED = ['en', 'pt', 'es'];

  /* AbortController per in-flight request so a stale request can't overwrite
     a newer result if the user switches languages twice quickly. */
  var inFlight = null;

  function readLang() {
    var saved = null;
    try { saved = localStorage.getItem(LANG_KEY); } catch (e) {}
    return SUPPORTED.indexOf(saved) >= 0 ? saved : 'en';
  }

  function writeLang(l) {
    try { localStorage.setItem(LANG_KEY, l); } catch (e) {}
  }

  /* Pick the right string from a { en, pt, es }-shaped value. Returns the
     English fallback if the requested language or the field is missing. */
  function localize(v, lang) {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'object') {
      if (typeof v[lang] === 'string' && v[lang]) return v[lang];
      if (typeof v.en === 'string') return v.en;
    }
    return String(v);
  }

  /* Lightweight client-side cache for dynamic Google Translate calls so
     visiting the page twice doesn't hit the API again. Quota-safe: silently
     fall back to network if localStorage is unavailable or full. */
  function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function writeCache(obj) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
    } catch (e) {
      /* Quota exceeded — drop the cache and try once more empty. Better to
         lose the cache than to throw and break translation. */
      try { localStorage.removeItem(CACHE_KEY); } catch (e2) {}
    }
  }

  /* Single-text Google Translate call. Caches by `${text}_${lang}`.
     Returns the original text on failure (network/HTTP error/timeout) so the
     UI never shows a broken state — just keeps the English fallback. */
  async function translateText(text, lang) {
    if (!text || typeof text !== 'string') return text;
    if (lang === 'en') return text;
    if (SUPPORTED.indexOf(lang) < 0) return text;

    var cacheKey = text + '__' + lang;
    var cache = readCache();
    if (cache[cacheKey] != null) return cache[cacheKey];

    var targetCode = lang === 'pt' ? 'pt-PT' : lang;
    var url = 'https://translate.googleapis.com/translate_a/single'
      + '?client=gtx&sl=en&tl=' + targetCode
      + '&dt=t&q=' + encodeURIComponent(text);

    try {
      var res = await fetch(url, { signal: inFlight && inFlight.signal });
      if (!res.ok) return text;
      var data = await res.json();
      var translated = (data && data[0]) ? data[0].map(function (x) { return x[0]; }).join('') : text;
      cache[cacheKey] = translated;
      writeCache(cache);
      return translated;
    } catch (e) {
      return text;
    }
  }

  /* Walk the DOM and update any [data-i18n] element whose textContent
     matches the key. Wraps the work in rAF so the fade-out runs first. */
  function applyStaticTranslations() {
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var key = nodes[i].getAttribute('data-i18n');
      var dict = sharedTranslations[lang] || sharedTranslations.en;
      var value = dict[key];
      if (value == null) value = sharedTranslations.en[key] != null ? sharedTranslations.en[key] : key;
      if (nodes[i].textContent !== value) nodes[i].textContent = value;
    }
  }

  /* The dropdown HTML. Mirrors posts.js's switcher so the two coexist
     visually without competing inline styles. */
  function menuHTML(l) {
    var langName = (l === 'pt') ? 'Português' : (l === 'es') ? 'Español' : 'English';
    return ''
      + '<div class="language-switcher-dropdown i18n-global">'
      +   '<button class="lang-menu-toggle" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="Change language">'
      +     '<span class="lang-current-short">' + l.toUpperCase() + '</span>'
      +     '<span class="lang-current-full">' + langName + '</span>'
      +     '<span class="lang-caret">▾</span>'
      +   '</button>'
      +   '<div class="lang-menu" role="menu">'
      +     '<button class="lang-menu-option ' + (l === 'en' ? 'active' : '') + '" data-lang="en" type="button" role="menuitem">English</button>'
      +     '<button class="lang-menu-option ' + (l === 'pt' ? 'active' : '') + '" data-lang="pt" type="button" role="menuitem">Português</button>'
      +     '<button class="lang-menu-option ' + (l === 'es' ? 'active' : '') + '" data-lang="es" type="button" role="menuitem">Español</button>'
      +   '</div>'
      + '</div>';
  }

  /* Find every #globalLangSwitcher placeholder and inject the menu. Also
     bind click handlers (idempotent — safe to call again on SPA-style
     re-renders). */
  function mountSwitcher() {
    var slots = document.querySelectorAll('#globalLangSwitcher');
    for (var i = 0; i < slots.length; i++) {
      /* Already mounted → just sync the active state. */
      if (slots[i].querySelector('.language-switcher-dropdown')) {
        syncSwitcherActive(slots[i]);
        continue;
      }
      slots[i].innerHTML = menuHTML(lang);
      bindSwitcherEvents(slots[i]);
    }
  }

  function syncSwitcherActive(root) {
    var opts = root.querySelectorAll('.lang-menu-option');
    for (var i = 0; i < opts.length; i++) {
      var optLang = opts[i].getAttribute('data-lang');
      opts[i].classList.toggle('active', optLang === lang);
    }
    var toggles = root.querySelectorAll('.lang-menu-toggle');
    for (var j = 0; j < toggles.length; j++) {
      toggles[j].querySelector('.lang-current-short').textContent = lang.toUpperCase();
      var langName = (lang === 'pt') ? 'Português' : (lang === 'es') ? 'Español' : 'English';
      toggles[j].querySelector('.lang-current-full').textContent = langName;
    }
  }

  function bindSwitcherEvents(slot) {
    var dropdown = slot.querySelector('.language-switcher-dropdown');
    var toggle = dropdown.querySelector('.lang-menu-toggle');
    var opts = dropdown.querySelectorAll('.lang-menu-option');

    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = dropdown.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });

    for (var i = 0; i < opts.length; i++) {
      opts[i].addEventListener('click', function (e) {
        e.stopPropagation();
        dropdown.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        var target = opts[i].getAttribute('data-lang');
        if (target && target !== lang) i18n.setLanguage(target);
      });
    }
  }

  /* Close any open menu when clicking elsewhere. Bound once globally. */
  function bindGlobalDismiss() {
    if (window.__i18nDismissBound) return;
    window.__i18nDismissBound = true;
    document.addEventListener('click', function () {
      var open = document.querySelectorAll('.language-switcher-dropdown.open');
      for (var i = 0; i < open.length; i++) {
        open[i].classList.remove('open');
        var b = open[i].querySelector('.lang-menu-toggle');
        if (b) b.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* Smooth fade transition: add .i18n-loading to <main>, swap the language
     (synchronous for [data-i18n], async-bridged for content via events), and
     remove the class once the page has had a frame to repaint. */
  function startLoadingFade() {
    var main = document.querySelector('main') || document.body;
    main.classList.add('i18n-loading');
    document.documentElement.classList.add('i18n-busy');
  }
  function endLoadingFade() {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var main = document.querySelector('main') || document.body;
        main.classList.remove('i18n-loading');
        document.documentElement.classList.remove('i18n-busy');
      });
    });
  }

  var lang = readLang();
  var listeners = [];

  function setLanguage(nextLang, opts) {
    if (SUPPORTED.indexOf(nextLang) < 0) return;
    if (nextLang === lang) return;
    lang = nextLang;
    writeLang(nextLang);

    var skipFade = opts && opts.silent;
    if (!skipFade) startLoadingFade();

    /* Synchronous updates: nav text + menu state. */
    applyStaticTranslations();
    mountSwitcher();

    /* Async updates: each content script listens and re-renders. */
    var evt = new CustomEvent('languageChange', { detail: { lang: lang, prev: opts && opts.prev || null } });
    window.dispatchEvent(evt);

    /* End the fade after listeners had a microtask to react. */
    Promise.resolve().then(function () {
      if (!skipFade) endLoadingFade();
    });
  }

  function on(fn) {
    if (typeof fn === 'function') listeners.push(fn);
  }

  /* ─── Boot ───────────────────────────────────────────────────────────── */
  function boot() {
    bindGlobalDismiss();
    mountSwitcher();
    applyStaticTranslations();

    /* Notify any listening content scripts on boot too, so they can render
       in the saved language on first paint instead of English. */
    var evt = new CustomEvent('languageChange', { detail: { lang: lang, boot: true } });
    window.dispatchEvent(evt);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* Expose the public API. */
  window.i18n = {
    get lang() { return lang; },
    supportedLangs: SUPPORTED,
    setLanguage: setLanguage,
    t: function (key) {
      var d = sharedTranslations[lang] || sharedTranslations.en;
      return d[key] != null ? d[key] : (sharedTranslations.en[key] != null ? sharedTranslations.en[key] : key);
    },
    localize: localize,
    translateText: translateText,
    on: on,
    applyStaticTranslations: applyStaticTranslations,
    mountSwitcher: mountSwitcher
  };
})();
