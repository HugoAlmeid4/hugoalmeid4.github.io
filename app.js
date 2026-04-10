/* ═══════════════════════════════════════════════════════════════
   HRALMEIDA BLOG — app.js
   Posts are loaded from a Google Sheet published as CSV.

   HOW TO SET UP YOUR GOOGLE SHEET:
   1. Create a Google Sheet with these EXACT column headers in row 1:
      title | date | labels | excerpt | body | image | slug

   2. Fill in your posts (one per row):
      - title   → Post title
      - date    → Date as text e.g. "20 Mar 2026"
      - labels  → Comma-separated tags e.g. "Astronomia, Equipamento"
      - excerpt → Short summary shown on cards (optional)
      - body    → Full post content. Supports basic markdown:
                  ## Heading, **bold**, _italic_, [link](url),
                  > blockquote, `code`, ```code block```
      - image   → Direct image URL for the thumbnail (optional)
      - slug    → URL-friendly ID e.g. "meu-telescopio-72ed" (unique!)

   3. Publish the sheet:
      File → Share → Publish to web
      Choose "Sheet1" and "Comma-separated values (.csv)"
      Click Publish, copy the URL

   4. Paste that URL in SHEET_CSV_URL below.
═══════════════════════════════════════════════════════════════ */

const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ-V9ATEkb9OISQ8RCoTnOXTFDDxBprsIQGmRU-QeGKo_IaB_v76vwhmRkjBgIaLL2ZqRRDY3NH5ZW7/pub?gid=0&single=true&output=csv';

// ─── State ─────────────────────────────────────────────────────
let allPosts = [];
let currentFilter = null;
let currentSearch = '';

// ─── Boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadPosts();

  // Search form
  document.getElementById('search-form').addEventListener('submit', handleSearch);

  // Close post on browser back
  window.addEventListener('popstate', () => {
    if (document.getElementById('post-view').style.display !== 'none') {
      closePost(false);
    }
  });
});

// ─── Load & parse CSV ──────────────────────────────────────────
async function loadPosts() {
  showLoading(true);
  try {
    const url = SHEET_CSV_URL.includes('YOUR_GOOGLE') ? null : SHEET_CSV_URL;
    if (!url) {
      // Demo data when no sheet is configured
      allPosts = getDemoPosts();
    } else {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch sheet');
      const csv = await res.text();
      allPosts = parseCSV(csv);
    }
    // Sort posts by date descending
    allPosts.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    renderAll();
  } catch (err) {
    console.error('Error loading posts:', err);
    // Fall back to demo posts so the page is never blank
    allPosts = getDemoPosts();
    renderAll();
  }
  showLoading(false);

  // Deep linking for single posts
  const hash = window.location.hash.replace(/^#/, '');
  if (hash === 'about-me') {
    setTimeout(openAboutMe, 50);
  } else if (hash) {
    const post = allPosts.find(p => (p.slug || slugify(p.title)) === hash);
    if (post) openPost(post);
  }
}

function parseCSV(csv) {
  // Parse the whole CSV respecting quoted fields that span multiple lines
  const rows = parseCSVRows(csv.trim());
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim().toLowerCase());
  const posts = [];
  for (let i = 1; i < rows.length; i++) {
    const vals = rows[i];
    const post = {};
    headers.forEach((h, idx) => { post[h] = (vals[idx] || '').trim(); });
    if (post.title) posts.push(post);
  }
  return posts;
}

// Full RFC-4180 CSV parser: handles quoted fields with commas AND newlines inside
function parseCSVRows(csv) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuote = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    const next = csv[i + 1];
    if (inQuote) {
      if (ch === '"' && next === '"') { field += '"'; i++; }        // escaped quote ""
      else if (ch === '"') { inQuote = false; }                     // closing quote
      else { field += ch; }                                          // normal char inside quotes
    } else {
      if (ch === '"') { inQuote = true; }                           // opening quote
      else if (ch === ',') { row.push(field); field = ''; }         // field separator
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; } // row end
      else if (ch === '\r' && next === '\n') { i++; row.push(field); rows.push(row); row = []; field = ''; } // CRLF
      else if (ch === '\r') { row.push(field); rows.push(row); row = []; field = ''; } // CR only
      else { field += ch; }
    }
  }
  // Push the last field and row if non-empty
  if (field || row.length > 0) { row.push(field); if (row.some(f => f)) rows.push(row); }
  return rows;
}

