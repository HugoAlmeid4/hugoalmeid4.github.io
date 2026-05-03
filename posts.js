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
    return;
  }

  try {
    const res = await fetch(SHEETS_CSV_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const rows = parseCSV(text);

    if (rows.length < 2) {
      status.textContent = 'No posts found in sheet.';
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

    renderPosts(posts, list, status);

  } catch (e) {
    status.textContent = 'Could not load posts. Check the CSV URL and sheet sharing settings.';
    console.error(e);
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

  let currentGroup = null;
  const postsToShow = posts.slice(0, visibleCount);

  postsToShow.forEach(post => {
    const group = groupLabel(post.date);

    // Insert a month/year divider when the group changes
    if (group !== currentGroup) {
      currentGroup = group;
      const label = document.createElement('div');
      label.className = 'date-group-label';
      label.textContent = group;
      list.appendChild(label);
    }

    const card = document.createElement('div');
    card.className = 'post-card';
    card.innerHTML = `
      <div class="post-header">
        <div class="post-header-left">
          <div class="post-title">
            ${esc(post.title)}
            <span class="post-date">• ${formatShort(post.date)}</span>
          </div>
          <div class="post-excerpt-preview">${esc(post.excerpt)}</div>
        </div>
        <span class="post-arrow">▼</span>
      </div>
      <div class="post-body">
        <div class="post-body-inner">
          <p>${linkify(esc(post.excerpt))}</p>
          ${post.url ? `<a class="read-more" href="${esc(post.url)}" target="_blank" rel="noopener">Read full post →</a>` : ''}
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

    list.appendChild(card);
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
    list.appendChild(btnContainer);
  }

  if (status) {
    status.textContent = `${posts.length} post${posts.length !== 1 ? 's' : ''}`;
    status.style.textAlign = 'center';
    list.appendChild(status);
  }
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
  return text.replace(urlRegex, function(url) {
    let trailing = '';
    if (url.match(/[.,;:\)]$/)) {
      trailing = url.slice(-1);
      url = url.slice(0, -1);
    }
    return `<a href="${url}" target="_blank" rel="noopener" class="post-inline-link">${url}</a>` + trailing;
  });
}
