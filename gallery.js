/* ──────────────────────────────────────────────────────────────────────────
   gallery.js — Astrophotography gallery renderer
   ──────────────────────────────────────────────────────────────────────────
   Loaded with <script defer> in gallery.html, placed AFTER i18n.js so
   window.i18n is live by the time the boot runs. The defer attribute
   guarantees the DOM is fully parsed before this script executes, so all
   document.getElementById() calls resolve correctly.

   Responsibilities:
   - Fetch gallery/index.json and render the grid with localized titles/alts
   - Tab filtering by category
   - Search by title/alt/category text
   - Lightbox open/close with prev/next nav (keyboard, mouse, touch)
   - WebP → JPG fallback if a WebP source 404s
   - Watermark + download for the lightbox image
   - Re-render on window.languageChange
   ────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  /* ── State ───────────────────────────────────────────────────────── */
  var GALLERY_ITEMS = [];
  var filteredItems = [];
  var lightboxIndex = 0;
  var lightboxOpen  = false;
  var activeCategory = 'all';
  var searchQuery = '';

  var grid            = document.getElementById('gallery-grid');
  var statusEl        = document.getElementById('gallery-status');
  var lightboxEl      = document.getElementById('gallery-lightbox');
  var lightboxImg     = document.getElementById('lightbox-img');
  var lightboxCounter = document.getElementById('lightbox-counter');
  var lightboxCaption = document.getElementById('lightbox-caption');
  var lightboxClose   = document.getElementById('lightbox-close');
  var lightboxPrev    = document.getElementById('lightbox-prev');
  var lightboxNext    = document.getElementById('lightbox-next');
  var lightboxDl      = document.getElementById('lightbox-download');
  var lightboxSpinner = document.getElementById('lightbox-spinner');
  var lightboxInfo    = document.getElementById('lightbox-info');
  var canvas          = document.getElementById('watermark-canvas');
  var tabsContainer   = document.querySelector('.gallery-tabs');
  var tabs            = [];
  var categories      = [];
  var searchInput     = document.getElementById('gallery-search-input');

  function t(key) { return (window.i18n && typeof key === 'string') ? window.i18n.t(key) : key; }
  function fmt(tpl, vars) { return (window.i18n && typeof tpl === 'string') ? window.i18n.format(tpl, vars) : tpl; }
  function loc(v) { return (window.i18n && typeof window.i18n.localize === 'function') ? window.i18n.localize(v) : (typeof v === 'string' ? v : (v && v.en) || ''); }
  function catLabel(slug) { return (window.i18n && typeof window.i18n.categoryLabel === 'function') ? window.i18n.categoryLabel(slug) : (slug || '').replace(/-/g, ' '); }
  function pluralize(n) { return (window.i18n && typeof window.i18n.plural === 'function') ? window.i18n.plural('galleryImageSingular', 'galleryImagePlural', n) : (n + ' ' + (n === 1 ? 'image' : 'images')); }
  /* INVARIANT: this <script> runs AFTER i18n.js via <script defer> ordering.
     Do not reorder scripts — window.i18n.safeUrl may not be live yet. */
  var safeUrl = function (u) { return window.i18n.safeUrl(u); };

  function safeGet(name) {
    try { return localStorage.getItem(name); } catch (e) { return null; }
  }
  function safeSet(name, v) { try { localStorage.setItem(name, v); } catch (e) {} }

  /* ── Image observer (fade-in trigger only) ──────────────────────── *
   * The previous version assigned img.src from data-src INSIDE the
   * observer callback. That meant a broken / blocked
   * IntersectionObserver — or an item that never reached
   * `isIntersecting` (Safari quirks, certain ad-blockers, items in
   * an offscreen iframe) — left the grid showing alt text instead of
   * the photo, because no `src` was ever assigned. Now `src` is set
   * eagerly in renderGrid(); the observer only flips `.img-loaded` for
   * the fade-in effect, with the .jpg fallback handled by the error
   * listener attached during creation. */
  var imgObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var item = entry.target;
      var img  = item.querySelector('img');
      if (!img) { imgObserver.unobserve(item); return; }
      function markLoaded() { item.classList.add('img-loaded'); imgObserver.unobserve(item); }
      if (img.complete && img.naturalWidth > 0) { markLoaded(); return; }
      img.addEventListener('load', markLoaded, { once: true });
      img.addEventListener('error', function () {
        console.warn('[gallery] image failed to load:', img.src);
        markLoaded();
      }, { once: true });
    });
  }, { rootMargin: '300px 0px', threshold: 0 });

  /* ── Translate dynamic content via i18n.localize() ─────────────────
     gallery/index.json is pre-translated with {en,pt,es,hi} shapes for
     title/alt/target/notes. localize() picks the right language. */
  function renderTabs() {
    if (!tabsContainer) return;
    tabsContainer.innerHTML = '';
    function createTab(slug, label, selected) {
      var button = document.createElement('button');
      button.className = 'gallery-tab';
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', selected ? 'true' : 'false');
      button.dataset.category = slug;
      button.id = 'tab-' + slug;
      button.setAttribute('aria-controls', 'gallery-grid');
      button.textContent = label;
      if (selected) button.classList.add('active');
      return button;
    }
    tabsContainer.appendChild(createTab('all', t('galleryTabAll'), activeCategory === 'all'));
    categories.forEach(function(cat) {
      tabsContainer.appendChild(createTab(cat.slug, catLabel(cat.slug), activeCategory === cat.slug));
    });
    tabs = tabsContainer.querySelectorAll('.gallery-tab');
    tabs.forEach(function(tab) {
      tab.addEventListener('click', function() {
        tabs.forEach(function(t2) {
          t2.classList.remove('active');
          t2.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        activeCategory = tab.dataset.category;
        renderGrid();
      });
    });
  }

  function renderGrid() {
    var items = activeCategory === 'all'
      ? GALLERY_ITEMS
      : GALLERY_ITEMS.filter(function(it) { return it.category === activeCategory; });

    if (searchQuery.trim() !== '') {
      var query = searchQuery.toLowerCase().trim();
      items = items.filter(function(it) {
        var title   = loc(it.title).toLowerCase();
        var alt     = loc(it.alt).toLowerCase();
        var catText = catLabel(it.category).toLowerCase();
        return title.indexOf(query) !== -1 ||
               alt.indexOf(query) !== -1 ||
               catText.indexOf(query) !== -1 ||
               (it.category || '').replace('-', ' ').indexOf(query) !== -1;
      });
    }

    filteredItems = items;

    grid.querySelectorAll('.gallery-item').forEach(function(el) { imgObserver.unobserve(el); });
    grid.innerHTML = '';

    if (filteredItems.length === 0) {
      grid.innerHTML = '<p class="gallery-empty">' + t('galleryEmpty') + '</p>';
      statusEl.textContent = '0 ' + (window.i18n && window.i18n.t('galleryImagePlural') || 'images');
      return;
    }

    filteredItems.forEach(function(item, idx) {
      var localizedTitle = loc(item.title);
      var article = document.createElement('article');
      article.className = 'gallery-item';
      article.setAttribute('role', 'button');
      article.setAttribute('tabindex', '0');
      article.setAttribute('aria-label', fmt(t('galleryOpenItem'), { title: localizedTitle }));
      article.dataset.index = idx;

      var placeholder = document.createElement('div');
      placeholder.className = 'gallery-item-placeholder';
      placeholder.setAttribute('aria-hidden', 'true');
      placeholder.innerHTML = '<div class="gallery-item-spinner"></div>';

      var img = document.createElement('img');
      /* Set src eagerly (not data-src + observer-assigned). The
         previous version left img.src empty until IntersectionObserver
         fired, and any observer failure showed broken alt text in
         every gallery slot. With src assigned at creation the browser
         loads the image immediately — observer below only handles the
         fade-in animation, not the network request. */
      img.src = safeUrl(item.src);
      img.alt = loc(item.alt);
      img.setAttribute('decoding', 'async');
      img.loading = 'lazy';
      /* No explicit width/height — CSS .gallery-item aspect-ratio reserves the
         box. Fixed attrs would mis-reserve for non-4:3 images (galaxies/moon/
         star clusters vary in shape) and the browser can't update the box once
         the image arrives. */
      /* If the WebP source fails (browser rejects WebP, CDN MIME glitch,
         broken intermediary), fall back to the .jpg sibling. Every
         gallery folder carries both extensions (m81m82.webp +
         m81m82.jpg, etc.), so this silently rescues the image without
         a deploy. `triedFallback` guards against an infinite
         error→retry loop when both files are missing. */
      var triedFallback = false;
      img.addEventListener('error', function () {
        if (triedFallback) {
          item.classList.add('img-error');
          console.warn('[gallery] image failed to load (no .jpg fallback):', img.src);
          return;
        }
        var baseSrc = item.src || '';
        /* Replace .webp extension only — preserve any query/hash so we
           match the same cache-buster the primary request used (none
           today, but future-proof). */
        var jpgSrc = baseSrc.replace(/(\.webp)(\?|#|$)/i, '.jpg$2');
        if (!jpgSrc || jpgSrc === baseSrc) {
          item.classList.add('img-error');
          return;
        }
        triedFallback = true;
        img.src = jpgSrc;
      });

      var badge = document.createElement('span');
      badge.className = 'gallery-item-badge';
      badge.textContent = catLabel(item.category);
      badge.setAttribute('aria-hidden', 'true');

      var overlay = document.createElement('div');
      overlay.className = 'gallery-item-overlay';
      overlay.setAttribute('aria-hidden', 'true');

      var actions = document.createElement('div');
      actions.className = 'gallery-item-actions';

      var viewBtn = document.createElement('button');
      viewBtn.className = 'gallery-action-btn';
      viewBtn.setAttribute('tabindex', '-1');
      viewBtn.setAttribute('title', t('galleryViewFullscreen'));
      viewBtn.setAttribute('aria-label', fmt(t('galleryOpenInLightbox'), { title: localizedTitle }));
      viewBtn.innerHTML = '&#128269;';

      var dlBtn = document.createElement('button');
      dlBtn.className = 'gallery-action-btn gallery-item-dl-btn';
      dlBtn.setAttribute('tabindex', '-1');
      dlBtn.setAttribute('title', t('galleryDownloadW'));
      dlBtn.setAttribute('aria-label', fmt(t('galleryDownloadItem'), { title: localizedTitle }));
      dlBtn.innerHTML = '&#8595;';

      actions.appendChild(viewBtn);
      actions.appendChild(dlBtn);
      overlay.appendChild(actions);
      article.appendChild(placeholder);
      article.appendChild(img);
      article.appendChild(badge);
      article.appendChild(overlay);
      grid.appendChild(article);

      article.addEventListener('click', function(e) {
        if (e.target.closest('.gallery-item-dl-btn')) {
          downloadWithWatermark(safeUrl(item.src), localizedTitle);
          return;
        }
        openLightbox(idx);
      });

      article.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(idx); }
      });

      imgObserver.observe(article);
    });

    statusEl.textContent = pluralize(filteredItems.length);
  }

  function openLightbox(idx) {
    lightboxIndex = idx;
    lightboxOpen  = true;
    lightboxEl.classList.add('active');
    lightboxEl.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    showLightboxImage(idx);
    lightboxClose.focus();
  }

  function closeLightbox() {
    lightboxOpen = false;
    lightboxEl.classList.remove('active');
    lightboxEl.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    var card = grid.querySelector('[data-index="' + lightboxIndex + '"]');
    if (card) card.focus();
  }

  function showLightboxImage(idx) {
    var item = filteredItems[idx];
    if (!item) return;
    var localizedTitle = loc(item.title);
    var counterTpl = t('lbCounterFormat');
    lightboxCounter.textContent = fmt(counterTpl, { n: String(idx + 1), total: String(filteredItems.length) });
    lightboxCaption.textContent = localizedTitle;
    populateLightboxInfo(item);
    lightboxPrev.disabled = idx === 0;
    lightboxNext.disabled = idx === filteredItems.length - 1;
    lightboxImg.classList.remove('loaded');
    lightboxSpinner.classList.add('visible');
    lightboxDl.disabled = true;
    lightboxImg.alt = loc(item.alt);
    lightboxImg.src = safeUrl(item.src);
    lightboxEl.setAttribute('aria-label', localizedTitle);

    function onReady() {
      lightboxSpinner.classList.remove('visible');
      lightboxImg.classList.add('loaded');
      lightboxDl.disabled = false;
    }
    if (lightboxImg.complete && lightboxImg.naturalWidth > 0) onReady();
    else {
      lightboxImg.addEventListener('load', onReady, { once: true });
      lightboxImg.addEventListener('error', function() {
        lightboxSpinner.classList.remove('visible');
        lightboxImg.classList.add('loaded');
      }, { once: true });
    }
  }

  function populateLightboxInfo(item) {
    if (!lightboxInfo) return;
    var anyVisible = false;
    lightboxInfo.querySelectorAll('.info-row').forEach(function(row) {
      var valEl = row.querySelector('[data-info-key]');
      if (!valEl) return;
      var key = valEl.getAttribute('data-info-key');
      /* `notes` and `target` are localized per renderTabs() pattern;
         other keys (date, equipment, exposure_total) stay English. */
      var raw = (key === 'notes' || key === 'target') ? loc(item[key]) : item[key];
      var val = (item && raw != null) ? String(raw).trim() : '';
      if (val) {
        valEl.textContent = val;
        row.style.display = '';
        anyVisible = true;
      } else {
        row.style.display = 'none';
      }
    });
    lightboxInfo.hidden = !anyVisible;
  }

  function navigate(dir) {
    var next = lightboxIndex + dir;
    if (next < 0 || next >= filteredItems.length) return;
    lightboxIndex = next;
    showLightboxImage(next);
  }

  lightboxClose.addEventListener('click', closeLightbox);
  lightboxPrev.addEventListener('click',  function() { navigate(-1); });
  lightboxNext.addEventListener('click',  function() { navigate(1);  });
  lightboxEl.addEventListener('click', function(e) { if (e.target === lightboxEl) closeLightbox(); });
  lightboxDl.addEventListener('click', function() {
    var item = filteredItems[lightboxIndex];
    if (item) downloadWithWatermark(safeUrl(item.src), loc(item.title));
  });

  document.addEventListener('keydown', function(e) {
    if (!lightboxOpen) return;
    if (e.key === 'Escape')      closeLightbox();
    if (e.key === 'ArrowLeft')   navigate(-1);
    if (e.key === 'ArrowRight')  navigate(1);
  });

  var touchStartX = 0;
  lightboxEl.addEventListener('touchstart', function(e) { touchStartX = e.touches[0].clientX; }, { passive: true });
  lightboxEl.addEventListener('touchend',   function(e) {
    var dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) navigate(dx < 0 ? 1 : -1);
  }, { passive: true });

  /* ── Download with watermark ─────────────────────────────────────── */
  function downloadWithWatermark(src, title) {
    lightboxDl.disabled = true;
    lightboxDl.innerHTML = '&#8987; ' + t('lbDownloading');

    var offscreen = new Image();
    offscreen.crossOrigin = 'anonymous';

    offscreen.onload = function() {
      try {
        var ctx = canvas.getContext('2d');
        canvas.width  = offscreen.naturalWidth;
        canvas.height = offscreen.naturalHeight;
        ctx.drawImage(offscreen, 0, 0);

        var w = canvas.width;
        var h = canvas.height;
        var text     = 'HRALMEIDA';
        var fontSize = Math.max(16, Math.floor(Math.min(w, h) * 0.03));

        ctx.save();
        ctx.font         = 'bold ' + fontSize + 'px "Lilex", monospace';
        ctx.fillStyle    = 'rgba(255, 255, 255, 0.4)';
        ctx.textAlign    = 'right';
        ctx.textBaseline = 'bottom';
        var margin = Math.max(12, Math.floor(Math.min(w, h) * 0.02));
        ctx.fillText(text, w - margin, h - margin);
        ctx.restore();

        canvas.toBlob(function(blob) {
          if (!blob) { resetBtn(); return; }
          var url  = URL.createObjectURL(blob);
          var link = document.createElement('a');
          var slug = title.replace(/[^a-z0-9]/gi, '-').toLowerCase().replace(/-+/g, '-');
          link.href     = url;
          link.download = 'hralmeida-' + slug + '.jpg';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(function() { URL.revokeObjectURL(url); }, 15000);
          resetBtn();
        }, 'image/jpeg', 0.88);
      } catch(err) {
        console.error('Watermark error:', err);
        alert(t('lbDownloadFailed'));
        resetBtn();
      }
    };

    offscreen.onerror = function() {
      alert(t('lbLoadError'));
      resetBtn();
    };

    offscreen.src = src + (src.indexOf('?') === -1 ? '?' : '&') + '_t=' + Date.now();

    function resetBtn() {
      lightboxDl.disabled = false;
      /* Rebuild the button so any language-switch during the download
         is reflected: write a fresh, current-lang label rather than
         restoring the saved markup (which contained a static English
         fallback). */
      lightboxDl.innerHTML = '&#8595; <span data-i18n="lbDownload">' + t('lbDownload') + '</span>';
      if (window.i18n) window.i18n.applyStaticTranslations();
    }
  }

  /* ── Disclaimer ──────────────────────────────────────────────────── */
  var disclaimerEl = document.getElementById('gallery-disclaimer');
  var dismissBtn = document.getElementById('dismiss-disclaimer');
  if (disclaimerEl && safeGet('gallery_disclaimer_seen') !== 'true') {
    disclaimerEl.style.display = 'flex';
  }
  if (dismissBtn && disclaimerEl) {
    dismissBtn.addEventListener('click', function() {
      safeSet('gallery_disclaimer_seen', 'true');
      disclaimerEl.style.display = 'none';
    });
  }

  /* ── Boot: load index, render, listen for language change ────────── */
  function loadGalleryIndex() {
    if (!grid) return;
    grid.innerHTML = '<p class="gallery-status">' + t('galleryLoading') + '</p>';

    return fetch('gallery/index.json?t=' + Date.now())
      .then(function(res) {
        if (!res.ok) throw new Error('Could not load gallery/index.json');
        return res.json();
      })
      .then(function(data) {
        var rawItems = Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : []);
        GALLERY_ITEMS = rawItems;
        var seen = {};
        var categorySlugs = [];
        rawItems.forEach(function(it) {
          if (!it.category || seen[it.category]) return;
          seen[it.category] = true;
          categorySlugs.push(it.category);
        });
        categories = categorySlugs.map(function(slug) { return { slug: slug, label: catLabel(slug) }; });

        renderTabs();
        renderGrid();
      })
      .catch(function(err) {
        console.error('Error loading gallery index:', err);
        grid.innerHTML = '<p class="gallery-empty">' + t('galleryErrorLoading') + '</p>';
        statusEl.textContent = '';
      });
  }

  function refreshAll() {
    /* Categories may have new localized labels — re-render tabs and grid. */
    if (!GALLERY_ITEMS.length) return;
    categories = categories.map(function(c) { return { slug: c.slug, label: catLabel(c.slug) }; });
    renderTabs();
    renderGrid();
    if (lightboxOpen) showLightboxImage(lightboxIndex);
  }

  /* Re-render whenever language changes (from i18n.js event). */
  window.addEventListener('languageChange', refreshAll);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadGalleryIndex);
  } else {
    loadGalleryIndex();
  }
})();
