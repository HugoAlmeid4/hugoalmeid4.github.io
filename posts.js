// ─── CONFIG ──────────────────────────────────────────────────────────────────
// Paste your Google Sheets published CSV URL here.
// How to get it:
//   1. Open your Google Sheet
//   2. File → Share → Publish to web
//   3. Select your sheet, choose "Comma-separated values (.csv)"
//   4. Click Publish, copy the URL and paste it below
//
// Expected sheet columns (row 1 = headers, case-insensitive):
//   title   | date         | excerpt               | url (optional)
//   --------|--------------|------------------------|-----------------------------
//   My post | 25/04/2025   | Short description...   | https://yourblog.com/post
//
// Supported date formats: DD/MM/YYYY  •  MM/YYYY  •  YYYY-MM-DD
// Posts are sorted newest → oldest and grouped by Month Year.
// ─────────────────────────────────────────────────────────────────────────────
const SHEETS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSwnRK7M9iCWkMhmnKBT4ceHJI_sZIA_pg3uXiijzt3kPjFKkU3kEp_OY-KQ4DXQOhaWsyLe68w4k9n/pub?output=csv";
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_KEY = "posts_cache";
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours caching layer

document.addEventListener('DOMContentLoaded', loadPosts);

async function loadPosts() {
  const list = document.getElementById('postsList');
  const status = document.getElementById('postsStatus');

  // If no URL is set, show demo posts so the layout isn't empty
  if (SHEETS_CSV_URL === "YOUR_GOOGLE_SHEETS_CSV_URL_HERE") {
    const demo = [
      {
        title: "First telescope",
        date: "25/04/2025",
        excerpt: "My journey getting into astrophotography with a simple refractor and a lot of patience under Portuguese skies.",
        url: ""
      },
      {
        title: "Jupiter opposition",
        date: "12/03/2025",
        excerpt: "Capturing Jupiter at opposition with my 150mm Newtonian — stacking 3000 frames in AutoStakkert.",
        url: ""
      },
      {
        title: "Setting up the GTi",
        date: "01/03/2025",
        excerpt: "First light with the Star Adventurer GTi and the Evostar 72ED DS-Pro. Polar alignment notes and first DSO attempt.",
        url: ""
      },
      {
        title: "Bahtinov mask print",
        date: "15/02/2025",
        excerpt: "Designed and 3D-printed a Bahtinov mask for the 72ED. Notes on the FocusForge design process.",
        url: ""
      },
      {
        title: "Saturn season recap",
        date: "20/01/2025",
        excerpt: "Best Saturn frames of the season, processing workflow in PixInsight and what I'd do differently next time.",
        url: ""
      }
    ];
    renderPosts(demo, list, status);
    setupRSSFeed(demo); // Dynamic feed setup for fallback items
    return;
  }

  // 1. Caching layer router check
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (cache && cache.timestamp && (Date.now() - cache.timestamp < CACHE_EXPIRY) && Array.isArray(cache.data)) {
      // Instant render from cache (bypasses shimmer loading skeletons completely)
      renderPosts(cache.data, list, status);
      setupRSSFeed(cache.data);

      // Silent background fetch to update cache for next session (no UI shifts)
      fetchPostsAndCache(true);
      return;
    }
  } catch (e) {
    console.warn('Cache parse error, falling back to standard fetch:', e);
  }

  // 2. Cache empty or expired: normal fetch with shimmer skeletons displayed
  fetchPostsAndCache(false);
}

async function fetchPostsAndCache(isSilent) {
  try {
    const res = await fetch(SHEETS_CSV_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const rows = parseCSV(text);

    if (rows.length < 2) {
      if (!isSilent) {
        const status = document.getElementById('postsStatus');
        if (status) status.textContent = 'No posts found in sheet.';
      }
      return;
    }

    const headers = rows[0].map(h => h.toLowerCase().trim());
    const idx = {
      title: headers.findIndex(h => h.includes('title')),
      date: headers.findIndex(h => h.includes('date')),
      excerpt: headers.findIndex(h => h.includes('excerpt') || h.includes('summary') || h.includes('desc')),
      url: headers.findIndex(h => h.includes('url') || h.includes('link')),
    };

    const posts = rows.slice(1)
      .filter(r => r.some(c => c.trim()))
      .map(r => ({
        title: idx.title >= 0 ? r[idx.title] : r[0] || '',
        date: idx.date >= 0 ? r[idx.date] : r[1] || '',
        excerpt: idx.excerpt >= 0 ? r[idx.excerpt] : r[2] || '',
        url: idx.url >= 0 ? r[idx.url] : '',
      }));

    // Cache updated data
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        data: posts
      }));
    } catch (e) {
      console.warn('Could not save posts to localStorage:', e);
    }

    // Dynamic RSS rebuild
    setupRSSFeed(posts);

    // If standard fetch (not silent background update), render to UI
    if (!isSilent) {
      const list = document.getElementById('postsList');
      const status = document.getElementById('postsStatus');
      renderPosts(posts, list, status);
    }

  } catch (e) {
    console.error('Fetch error:', e);
    if (!isSilent) {
      const status = document.getElementById('postsStatus');
      if (status) status.textContent = 'Could not load posts. Check the CSV URL.';
    }
  }
}

