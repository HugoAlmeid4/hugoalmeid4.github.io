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
    renderAll();
  } catch (err) {
    console.error('Error loading posts:', err);
    // Fall back to demo posts so the page is never blank
    allPosts = getDemoPosts();
    renderAll();
  }
  showLoading(false);
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
  }
  return posts;
}

// ─── Hero ──────────────────────────────────────────────────────
function renderHero(post) {
  if (!post) return;
  document.title = `Hralmeida — ${post.title}`;
  document.getElementById('hero-title').textContent = post.title;
  document.getElementById('hero-meta').innerHTML =
    `<span>Por ${post.author || 'hralmeida'}</span><span>${formatDate(post.date)}</span>`;
  document.getElementById('hero-labels').innerHTML =
    labelsHtml(post.labels, 'hero-label');
  document.getElementById('hero-cta').onclick = (e) => {
    e.preventDefault();
    openPost(post);
  };
  if (post.image) {
    document.getElementById('hero-bg').style.backgroundImage = `url(${post.image})`;
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
    banner.innerHTML = `<span>Resultados para "<strong>${escHtml(currentSearch)}</strong>" — ${posts.length} post${posts.length !== 1 ? 's' : ''}</span>
      <button onclick="clearSearch()">Limpar</button>`;
    grid.parentElement.insertBefore(banner, grid);
  }

  // When filtering/searching: show ALL matching posts as cards (including the hero one)
  // When showing everything: skip only the hero if there are other posts too
  const heroPost = allPosts[0];
  const cardPosts = (currentFilter || currentSearch)
    ? posts
    : (posts.length > 1 ? posts.slice(1) : posts);

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
      ${hasImage ? `<div class="card-thumb"><img src="${escAttr(post.image)}" alt="${escAttr(post.title)}" loading="lazy"/></div>` : ''}
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
    `<span>Por ${escHtml(post.author || 'hralmeida')}</span>
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
      🔗 Copiar link
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
    btn.textContent = '✓ Copiado!';
    btn.classList.add('copy-success');
    setTimeout(() => {
      btn.textContent = '🔗 Copiar link';
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
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1"/>');

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
  return parsed.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' });
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

// ─── Demo posts (used when no Sheet URL is configured) ─────────
function getDemoPosts() {
  return [
    {
      title: 'O Meu Novo Setup de Astrofotografia',
      date: '2026-03-20',
      author: 'hralmeida',
      labels: 'Astrofotografia, Equipamento',
      excerpt: 'Finalizei o meu setup com o Sky-Watcher Evostar 72ED DS-Pro e a montagem Star Adventurer GTi. Aqui estão as minhas impressões iniciais.',
      body: `## O equipamento

Depois de meses a investigar, finalizei o meu setup de astrofotografia. Os componentes principais são:

- **Sky-Watcher Evostar 72ED DS-Pro** — refractor apocromático 72mm f/5.8
- **Sky-Watcher Star Adventurer GTi** — montagem goto portátil
- **Canon EOS 1200D (T5)** — câmara DSLR modificável
- **JINTU C1** — intervalómetro para captura automática

## Workflow de processamento

Uso o seguinte workflow para processar as imagens:

1. Captura em RAW com o intervalómetro
2. Stacking com **DeepSkyStacker** ou **Siril**
3. Processamento final no **PixInsight 1.8**

## Primeiras impressões

A montagem Star Adventurer GTi surpreendeu-me positivamente. O tracking é muito estável para exposições até 3 minutos sem guiding.

> "A astrofotografia é a arte de capturar luz que viajou milhões de anos."

O próximo passo é experimentar com a Nebulosa de Orion e a Galáxia de Andrómeda.`,
      image: '',
      slug: 'setup-astrofotografia-2026'
    },
    {
      title: 'GrapheneOS no Pixel 8a — Vale a Pena?',
      date: '2026-03-15',
      author: 'hralmeida',
      labels: 'Privacidade, Android',
      excerpt: 'Depois de migrar para o GrapheneOS, aqui está o que mudou na minha experiência diária.',
      body: `## Porquê mudar?

Preocupações com privacidade e controlo sobre o dispositivo levaram-me a experimentar o GrapheneOS no Pixel 8a.

## O que mudou

**Positivo:**
- Sem telemetria do Google por defeito
- Sandbox para apps do Google (opcional)
- Atualizações de segurança rápidas
- Performance idêntica ao stock

**Negativo:**
- Algumas apps bancárias precisam de configuração extra
- Google Pay não funciona (esperado)

## Conclusão

Para quem valoriza privacidade, vale definitivamente a pena.`,
      image: '',
      slug: 'grapheneos-pixel-8a'
    },
    {
      title: 'Buracos Negros e o Destino do Universo',
      date: '2026-02-28',
      author: 'hralmeida',
      labels: 'Astrofísica',
      excerpt: 'Uma exploração sobre evaporação de Hawking e o que acontece quando o último buraco negro se extingue.',
      body: `## Evaporação de Hawking

Stephen Hawking previu em 1974 que os buracos negros não são completamente negros — emitem radiação térmica lentamente.

## O paradoxo da informação

Se um buraco negro evapora completamente, o que acontece à informação que caiu dentro dele? Esta questão ainda não tem resposta definitiva.

## O fim do universo

Num futuro distante (cerca de 10^100 anos), o último buraco negro evapora. O universo fica num estado de morte térmica — máxima entropia, temperatura próxima do zero absoluto.`,
      image: '',
      slug: 'buracos-negros-universo'
    }
  ];
}

