/* ────────────────────────────────────────────────────────────────────────
   cv.js — Curriculum vitae renderer
   ────────────────────────────────────────────────────────────────────────
   Reads data/cv.json + certificate names, populates the CV section.
   Supports [en/pt/es] values per field (added by scripts/translate-content.mjs).
   Re-renders on every languageChange event from i18n.js so the whole CV
   swaps with no full-page reload.
   ──────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escAttr(s) {
    return String(s == null ? '' : s).replace(/"/g, '&quot;');
  }

  /* Pick the right string for the requested language. Falls back to en,
     then to whatever string-like value is there. */
  function pick(v, lang) {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'object') {
      if (typeof v[lang] === 'string' && v[lang]) return v[lang];
      if (typeof v.en === 'string') return v.en;
    }
    return String(v);
  }

  function renderHeader(data) {
    var lang = (window.i18n && window.i18n.lang) || 'en';
    return ''
      + '<header class="cv-header">'
      + '<h1>Hralmeida</h1>'
      + '<p class="cv-tagline">' + esc(pick(data.tagline, lang)) + '</p>'
      + '<p class="cv-bio">' + esc(pick(data.bio, lang)) + '</p>'
      + '<p class="cv-contact">' + ((data.contact || []).map(function (c, i) {
          var link = '<a href="' + escAttr(c.url || '#') + '" target="_blank" rel="noopener">' + esc(pick(c.label, lang) || c.label || '') + '</a>';
          return (i > 0 ? ' · ' : '') + link;
        }).join('')) + '</p>'
      + '<p class="cv-download">'
      + '<button type="button" class="cv-download-link" onclick="window.print()">⎙ Print / Save as PDF</button>'
      + '<span class="cv-print-hint">· opens your browser\'s print dialog</span>'
      + '</p>'
      + '</header>';
  }

  function renderSkills(data) {
    var lang = (window.i18n && window.i18n.lang) || 'en';
    if (!Array.isArray(data.skills) || data.skills.length === 0) return '';
    var inner = data.skills.map(function (s) {
      return '<p><strong>' + esc(pick(s.category, lang)) + ':</strong> ' + esc(pick(s.description, lang)) + '</p>';
    }).join('');
    return '<section class="cv-block"><h2>Skills &amp; Tools</h2>' + inner + '</section>';
  }

  function renderSelectedPosts(data) {
    var lang = (window.i18n && window.i18n.lang) || 'en';
    if (!Array.isArray(data.selected_posts) || data.selected_posts.length === 0) return '';
    var inner = data.selected_posts.map(function (p) {
      return '<li><a href="' + escAttr(p.url || '#') + '" target="_blank" rel="noopener">' + esc(pick(p.title, lang)) + '</a></li>';
    }).join('');
    return '<section class="cv-block"><h2>Selected posts</h2><ul>' + inner + '</ul>'
      + '<p class="cv-placeholder">More on the <a href="index.html#posts">home page</a>.</p>'
      + '</section>';
  }

  function renderCertifications(certNames) {
    if (!Array.isArray(certNames) || certNames.length === 0) {
      return '<section class="cv-block"><h2>Certificates</h2>'
        + '<p>Full list at <a href="certificates.html" target="_blank" rel="noopener">/certificates</a>.</p>'
        + '</section>';
    }
    var inner = certNames.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('');
    return '<section class="cv-block"><h2>Certificates</h2><ul>' + inner + '</ul>'
      + '<p>Full list at <a href="certificates.html" target="_blank" rel="noopener">/certificates</a>.</p>'
      + '</section>';
  }

  function renderProjects(data) {
    var lang = (window.i18n && window.i18n.lang) || 'en';
    if (!Array.isArray(data.projects) || data.projects.length === 0) return '';
    var intro = data.projects_intro ? '<p class="cv-placeholder">' + esc(pick(data.projects_intro, lang)) + '</p>' : '';
    var inner = data.projects.map(function (p) {
      var desc = esc(pick(p.description, lang));
      if (p.url) desc += ' <a href="' + escAttr(p.url) + '" target="_blank" rel="noopener">check it out.</a>';
      return '<li>' + desc + '</li>';
    }).join('');
    return '<section class="cv-block"><h2>Projects</h2>' + intro + '<ul>' + inner + '</ul></section>';
  }

  function renderInterests(data) {
    var lang = (window.i18n && window.i18n.lang) || 'en';
    if (!data.interests) return '';
    return '<section class="cv-block"><h2>Interests</h2><p>' + esc(pick(data.interests, lang)) + '</p></section>';
  }

  function renderCV(data, certNames) {
    var section = document.getElementById('cv-section');
    if (!section) return;
    section.innerHTML =
      renderHeader(data) +
      renderSkills(data) +
      renderSelectedPosts(data) +
      renderCertifications(certNames) +
      renderProjects(data) +
      renderInterests(data);
  }

  var raw_data = null;

  async function fetchCertificateNames() {
    try {
      var res = await fetch('certificates/index.json');
      if (!res.ok) return [];
      var files = await res.json();
      var results = await Promise.all(files.map(async function (file) {
        try {
          var r = await fetch('certificates/' + file);
          if (!r.ok) return null;
          var md = await r.text();
          var m = md.match(/^---\r?\n([\s\S]+?)\r?\n---[ \t]*\r?\n?/);
          if (!m) return null;
          var nameLine = m[1].split(/\r?\n/).find(function (l) { return /^name\s*:/.test(l); });
          if (!nameLine) return null;
          return nameLine.replace(/^name\s*:\s*/, '').trim().replace(/^['"]|['"]$/g, '');
        } catch (e) { return null; }
      }));
      return results.filter(Boolean);
    } catch (e) { return []; }
  }

  var certs_cache = null;

  async function loadCV() {
    try {
      var res = await fetch('data/cv.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      raw_data = await res.json();
      certs_cache = await fetchCertificateNames();
      var lang = (window.i18n && window.i18n.lang) || 'en';
      renderCV(raw_data, certs_cache);
    } catch (err) {
      console.warn('CV JSON load failed; static fallback in HTML remains:', err.message);
    }
  }

  window.addEventListener('languageChange', function () {
    if (!raw_data) return;
    var lang = (window.i18n && window.i18n.lang) || 'en';
    renderCV(raw_data, certs_cache, lang);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadCV);
  } else {
    loadCV();
  }
})();