// ── Rendering ────────────────────────────────────────────────────────────────

function renderPosts(posts, list, status, visibleCount = 3) {
  list.innerHTML = '';

  // Sort newest first
  posts.sort((a, b) => {
    const da = parseDate(a.date), db = parseDate(b.date);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return db - da;
  });

  // Create fullscreen overlay (singleton)
  if (!document.getElementById('postFullscreenOverlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'postFullscreenOverlay';
    overlay.className = 'project-fullscreen-overlay';
    overlay.innerHTML = `
      <div class="project-fullscreen-content">
        <button class="project-fullscreen-close" id="postFullscreenClose" aria-label="Close">✕</button>
        <div class="project-fullscreen-type" id="postFullscreenDate"></div>
        <h2 class="project-fullscreen-title" id="postFullscreenTitle"></h2>
        <div class="project-fullscreen-body" id="postFullscreenBody"></div>
        <div class="project-fullscreen-link-container" id="postFullscreenLinkContainer"></div>
      </div>`;
    document.body.appendChild(overlay);

    // Close overlay handlers
    document.getElementById('postFullscreenClose').addEventListener('click', closePostOverlay);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closePostOverlay();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closePostOverlay();
    });
  }

  let currentGroup = null;
  const postsToShow = posts.slice(0, visibleCount);
  const fragment = document.createDocumentFragment();

  postsToShow.forEach(post => {
    const group = groupLabel(post.date);

    // Insert a month/year divider when the group changes
    if (group !== currentGroup) {
      currentGroup = group;
      const label = document.createElement('div');
      label.className = 'date-group-label';
      label.textContent = group;
      fragment.appendChild(label);
    }

    // Truncate excerpt for the collapsed preview
    const previewText = truncatePostText(post.excerpt, 80);
    const hasMore = post.excerpt.length > 80;

    const card = document.createElement('div');
    card.className = 'post-card';
    card.innerHTML = `
      <div class="post-header">
        <div class="post-header-left">
          <div class="post-title">
            ${esc(post.title)}
            <span class="post-date">• ${formatShort(post.date)}</span>
          </div>
          <div class="post-excerpt-preview">${esc(previewText)}${hasMore ? '<span class="ellipsis-dots">...</span>' : ''}</div>
        </div>
        <span class="post-arrow">▼</span>
      </div>
      <div class="post-body">
        <div class="post-body-inner">
          <p>${linkify(esc(truncatePostText(post.excerpt, 160)))}${post.excerpt.length > 160 ? '...' : ''}</p>
          <button class="read-full-doc-btn">Read full documentation →</button>
        </div>
      </div>`;

    card.querySelector('.post-header').addEventListener('click', () => {
      const isOpen = card.classList.contains('open');
      // Close any other open card
      document.querySelectorAll('.post-card.open').forEach(c => c.classList.remove('open'));
      if (!isOpen) {
        card.classList.add('open');
        // Wait for the expand animation, then scroll the card into view
        setTimeout(() => {
          card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
      }
    });

    // "Read full documentation" button opens fullscreen overlay
    card.querySelector('.read-full-doc-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openPostOverlay(post);
    });

    fragment.appendChild(card);
  });

  if (posts.length > visibleCount) {
    const btnContainer = document.createElement('div');
    btnContainer.className = 'show-more-container';

    const btn = document.createElement('button');
    btn.className = 'show-more-btn';
    btn.textContent = 'Show more';
    btn.addEventListener('click', () => {
      renderPosts(posts, list, status, posts.length);
    });

    btnContainer.appendChild(btn);
    fragment.appendChild(btnContainer);
  }

  if (status) {
    status.textContent = `${posts.length} post${posts.length !== 1 ? 's' : ''}`;
    status.style.textAlign = 'center';
    status.style.display = 'block'; // Ensure state labels display correctly after skeleton removal
    fragment.appendChild(status);
  }

  list.appendChild(fragment);
}

// ── Post Fullscreen Overlay Controls ─────────────────────────────────────────