// ─── Render ────────────────────────────────────────────────────
function renderAll() {
  const posts = getFilteredPosts();
  renderHero(allPosts[0]);
  renderCards(posts);
  renderLabels();
}

function getFilteredPosts() {
  let posts = [...allPosts];
  if (currentFilter) {
    posts = posts.filter(p =>
      (p.labels || '').split(',').map(l => l.trim().toLowerCase())
        .includes(currentFilter.toLowerCase())
    );
  }
  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    posts = posts.filter(p =>
      (p.title || '').toLowerCase().includes(q) ||
      (p.excerpt || '').toLowerCase().includes(q) ||
      (p.body || '').toLowerCase().includes(q)
    );
    // Sort by relevance: title match first
    posts.sort((a, b) => {
      const aTitle = (a.title || '').toLowerCase().includes(q);
      const bTitle = (b.title || '').toLowerCase().includes(q);
      if (aTitle && !bTitle) return -1;
      if (!aTitle && bTitle) return 1;
      return 0; // fallback to date order
    });
  }
  return posts;
}

// ─── Hero ──────────────────────────────────────────────────────
function renderHero(post) {
  if (!post) return;
  document.title = `Hralmeida — ${post.title}`;
  document.getElementById('hero-title').textContent = post.title;
  document.getElementById('hero-meta').innerHTML =
    `<span>By ${post.author || 'hralmeida'}</span><span>${formatDate(post.date)}</span>`;
  document.getElementById('hero-labels').innerHTML =
    labelsHtml(post.labels, 'hero-label');
  document.getElementById('hero-cta').onclick = (e) => {
    e.preventDefault();
    openPost(post);
  };
  if (post.image) {
    document.getElementById('hero-bg').style.backgroundImage = `url(${optimizeImageUrl(post.image)})`;
  }
}

// ─── Cards ─────────────────────────────────────────────────────
function renderCards(posts) {
  const grid = document.getElementById('posts-grid');

  // Remove search banner if present
  const existing = document.getElementById('search-banner');
  if (existing) existing.remove();

  if (currentSearch) {
    const banner = document.createElement('div');
    banner.id = 'search-banner';
    banner.className = 'search-banner';
    banner.innerHTML = `<span>Results for "<strong>${escHtml(currentSearch)}</strong>" — ${posts.length} post${posts.length !== 1 ? 's' : ''}</span>
      <button onclick="clearSearch()">Clear</button>`;
    grid.parentElement.insertBefore(banner, grid);
  }

  // Show all posts in the recent list so we meet the minimum count
  const heroPost = allPosts[0];
  const cardPosts = posts;

  if (cardPosts.length === 0) {
    grid.innerHTML = '';
    document.getElementById('no-posts').style.display = 'block';
    return;
  }
  document.getElementById('no-posts').style.display = 'none';

  grid.innerHTML = cardPosts.map(post => {
    const hasImage = post.image && post.image.trim() !== '';
    return `
    <article class="post-card${hasImage ? '' : ' no-image'}" onclick="openPost(${JSON.stringify(post).split('"').join("&quot;")})">
      <div class="card-text">
        <div class="card-labels">${labelsHtml(post.labels, 'card-label')}</div>
        <h2 class="card-title">${escHtml(post.title)}</h2>
        ${post.excerpt ? `<p class="card-excerpt">${escHtml(post.excerpt)}</p>` : ''}
        <div class="card-meta">
          <span>${post.author || 'hralmeida'}</span>
          <span class="dot"></span>
          <span>${formatDate(post.date)}</span>
        </div>
      </div>
      ${hasImage ? `<div class="card-thumb"><img src="${escAttr(optimizeImageUrl(post.image))}" alt="${escAttr(post.title)}" loading="lazy" decoding="async"/></div>` : ''}
    </article>`;
  }).join('');
}

// ─── Labels sidebar ────────────────────────────────────────────
function renderLabels() {
  const all = {};
  allPosts.forEach(p => {
    (p.labels || '').split(',').map(l => l.trim()).filter(Boolean).forEach(l => {
      all[l] = (all[l] || 0) + 1;
    });
  });
  const cloud = document.getElementById('label-cloud');
  cloud.innerHTML = Object.entries(all)
    .sort((a, b) => b[1] - a[1])
    .map(([label]) => `
      <span class="label-pill${currentFilter === label ? ' active' : ''}"
        onclick="filterByLabel('${escAttr(label)}')">${escHtml(label)}</span>
    `).join('');
}

