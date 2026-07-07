/* ────────────────────────────────────────────────────────────────────────
   bio.js — Bio / Socials / Skills renderer
   ────────────────────────────────────────────────────────────────────────
   Reads `data/bio.json`, populates the #bio-section, #socials-section,
   and #skills-section. Listens for the window "languageChange" event from
   i18n.js and re-renders in the new language.

   Why this file was empty before: bio/socials/skills were hard-coded into
   index.html so the page was usable with no JS. We now read the same JSON
   the rest of the site uses (one source of truth), so the dashboard can
   edit bio without redeploying index.html. The static HTML in index.html
   remains as the FOUC fallback that paints before this script runs.
   ──────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function pickString(v, lang) {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'object') {
      if (typeof v[lang] === 'string' && v[lang]) return v[lang];
      if (typeof v.en === 'string') return v.en;
    }
    return String(v);
  }

  function pickLang(data, lang) {
    lang = lang || (window.i18n && window.i18n.lang) || 'en';
    if (!data) return data;
    if (typeof data === 'string' || data == null) return data;
    if (Array.isArray(data)) {
      /* For arrays of objects (socials, skills_groups), pick per-field using
         localize. For arrays of strings (skill items), keep as-is. */
      return data;
    }
    var out = {};
    for (var k in data) {
      if (!Object.prototype.hasOwnProperty.call(data, k)) continue;
      out[k] = pickString(data[k], lang);
    }
    return out;
  }

  function renderBio(data, lang) {
    var section = document.getElementById('bio-section');
    if (!section) return;
    section.innerHTML = '<h2>Bio</h2><p>' + esc(pickString(data.bio, lang)) + '</p>';
  }

  function renderSocials(data, lang) {
    var section = document.getElementById('socials-section');
    if (!section) return;
    var socials = Array.isArray(data.socials) ? data.socials : [];
    if (socials.length === 0) {
      section.innerHTML = '<h2>Socials</h2><span class="social-links"></span>';
      return;
    }
    var html = '<h2>Socials</h2><span class="social-links">';
    for (var i = 0; i < socials.length; i++) {
      var s = socials[i];
      var label = esc(pickString(s.label, lang));
      var url = esc(s.url || '#');
      var openExternal = /^https?:\/\//.test(s.url || '');
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
    var html = '<h2>Skills &amp; Tools</h2>';
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
      var res = await fetch('data/bio.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      raw_data = await res.json();
      var lang = (window.i18n && window.i18n.lang) || 'en';
      renderAll(lang);
    } catch (err) {
      console.warn('bio.json load failed; static fallback in HTML remains:', err.message);
    }
  }

  /* Listen for either DOMContentLoaded events or the i18n.js languageChange
     event. The first event after load re-renders the section. */
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
