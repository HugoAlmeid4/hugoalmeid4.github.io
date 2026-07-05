// ─── now.js ─────────────────────────────────────────────────────────────────
// Fetches data/now.json and renders the Now page blocks.
// Static HTML in now.html acts as a fallback if the JSON fails to load.
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // "items" entries are simple strings but allow plain `<em>...</em>` and
  // `<a>...</a>` tags (no attributes) so the author can write the same
  // markup that's in the original Now page. We deny attributes so a stray
  // `<a href="javascript:...">` can't slip through.
  function escAllowInline(s) {
    var raw = String(s == null ? '' : s);
    var parts = raw.split(/(<\/?(?:em|a)>)/g);
    for (var i = 0; i < parts.length; i++) {
      if (!/^<\/?(?:em|a)>$/.test(parts[i])) parts[i] = esc(parts[i]);
    }
    return parts.join('');
  }

  function formatLastUpdated(yyyymm) {
    if (!yyyymm || typeof yyyymm !== 'string') return yyyymm || '';
    var m = yyyymm.match(/^(\d{4})-(\d{2})$/);
    if (!m) return yyyymm;
    var year = parseInt(m[1], 10);
    var month = parseInt(m[2], 10) - 1;
    var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    if (month < 0 || month > 11) return yyyymm;
    return months[month] + ' ' + year;
  }

  function renderBlock(block) {
    var title = esc(block.title || '');
    var intro = block.intro ? '<p>' + esc(block.intro) + '</p>' : '';
    var body = '';

    if (Array.isArray(block.items) && block.items.length > 0) {
      body = '<ul>' + block.items.map(function (it) {
        return '<li>' + escAllowInline(it) + '</li>';
      }).join('') + '</ul>';
    } else if (block.text) {
      // Use single paragraph instead of bullet list.
      // If `text` is set, ignore any stray `items` to keep the layout predictable.
      body = '<p>' + escAllowInline(block.text) + '</p>';
    }

    return (
      '<div class="now-block">' +
        '<h2>' + title + '</h2>' +
        intro + body +
      '</div>'
    );
  }

  function renderNow(data) {
    var section = document.getElementById('now-section');
    if (!section) return;

    var lastUpdated = formatLastUpdated(data.last_updated || '');
    var updatedHTML = lastUpdated
      ? '<time datetime="' + esc((data.last_updated || '').slice(0, 7)) + '">' + esc(lastUpdated) + '</time>'
      : '';

    var blocks = Array.isArray(data.blocks) ? data.blocks : [];
    var blocksHTML = blocks.map(renderBlock).join('');

    section.innerHTML =
      '<h1>Now</h1>' +
      '<p class="now-disclaimer">' +
        'Last updated: ' + updatedHTML +
        ' · inspired by <a href="https://nownownow.com/about" target="_blank" rel="noopener">nownownow.com</a>' +
      '</p>' +
      blocksHTML;
  }

  async function loadNow() {
    try {
      var res = await fetch('data/now.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      renderNow(data);
    } catch (err) {
      console.warn('Now JSON load failed; using fallback:', err.message);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadNow);
  } else {
    loadNow();
  }
})();
