/* ────────────────────────────────────────────────────────────────────────
   bio.js — Bio / Socials / Skills renderer
   ────────────────────────────────────────────────────────────────────────
   Reads `data/bio.json`, populates the #bio-section, #socials-section,
   and #skills-section. Listens for the window "languageChange" event from
   i18n.js and re-renders in the new language.

   Section headers come from i18n.t() (homeSectionBio / homeSectionSocials
   / homeSectionSkills) so they swap with the rest of the UI on language
   change. Skill group categories may be a plain string (treated as
   English) or a {en, pt, es} object — both are handled via localize().
   ──────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* INVARIANT: this script runs AFTER i18n.js via <script defer> ordering.
     Do not reorder scripts — window.i18n.safeUrl may not be live yet. */
  var safeUrl = function (u) { return window.i18n.safeUrl(u); };

  /* Mirrors i18n.localize() but kept as a local helper so bio.js can
     render before window.i18n is ready (during initial script boot).
     Drills down through any wrapped { en, pt, es, hi } layers to the
     first leaf string — guards against the recursion-corruption bug. */
  function pickString(v, lang) {
    var l = lang || (window.i18n && window.i18n.lang) || 'en';
    if (v == null) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'object' && !Array.isArray(v)) {
      var supported = (window.i18n && window.i18n.supportedLangs) || ['en','pt','es','hi'];
      while (v && typeof v === 'object' && !Array.isArray(v)) {
        var ks = Object.keys(v);
        var allLangs = ks.length > 0 && ks.every(function (k) {
          return supported.indexOf(k) >= 0;
        });
        if (!allLangs) break;
        if (typeof v[l] === 'string' && v[l]) return v[l];
        if (l !== 'en' && typeof v.en === 'string' && v.en) return v.en;
        if (v.en != null) { v = v.en; } else if (v.pt != null) { v = v.pt; } else { v = v.es; }
        if (typeof v === 'string') return v;
      }
    }
    return '';
  }

  function renderBio(data, lang) {
    var section = document.getElementById('bio-section');
    if (!section) return;
    var h = esc(window.i18n ? window.i18n.t('homeSectionBio') : 'Bio');
    section.innerHTML = '<h2>' + h + '</h2><p>' + esc(pickString(data.bio, lang)) + '</p>';
  }

  function renderSocials(data, lang) {
    var section = document.getElementById('socials-section');
    if (!section) return;
    var socials = Array.isArray(data.socials) ? data.socials : [];
    var h = esc(window.i18n ? window.i18n.t('homeSectionSocials') : 'Socials');
    if (socials.length === 0) {
      section.innerHTML = '<h2>' + h + '</h2><span class="social-links"></span>';
      return;
    }
    var html = '<h2>' + h + '</h2><span class="social-links">';
    for (var i = 0; i < socials.length; i++) {
      var s = socials[i];
      var label = esc(pickString(s.label, lang));
      var url  = safeUrl(s.url);
      var openExternal = /^https?:\/\//.test(url);
      var icon = s.icon ? '<span class="social-icon">' + esc(s.icon) + '</span>' : '';
      if (i > 0) html += '<span class="social-separator" aria-hidden="true">-</span>';
      html += '<a href="' + url + '"' + (openExternal ? ' target="_blank" rel="noopener"' : '') + '>' + icon + label + '</a>';
    }
    html += '</span>';
    section.innerHTML = html;
  }

  function renderSkills(data, lang) {
    var section = document.getElementById('skills-section');
    if (!section) return;
    var groups = Array.isArray(data.skills_groups) ? data.skills_groups : [];
    var h = esc(window.i18n ? window.i18n.t('homeSectionSkills') : 'Skills & Tools');
    var html = '<h2>' + h + '</h2>';
    for (var g = 0; g < groups.length; g++) {
      var group = groups[g];
      var category = esc(pickString(group.category, lang));
      var items = Array.isArray(group.items) ? group.items : [];
      var chips = '';
      for (var i = 0; i < items.length; i++) {
        chips += '<span class="skill-chip">' + esc(items[i]) + '</span>';
      }
      html += '<div class="skill-group"><h3>' + category + '</h3><div class="skill-chips">' + chips + '</div></div>';
    }
    section.innerHTML = html;
  }

  var raw_data = null;
  function renderAll(lang) {
    if (!raw_data) return;
    renderBio(raw_data, lang);
    renderSocials(raw_data, lang);
    renderSkills(raw_data, lang);
  }

  async function loadBio() {
    try {
      var res = await fetch('data/bio.json?t=' + Date.now());
      if (!res.ok) throw new Error('HTTP ' + res.status);
      raw_data = await res.json();
      var lang = window.i18n ? window.i18n.lang : 'en';
      renderAll(lang);
    } catch (err) {
      console.warn('bio.json load failed; static fallback in HTML remains:', err.message);
    }
  }

  window.addEventListener('languageChange', function (e) {
    if (!raw_data) return;
    var lang = (e && e.detail && e.detail.lang) || (window.i18n && window.i18n.lang) || 'en';
    renderAll(lang);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadBio);
  } else {
    loadBio();
  }
})();
