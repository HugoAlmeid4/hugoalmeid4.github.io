// counter.js — Shared visit counter, used by every page that wants to count
// toward the site-wide total. Loaded with `<script src="/counter.js?v=1" defer>`
// so it runs after the DOM parses. Use leading-slash so any page resolves
// to /counter.js?v=1 regardless of subdirectory.
//
// Each page that wants the visible counter places the following markup
// anywhere in <body>:
//   <div id="visit-counter" class="visit-counter ..." aria-live="polite">
//     <span class="visit-counter-label">Site visits:</span>
//     <span class="visit-counter-value loading" id="visit-counter-value">…</span>
//     <span class="visit-counter-meta" id="visit-counter-meta"></span>
//   </div>
// The script is forgiving — if those IDs are absent it still increments the
// API (counts the visit) but skips the DOM update, so plain "tracking only"
// pages can include just the <script> tag without any markup.
//
// Backend: api.counterapi.dev (free, no signup).
// Endpoint split rationale: counterapi.dev's `GET /v1/{ns}/{key}` returns a
// 301 redirect to `/v1/{ns}/{key}/`. The 301 itself DOES NOT carry the
// Access-Control-Allow-Origin header — only the final 200 does. Curl
// doesn't enforce CORS so previous curl tests passed, but browsers abort
// the entire redirect chain when an interim response lacks ACAO, surfacing
// as "CORS blocked — status 301". Workaround: hit the trailing-slash URL
// directly so there is no redirect in the chain. /up is unaffected because
// it never redirects (single-shot 200 with ACAO).
(function () {
  var root = document.getElementById('visit-counter');
  var valueEl = document.getElementById('visit-counter-value');
  var metaEl = document.getElementById('visit-counter-meta');

  // Persist the first-render date so "since {month year}" stays stable
  // across visits instead of resetting each time the card re-renders.
  var FIRST_SEEN_KEY = 'visitCounter.firstSeen';
  var firstSeen;
  try {
    firstSeen = localStorage.getItem(FIRST_SEEN_KEY);
    if (!firstSeen) {
      firstSeen = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      localStorage.setItem(FIRST_SEEN_KEY, firstSeen);
    }
  } catch (e) {
    firstSeen = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }

  // One-count-per-browser-session dedupe. Crucially: this is *read* now and
  // *written* only after a successful increment (see markCounted below).
  // If the /up request fails we deliberately do NOT burn the dedupe slot —
  // the user's next reload gets to actually attempt the increment.
  var COUNTED_KEY = 'visitCounter.countedThisSession';
  var alreadyCounted = false;
  try {
    alreadyCounted = !!sessionStorage.getItem(COUNTED_KEY);
  } catch (e) { /* private mode — every hit counts, that's fine */ }

  function render(value, metaOverride) {
    if (valueEl) {
      valueEl.classList.remove('loading');
      valueEl.textContent = String(value);
    }
    if (metaEl && metaOverride) metaEl.textContent = metaOverride;
  }

  function renderDefault(value) {
    render(value, 'since ' + firstSeen);
  }

  function showError(reason) {
    if (root) root.classList.add('visit-counter-error');
    render('—', reason);
  }

  // Bot filter: skip incrementing for headless or known-crawler UAs. Insures
  // Lighthouse runs, link previews, search-engine scrapers, etc. don't
  // pollute the count.
  var ua = (navigator.userAgent || '').toLowerCase();
  var looksLikeBot =
    navigator.webdriver === true ||
    /bot|crawler|spider|headless|lighthouse|gtmetrix|pagespeed/i.test(ua);
  if (looksLikeBot) {
    render('—', 'not counted');
    return;
  }

  // Two distinct URLs to avoid the 301 chain:
  //   - readUrl: hits /v1/.../visits/ (trailing slash, no redirect)
  //   - upUrl:   increment action, /v1/.../visits/up (no redirect)
  var base = 'https://api.counterapi.dev/v1/hralmeida-website/visits';
  var readUrl = base + '/';
  var upUrl = base + '/up';
  var SIX_S = 6000;
  var FOUR_S = 4000;

  function fetchJSON(url, ms) {
    var c = new AbortController();
    var t = setTimeout(function () { c.abort(); }, ms);
    return fetch(url, { signal: c.signal })
      .then(function (r) {
        clearTimeout(t);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .catch(function (err) {
        clearTimeout(t);
        throw err;
      });
  }

  // Map common fetch failure modes to short, human-readable reasons shown
  // in the meta line. TypeError covers Chrome's "Load failed" (macOS),
  // Safari's "CORS error" mid-promise, and generic blocking; explicit
  // message checks catch Firefox's "NetworkError when fetching resource"
  // and the standard "Failed to fetch".
  function describeError(err) {
    if (err && err.name === 'AbortError') return 'timed out';
    if (err instanceof TypeError) return 'blocked';
    var msg = (err && err.message) || '';
    if (
      msg.indexOf('Failed to fetch') !== -1 ||
      msg.indexOf('NetworkError') !== -1 ||
      msg.indexOf('CORS') !== -1 ||
      msg.indexOf('Load failed') !== -1
    ) {
      return 'blocked';
    }
    return 'counter offline';
  }

  function markCounted() {
    try { sessionStorage.setItem(COUNTED_KEY, '1'); } catch (e) { /* private mode */ }
  }

  // Two paths, branched on whether we've already counted this session:
  //   - already-counted path: skip /up entirely, just read the current
  //     total via readUrl (no redirect). Reloading between Home → Gallery
  //     → CV no longer pile-up self-inflicted hits.
  //   - first-time path: try upUrl. Mark counted on success. On failure
  //     fall back to a readUrl GET so we display *something* instead of
  //     an eternal "…". The fallback does NOT mark counted — a successful
  //     read is not the same as a registered visit.
  if (alreadyCounted) {
    fetchJSON(readUrl, SIX_S)
      .then(function (data) {
        if (data && typeof data.count === 'number') {
          render(data.count, 'read-only');
        } else {
          showError('no data');
        }
      })
      .catch(function (err) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[visit-counter] read failed:', err);
        }
        showError(describeError(err));
      });
  } else {
    fetchJSON(upUrl, SIX_S)
      .then(function (data) {
        if (data && typeof data.count === 'number') {
          markCounted();
          renderDefault(data.count);
        } else {
          showError('no data');
        }
      })
      .catch(function (err) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[visit-counter] increment failed:', err);
        }
        fetchJSON(readUrl, FOUR_S)
          .then(function (data) {
            if (data && typeof data.count === 'number') {
              render(data.count, 'read-only');
            } else {
              showError('no data');
            }
          })
          .catch(function (err2) {
            showError(describeError(err2));
          });
      });
  }
})();
