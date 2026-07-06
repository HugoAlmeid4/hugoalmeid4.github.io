// counter.js — Shared visit counter, used by every page that wants to count
// toward the site-wide total. Loaded with `<script src="counter.js?v=1" defer>`
// so it runs after the DOM parses.
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
// Backend: api.counterapi.dev (free, no signup, wildcard CORS).
// Endpoint: v1/hralmeida-website/visits — increment via GET /up; on failure
// fall back to a read-only GET so the page never hangs on "…".
//
// Known caveat: certain ad-blockers block api.counterapi.dev. When that
// happens the meta text becomes "blocked" (more diagnostic than "offline")
// so the user has a real hint about why the count isn't showing.
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

  var endpoint = 'https://api.counterapi.dev/v1/hralmeida-website/visits';
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
  //     total. Reloading between Home → Gallery → CV no longer pile-up
  //     self-inflicted hits.
  //   - first-time path: try /up, mark counted on success. On failure
  //     fall back to a read-only GET so we display *something* instead of
  //     an eternal "…". The fallback path does NOT mark counted — a
  //     successful read is not the same as a registered visit.
  if (alreadyCounted) {
    fetchJSON(endpoint, SIX_S)
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
    fetchJSON(endpoint + '/up', SIX_S)
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
        fetchJSON(endpoint, FOUR_S)
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
