/* ────────────────────────────────────────────────────────────────────────
   now.js — "Now" page renderer
   ────────────────────────────────────────────────────────────────────────
   Reads data/now.json, renders the now-section in the requested language.
   Item text supports inline <em>/<a> (e.g. book titles in the reading
   list), so we use escAllowInline — a tiny escaper that skips <em>/<a>
   tags but escapes everything else (so the Google Translate cache key
   works per text without breaking the markup).
   ──────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escAllowInline(s) {
    var raw = String(s == null ? '' : s);
    var parts = raw.split(/(<\/?(?:em|a)>)/g);
    for (var i = 0; i < parts.length; i++) {
      if (!/^<\/?(?:em|a)>$/.test(parts[i])) parts[i] = esc(parts[i]);
    }
    return parts.join('');
  }

  function pick(v, lang) {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'object') {
      if (typeof v[lang] === 'string' && v[lang]) return v[lang];
      if (typeof v.en === 'string') return v.en;
    }
    return String(v);
  }

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

  function formatLastUpdated(yyyymm) {
    if (!yyyymm || typeof yyyymm !== 'string') return yyyymm || '';
    var m = yyyymm.match(/^(\d{4})-(\d{2})$/);
    if (!m) return yyyymm;
    var year = parseInt(m[1], 10);
    var month = parseInt(m[2], 10) - 1;
    if (month < 0 || month > 11) return yyyymm;
    return MONTHS[month] + ' ' + year;
  }

  /* Block ↔ i18n header key. New sections: just add a key to this map and
     to sharedTranslations in i18n.js — no now.js change required. */
  var BLOCK_KEYS = {
    Learning: 'nowHeaderLearning',
    Working: 'nowHeaderWorkingOn',
    'Imaging targets': 'nowHeaderImagingTargets',
    Reading: 'nowHeaderReading',
    'Outside this site': 'nowHeaderOutside'
  };

  function t(key) {
    return (window.i18n && typeof key === 'string') ? window.i18n.t(key) : key;
  }

  function headerForBlock(englishTitle, lang) {
    var key = BLOCK_KEYS[englishTitle];
    if (key) return t(key);
    /* Fall back to the data-driven title if it's already a {en,pt,es}
       object — keeps the dataset single-source-of-truth. */
    var objTitle;
    return englishTitle;
  }

  function renderBlock(block) {
    var lang = (window.i18n && window.i18n.lang) || 'en';
    /* If the block comes pre-localized (data/now.json has en/pt/es titles),
       honor that translation. Otherwise use the i18n header map keyed off
       the English title so we get a single, centralised match. */
    var rawTitle = pick(block.title, lang);
    var mapKey = (typeof block.title === 'object' && block.title.en) ? block.title.en : rawTitle;
    var mappedKey = BLOCK_KEYS[mapKey];
    var i18nTitle = mappedKey ? t(mappedKey) : rawTitle;
    var title = escAllowInline(i18nTitle);
    var intro = block.intro ? '<p>' + escAllowInline(pick(block.intro, lang)) + '</p>' : '';
    var body = '';
    if (Array.isArray(block.items) && block.items.length > 0) {
      body = '<ul>' + block.items.map(function (it) {
        return '<li>' + escAllowInline(it) + '</li>';
      }).join('') + '</ul>';
    } else if (block.text) {
      body = '<p>' + escAllowInline(pick(block.text, lang)) + '</p>';
    }
    return '<div class="now-block"><h2>' + title + '</h2>' + intro + body + '</div>';
  }

  function renderNow(data) {
    var section = document.getElementById('now-section');
    if (!section) return;
    var lastUpdated = formatLastUpdated(data.last_updated || '');
    var updatedHTML = lastUpdated ? '<time datetime="' + esc((data.last_updated || '').slice(0, 7)) + '">' + esc(lastUpdated) + '</time>' : '';
    var blocks = Array.isArray(data.blocks) ? data.blocks : [];
    var blocksHTML = blocks.map(renderBlock).join('');
    section.innerHTML = '<h1>' + esc(t('nowPageTitle')) + '</h1>'
      + '<p class="now-disclaimer">' + esc(t('nowLastUpdated')) + ' ' + updatedHTML
      + ' · ' + esc(t('nowInspiredBy')) + ' <a href="https://nownownow.com/about" target="_blank" rel="noopener">nownownow.com</a></p>'
      + blocksHTML;
  }

  var raw_data = null;

  async function loadNow() {
    try {
      var res = await fetch('data/now.json?t=' + Date.now());
      if (!res.ok) throw new Error('HTTP ' + res.status);
      raw_data = await res.json();
      renderNow(raw_data);
    } catch (err) {
      console.warn('Now JSON load failed; static fallback in HTML remains:', err.message);
    }
  }

  window.addEventListener('languageChange', function () {
    if (!raw_data) return;
    renderNow(raw_data);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadNow);
  } else {
    loadNow();
  }
})();