// ─── Open / Close single post ──────────────────────────────────
function openPost(post) {
  const view = document.getElementById('post-view');

  document.getElementById('post-labels-row').innerHTML =
    labelsHtml(post.labels, 'post-label-chip');

  document.getElementById('post-heading').textContent = post.title;

  document.getElementById('post-meta-row').innerHTML =
    `<span>By ${escHtml(post.author || 'hralmeida')}</span>
     <span>${formatDate(post.date)}</span>`;

  document.getElementById('post-body-text').innerHTML =
    markdownToHtml(post.body || '');

  // Share row
  const shareRow = document.createElement('div');
  shareRow.className = 'post-share-row';
  const postUrl = `${location.origin}${location.pathname}#${post.slug || slugify(post.title)}`;
  shareRow.innerHTML = `
    <button class="share-btn" onclick="shareTwitter('${escAttr(post.title)}', '${escAttr(postUrl)}')">
      𝕏 Twitter
    </button>
    <button class="share-btn" onclick="copyLink('${escAttr(postUrl)}', this)">
      🔗 Copy link
    </button>
  `;
  const body = document.getElementById('post-body-text');
  const old = document.querySelector('.post-share-row');
  if (old) old.remove();
  body.after(shareRow);

  view.style.display = 'block';
  document.body.style.overflow = 'hidden';
  view.scrollTop = 0;
  document.title = `Hralmeida — ${post.title}`;

  history.pushState({ post: post.slug }, '', `#${post.slug || slugify(post.title)}`);
}

function closePost(pushState = true) {
  document.getElementById('post-view').style.display = 'none';
  document.body.style.overflow = '';
  document.title = 'Hralmeida';
  if (pushState) history.pushState(null, '', location.pathname);
}

function openAboutMe() {
  const aboutPost = {
    title: 'About me',
    author: 'Hugo Almeida',
    date: new Date().toISOString(),
    labels: 'Bio, Contact',
    slug: 'about-me',
    body: `## Hello!

I'm **Hugo Almeida**.

> "We are made of star stuff" — Carl Sagan

I am a student from Portugal. That likes technology. But want to work as an astrophisysict. I like math, and physics. But the main thing that I want is to understand anything I have the chance too.

### Get in touch
You can find my projects and code on [GitHub](https://github.com/HugoAlmeid4).`
  };
  openPost(aboutPost);
}

// ─── Search ────────────────────────────────────────────────────
function handleSearch(e) {
  e.preventDefault();
  const q = document.getElementById('search-input').value.trim();
  currentSearch = q;
  currentFilter = null;
  renderLabels();
  renderCards(getFilteredPosts());
  window.scrollTo({ top: document.querySelector('.page-body').offsetTop - 80, behavior: 'smooth' });
}

function clearSearch() {
  currentSearch = '';
  document.getElementById('search-input').value = '';
  renderCards(getFilteredPosts());
}

function filterByLabel(label) {
  if (currentFilter === label) {
    currentFilter = null;
  } else {
    currentFilter = label;
    currentSearch = '';
    document.getElementById('search-input').value = '';
  }
  renderLabels();
  renderCards(getFilteredPosts());
  window.scrollTo({ top: document.querySelector('.page-body').offsetTop - 80, behavior: 'smooth' });
}

// ─── Share helpers ─────────────────────────────────────────────
function shareTwitter(title, url) {
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`, '_blank');
}
function copyLink(url, btn) {
  navigator.clipboard.writeText(url).then(() => {
    btn.textContent = '✓ Copied!';
    btn.classList.add('copy-success');
    setTimeout(() => {
      btn.textContent = '🔗 Copy link';
      btn.classList.remove('copy-success');
    }, 2000);
  });
}

// ─── Mobile menu ───────────────────────────────────────────────
function toggleMobileMenu() {
  document.getElementById('mobile-drawer').classList.toggle('open');
  document.getElementById('hamburger').classList.toggle('open');
}

// ─── Markdown → HTML (lightweight) ────────────────────────────
function markdownToHtml(md) {
  if (!md) return '';
  let html = escHtml(md);

  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Blockquote
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  // Code blocks (```...```)
  html = html.replace(/```[\w]*\n?([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold & italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');

  // Images ![alt](url)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
    return `<img src="${optimizeImageUrl(url)}" alt="${alt}" loading="lazy" decoding="async"/>`;
  });

  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr/>');

  // Unordered lists
  html = html.replace(/((?:^- .+\n?)+)/gm, match => {
    const items = match.trim().split('\n').map(l => `<li>${l.replace(/^- /, '')}</li>`).join('');
    return `<ul>${items}</ul>`;
  });

  // Ordered lists
  html = html.replace(/((?:^\d+\. .+\n?)+)/gm, match => {
    const items = match.trim().split('\n').map(l => `<li>${l.replace(/^\d+\. /, '')}</li>`).join('');
    return `<ol>${items}</ol>`;
  });

  // Paragraphs — split by double newlines
  const blocks = html.split(/\n{2,}/);
  html = blocks.map(block => {
    block = block.trim();
    if (!block) return '';
    if (/^<(h[1-6]|ul|ol|pre|blockquote|hr|img)/.test(block)) return block;
    // Convert single newlines inside paragraphs to <br>
    return `<p>${block.replace(/\n/g, '<br/>')}</p>`;
  }).join('\n');

  return html;
}