function openPostOverlay(post) {
  const overlay = document.getElementById('postFullscreenOverlay');
  document.getElementById('postFullscreenDate').textContent = post.date || '';
  document.getElementById('postFullscreenTitle').textContent = post.title;
  document.getElementById('postFullscreenBody').innerHTML = `<p>${linkify(esc(post.excerpt))}</p>`;

  const linkContainer = document.getElementById('postFullscreenLinkContainer');
  if (post.url) {
    linkContainer.innerHTML = `<a class="project-fullscreen-link" href="${esc(post.url)}" target="_blank" rel="noopener">Read full post →</a>`;
  } else {
    linkContainer.innerHTML = '';
  }

  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closePostOverlay() {
  const overlay = document.getElementById('postFullscreenOverlay');
  if (!overlay) return;
  overlay.classList.remove('active');
  document.body.style.overflow = '';
}

function truncatePostText(text, maxLen) {
  if (!text || text.length <= maxLen) return text;
  const cut = text.lastIndexOf(' ', maxLen);
  return text.substring(0, cut > 0 ? cut : maxLen);
}

// ── Client-Side RSS XML Generator ───────────────────────────────────────────

function setupRSSFeed(posts) {
  try {
    let xml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>Hralmeida's Blog</title>
  <link>https://HugoAlmeid4.github.io</link>
  <description>Hralmeida's personal website, blog, and astrophotography portfolio.</description>
  <language>en-us</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  <atom:link href="https://HugoAlmeid4.github.io/rss.xml" rel="self" type="application/rss+xml" />`;

    posts.forEach(post => {
      const postUrl = post.url || 'https://HugoAlmeid4.github.io';
      const pubDate = parseDate(post.date) ? parseDate(post.date).toUTCString() : new Date().toUTCString();
      
      xml += `
  <item>
    <title>${escXML(post.title)}</title>
    <link>${escXML(postUrl)}</link>
    <description>${escXML(post.excerpt)}</description>
    <pubDate>${pubDate}</pubDate>
    <guid>${escXML(postUrl)}</guid>
  </item>`;
    });

    xml += `
</channel>
</rss>`;

    // Compile virtual URL blob
    const blob = new Blob([xml], { type: 'application/xml' });
    if (window.rssUrl) {
      URL.revokeObjectURL(window.rssUrl);
    }
    window.rssUrl = URL.createObjectURL(blob);
    
    // Register console handle
    window.downloadRSS = () => {
      const a = document.createElement('a');
      a.href = window.rssUrl;
      a.download = 'rss.xml';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      console.log('%c📥 RSS feed download successfully triggered!', 'color: #00ff00; font-weight: bold;');
    };

    // Console ASCII info log
    if (!window.rssBannerPrinted) {
      console.log(
        `%c📰 [RSS Generator Active] %cType %cwindow.downloadRSS()%c to download your feed!`,
        "color: #00ff00; font-weight: bold;",
        "color: #888;",
        "color: #ff00ff; font-family: monospace; background: #222; padding: 2px 4px; border: 1px solid #555;",
        "color: #888;"
      );
      window.rssBannerPrinted = true;
    }

  } catch (e) {
    console.error('Error generating RSS feed:', e);
  }
}

// XML entity escaper
function escXML(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ── Date helpers ─────────────────────────────────────────────────────────────

function parseDate(str) {
  if (!str) return null;
  str = str.trim();

  // Try MM/DD/YYYY (US Format)
  let m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(+m[3], +m[1] - 1, +m[2]);

  // Try MM/DD (assume current year if missing)
  m = str.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (m) return new Date(new Date().getFullYear(), +m[1] - 1, +m[2]);

  // Try YYYY-MM-DD
  m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);

  // Fallback to standard JS parsing
  const d = new Date(str);
  if (!isNaN(d)) return d;

  return null;
}

// "03/21/2026" → "03/21"
function formatShort(str) {
  const d = parseDate(str);
  if (!d) return str;
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' });
}

// "03/21/2026" → "March 2026"
function groupLabel(str) {
  const d = parseDate(str);
  if (!d) return str || 'Undated';
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// ── CSV parser ───────────────────────────────────────────────────────────────

function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQ = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i], nx = text[i + 1];
    if (inQ) {
      if (ch === '"' && nx === '"') { field += '"'; i++; }
      else if (ch === '"') inQ = false;
      else field += ch;
    } else {
      if (ch === '"') { inQ = true; }
      else if (ch === ',') { row.push(field.trim()); field = ''; }
      else if (ch === '\n' || (ch === '\r' && nx === '\n')) {
        row.push(field.trim()); field = '';
        rows.push(row); row = [];
        if (ch === '\r') i++;
      } else {
        field += ch;
      }
    }
  }

  if (field || row.length) { row.push(field.trim()); rows.push(row); }
  return rows;
}

// ── Utility ──────────────────────────────────────────────────────────────────

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function linkify(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, function (url) {
    let trailing = '';
    if (url.match(/[.,;:\)]$/)) {
      trailing = url.slice(-1);
      url = url.slice(0, -1);
    }
    return `<a href="${url}" target="_blank" rel="noopener" class="post-inline-link">${url}</a>` + trailing;
  });
}