// ─── Utilities ─────────────────────────────────────────────────
function escHtml(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(s) {
  return (s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function formatDate(d) {
  if (!d) return '';
  const parsed = new Date(d);
  if (isNaN(parsed)) return d; // return as-is if not parseable
  return parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function slugify(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}
function labelsHtml(labels, cls) {
  return (labels || '').split(',').map(l => l.trim()).filter(Boolean)
    .map(l => `<span class="${cls}">${escHtml(l)}</span>`).join('');
}
function showLoading(show) {
  document.getElementById('loading').style.display = show ? 'flex' : 'none';
}
function optimizeImageUrl(url) {
  if (!url) return '';
  const match = url.match(/drive\.google\.com\/file\/d\/([^\/]+)/);
  if (match) return `https://drive.google.com/uc?id=${match[1]}`;
  return url;
}

// ─── Demo posts (used when no Sheet URL is configured) ─────────
function getDemoPosts() {
  return [
    {
      title: 'My New Astrophotography Setup',
      date: '2026-03-20',
      author: 'hralmeida',
      labels: 'Astrophotography, Gear',
      excerpt: 'I wrapped up my setup with the Sky-Watcher Evostar 72ED DS-Pro and the Star Adventurer GTi mount. Here are my first impressions.',
      body: `## The Gear

After months of research, I finalized my astrophotography setup. The main components are:

- **Sky-Watcher Evostar 72ED DS-Pro** — 72mm f/5.8 apochromatic refractor
- **Sky-Watcher Star Adventurer GTi** — portable goto mount
- **Canon EOS 1200D (T5)** — moddable DSLR camera
- **JINTU C1** — intervalometer for automatic capture

## Processing Workflow

I use the following workflow to process images:

1. Capture in RAW with the intervalometer
2. Stacking with **DeepSkyStacker** or **Siril**
3. Final processing in **PixInsight 1.8**

## First Impressions

The Star Adventurer GTi mount positively surprised me. The tracking is very stable for up to 3-minute exposures without guiding.

> "Astrophotography is the art of capturing light that has travelled millions of years."

The next step is to experiment with the Orion Nebula and the Andromeda Galaxy.`,
      image: '',
      slug: 'setup-astrofotografia-2026'
    },
    {
      title: 'GrapheneOS on Pixel 8a — Is It Worth It?',
      date: '2026-03-15',
      author: 'hralmeida',
      labels: 'Privacy, Android',
      excerpt: 'After migrating to GrapheneOS, here is what changed in my daily experience.',
      body: `## Why change?

Concerns with privacy and control over the device led me to try GrapheneOS on the Pixel 8a.

## What changed

**Positive:**
- No Google telemetry by default
- Sandbox for Google apps (optional)
- Fast security updates
- Identical performance to stock

**Negative:**
- Some banking apps need extra configuration
- Google Pay does not work (expected)

## Conclusion

For those who value privacy, it is definitely worth it.`,
      image: '',
      slug: 'grapheneos-pixel-8a'
    },
    {
      title: 'Black Holes and the Fate of the Universe',
      date: '2026-02-28',
      author: 'hralmeida',
      labels: 'Astrophysics',
      excerpt: 'An exploration of Hawking radiation and what happens when the last black hole flickers out.',
      body: `## Hawking Radiation

Stephen Hawking predicted in 1974 that black holes are not completely black — they emit thermal radiation slowly.

## The Information Paradox

If a black hole evaporates completely, what happens to the information that fell into it? This question still has no definitive answer.

## The End of the Universe

In a distant future (about 10^100 years), the last black hole evaporates. The universe is left in a state of thermal death — maximum entropy, temperature close to absolute zero.`,
      image: '',
      slug: 'buracos-negros-universo'
    }
  ];
}

