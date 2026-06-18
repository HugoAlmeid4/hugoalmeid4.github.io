// ─── CONFIG ──────────────────────────────────────────────────────────────────
// Local blog posts – reads posts/index.json then fetches each .md file.
// ─────────────────────────────────────────────────────────────────────────────

let allPosts = []; // Global store for filtering
let activeFilterTag = null;

document.addEventListener('DOMContentLoaded', loadPosts);

async function loadPosts() {
  const list = document.getElementById('postsList');
  const status = document.getElementById('postsStatus');

  if (status) status.textContent = 'Loading posts...';
  injectSearchUI();

  const cached = (() => {
    try { return JSON.parse(localStorage.getItem('posts_cache')); } catch { return null; }
  })();

  if (cached && Array.isArray(cached.data) && cached.data.length) {
    allPosts = cached.data;
    renderPosts(allPosts, list, status);
    handleSharedPostLink(allPosts);
    if (status) status.textContent = 'Updating...';
  }

  try {
    const posts = await fetchAndParsePosts();
    if (!posts || posts.length === 0) {
      if (status) status.textContent = 'No valid posts found.';
      return;
    }
    allPosts = posts;

    try { localStorage.setItem('posts_cache', JSON.stringify({ data: posts })); } catch { }
    setupRSSFeed(posts);

    if (!cached || JSON.stringify(cached.data) !== JSON.stringify(posts)) {
      renderPosts(posts, list, status);
      handleSharedPostLink(posts);
    } else if (!cached) {
      handleSharedPostLink(posts);
    }
    if (status) status.textContent = '';
  } catch (e) {
    console.error('Posts load error:', e);
    const errorMsg = `Error: ${e.message}. If you are on GitHub Pages, make sure to add a .nojekyll file to your root folder.`;
    if (status) status.textContent = errorMsg;
    if (!cached && list) {
      list.innerHTML = `<div class="error-notice">${errorMsg}</div>`;
    }
  }
}

async function fetchAndParsePosts() {
  const indexUrl = 'posts/index.json';
  const idxRes = await fetch(indexUrl);
  if (!idxRes.ok) throw new Error(`HTTP ${idxRes.status} fetching index.json`);
  
  const fileList = await idxRes.json();
  if (!Array.isArray(fileList) || !fileList.length) return null;

  const postPromises = fileList.map(async (filename) => {
    const postUrl = `posts/${filename}`;
    try {
      const res = await fetch(postUrl);
      if (!res.ok) {
        // Log the exact URL that failed to help the user debug
        const absoluteUrl = new URL(postUrl, window.location.href).href;
        console.error(`FAILED TO LOAD: ${absoluteUrl} (HTTP ${res.status})`);
        return null; 
      }
      const mdText = await res.text();

      const { metadata, content } = parseFrontmatter(mdText);
      const bodyHtml = parseMarkdown(content);
      const slug = filename.replace(/\.md$/, '');

      const date = metadata.date || new Date().toISOString().slice(0, 10);

      const cleanText = content.replace(/!\[\[[^\]]*\]\]/g, '')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
        .replace(/\[([^\]) ]*)\]\([^)]*\)/g, '$1')
        .replace(/[#*`_|~>]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      let readingTime = metadata.readingTime;
      if (!readingTime) {
        const words = cleanText.split(/\s+/).filter(w => w.length > 0).length;
        let totalSeconds = (words / 200) * 60;
        const imageCount = (content.match(/!\[.*?\]\(.*?\)/g) || []).length + (content.match(/!\[\[.*?\]\]/g) || []).length;
        for (let i = 0; i < imageCount; i++) totalSeconds += Math.max(12 - i, 3);
        const codeBlockCount = (content.match(/```/g) || []).length / 2;
        totalSeconds += codeBlockCount * 15;
        const mins = Math.ceil(totalSeconds / 60);
        readingTime = `${mins} min read`;
      }

      const excerpt = metadata.excerpt || (cleanText.slice(0, 180) + (cleanText.length > 180 ? '...' : ''));
      const tags = metadata.tags ? metadata.tags.split(',').map(t => t.trim()) : [];

      return {
        slug,
        title: metadata.title || slug.replace(/-/g, ' '),
        date,
        excerpt,
        readingTime,
        author: metadata.author || '',
        tags,
        bodyHtml,
        filename,
      };
    } catch (err) {
      console.warn(`Error loading ${filename}:`, err);
      return null;
    }
  });

  const results = await Promise.all(postPromises);
  const validPosts = results.filter(p => p !== null);

  validPosts.sort((a, b) => {
    const da = parseDate(a.date), db = parseDate(b.date);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return db - da;
  });

  return validPosts;
}

function parseFrontmatter(mdContent) {
  const fmMatch = mdContent.match(/^---\r?\n([\s\S]+?)\r?\n---[ \t]*\r?\n?/);
  if (!fmMatch) return { metadata: {}, content: mdContent };

  const metadata = {};
  fmMatch[1].split('\n').forEach(line => {
    const colon = line.indexOf(':');
    if (colon > 0) {
      const key = line.slice(0, colon).trim();
      const value = line.slice(colon + 1).trim().replace(/^['"]|['"]$/g, '');
      metadata[key] = value;
    }
  });

  return { metadata, content: mdContent.slice(fmMatch[0].length) };
}

function parseMarkdown(md) {
  const html = parseLines(md.split('\n'));
  return linkifyRawUrls(html);
}

function parseLines(lines) {
  const out = [];
  let inUL = false;
  let inCodeBlock = false;
  let codeLang = '';
  let codeLines = [];
  let tableHeaderCells = null;
  let tableRowsBuffer = [];
  let awaitingSeparator = false;

  const flushTable = () => {
    if (tableHeaderCells) out.push(renderTable(tableHeaderCells, tableRowsBuffer));
    tableHeaderCells = null; tableRowsBuffer = []; awaitingSeparator = false;
  };

  const flushList = () => { if (inUL) { out.push('</ul>'); inUL = false; } };

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      flushList(); flushTable();
      if (inCodeBlock) {
        inCodeBlock = false;
        out.push(`<pre><code class="language-${codeLang}">${esc(codeLines.join('\n'))}</code></pre>`);
        codeLines = []; codeLang = '';
      } else {
        inCodeBlock = true;
        codeLang = line.trim().slice(3).trim();
      }
      continue;
    }
    if (inCodeBlock) { codeLines.push(line); continue; }

    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushList();
      const cells = trimmed.slice(1, -1).split('|').map(c => c.trim());
      const isSep = cells.every(c => /^:?-+:?$/.test(c));
      if (isSep) { awaitingSeparator = false; continue; }
      if (tableHeaderCells === null) { tableHeaderCells = cells; awaitingSeparator = true; }
      else { tableRowsBuffer.push(cells); }
      continue;
    }
    if (tableHeaderCells !== null) flushTable();
    if (trimmed === '' || trimmed === ' ') { flushList(); continue; }

    const hMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (hMatch) {
      flushList();
      const level = hMatch[1].length;
      out.push(`<h${level}>${parseInline(hMatch[2])}</h${level}>`);
      continue;
    }

    const liMatch = line.match(/^[ \t]*[-*+]\s+(.*)/);
    if (liMatch) {
      if (!inUL) { out.push('<ul>'); inUL = true; }
      out.push(`<li>${parseInline(liMatch[1])}</li>`);
      continue;
    }

    flushList();
    out.push(`<p>${parseInline(line)}</p>`);
  }

  if (inCodeBlock) out.push(`<pre><code>${esc(codeLines.join('\n'))}</code></pre>`);
  flushList();
  if (tableHeaderCells !== null) flushTable();

  return out.join('\n');
}

function renderTable(headers, rows) {
  let h = '<div class="data-log-container"><table class="data-log-table"><thead><tr>';
  headers.forEach(c => { h += `<th>${parseInline(c)}</th>`; });
  h += '</tr></thead><tbody>';
  rows.forEach(row => {
    h += '<tr>';
    row.forEach(c => { h += `<td>${parseInline(c)}</td>`; });
    h += '</tr>';
  });
  h += '</tbody></table></div>';
  return h;
}

function parseInline(text) {
  const placeholders = [];
  text = text.replace(/`([^`]+)`/g, (_, code) => {
    const id = `\uFFFC${placeholders.length}\uFFFC`;
    placeholders.push(`<code>${esc(code)}</code>`);
    return id;
  });

  text = text.replace(/!\[\[([^\]|]+?)\|([^\]|]+?)\]\]/g, (match, light, dark) => {
    if (/^\d+$/.test(dark.trim())) {
      return match;
    }
    const id = `\uFFFC${placeholders.length}\uFFFC`;
    const lRaw = light.trim().startsWith('http') ? light.trim() : `posts/${light.trim()}`;
    const dRaw = dark.trim().startsWith('http') ? dark.trim() : `posts/${dark.trim()}`;
    const lSrc = lRaw.split('/').map((s, i) => i === 0 ? s : encodeURIComponent(s)).join('/');
    const dSrc = dRaw.split('/').map((s, i) => i === 0 ? s : encodeURIComponent(s)).join('/');
    placeholders.push(`<picture class="theme-aware-img">
      <source srcset="${dSrc}" media="(prefers-color-scheme: dark)">
      <img src="${lSrc}" style="max-width:100%;height:auto;display:inline-block;vertical-align:middle;margin:6px 4px;">
    </picture>`);
    return id;
  });

  text = text.replace(/!\[\[([^\]|]+?)(?:\|(\d+))?\]\]/g, (_, fname, w) => {
    const f = fname.trim();
    const src = /^https?:\/\//.test(f) ? f : `posts/${f}`;
    const enc = src.split('/').map((s, i) => i === 0 ? s : encodeURIComponent(s)).join('/');
    const dims = w ? `width="${w}" style="max-width:${w}px;height:auto;display:inline-block;vertical-align:middle;margin:6px 4px;"`
      : `style="max-width:100%;height:auto;display:inline-block;vertical-align:middle;margin:6px 4px;"`;
    const id = `\uFFFC${placeholders.length}\uFFFC`;
    placeholders.push(`<img src="${enc}" ${dims} alt="${esc(f)}">`);
    return id;
  });

  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
    const u = url.trim();
    const src = /^https?:\/\//.test(u) || u.startsWith('/') ? u : `posts/${u}`;
    const enc = src.split('/').map((s, i) => i === 0 ? s : encodeURIComponent(s)).join('/');
    const id = `\uFFFC${placeholders.length}\uFFFC`;
    placeholders.push(`<img src="${enc}" style="max-width:100%;height:auto;display:inline-block;vertical-align:middle;margin:6px 4px;" alt="${esc(alt)}">`);
    return id;
  });

  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+(?:\([^\s)]*\)[^\s)]*)*)\)/g, (_, linkText, url) => {
    const id = `\uFFFC${placeholders.length}\uFFFC`;
    const parsedText = parseInlineRecursive(linkText);
    placeholders.push(`<a href="${url}" target="_blank" rel="noopener">${parsedText}</a>`);
    return id;
  });

  text = text.replace(/(^|[^\w])(\*\*|__)(?=\S)(.+?)(?<=\S)\2(?=[^\w]|$)/g, '$1<strong>$3</strong>');
  text = text.replace(/(^|[^\w])(\*|_)(?=\S)(.+?)(?<=\S)\2(?=[^\w]|$)/g, '$1<em>$3</em>');

  for (let i = 0; i < placeholders.length; i++) {
    text = text.split(`\uFFFC${i}\uFFFC`).join(placeholders[i]);
  }
  return text;
}

function parseInlineRecursive(text) {
  text = text.replace(/(^|[^\w])(\*\*|__)(?=\S)(.+?)(?<=\S)\2(?=[^\w]|$)/g, '$1<strong>$3</strong>');
  text = text.replace(/(^|[^\w])(\*|_)(?=\S)(.+?)(?<=\S)\2(?=[^\w]|$)/g, '$1<em>$3</em>');
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  return text;
}

function linkifyRawUrls(html) {
  return html.replace(/(<a\s[^>]+>[\s\S]*?<\/a>)|(<img\s[^>]+>)|(https?:\/\/[^\s<"']+(?:\([^\s<"']*\)[^\s<"']*)*)/g, (m, aTag, imgTag, url) => {
    if (aTag || imgTag) return m;
    const clean = url.replace(/[.,;:!?)]+$/, '');
    const trail = url.slice(clean.length);
    return `<a href="${clean}" target="_blank" rel="noopener">${clean}</a>${trail}`;
  });
}

// ── Search & Filters ─────────────────────────────────────────────────────────

function injectSearchUI() {
  if (document.getElementById('postSearchContainer')) return;
  const container = document.createElement('div');
  container.id = 'postSearchContainer';
  container.className = 'search-container';
  container.innerHTML = `
    <div class="search-bar-wrapper">
      <input type="text" id="postSearchInput" placeholder="Search posts..." aria-label="Search posts">
      <button id="postFilterBtn" class="filter-toggle-btn">Filters</button>
    </div>
    <div id="postTagPopup" class="tag-popup">
      <div class="tag-popup-content">
        <h4>Filter by Tags</h4>
        <div id="postTagFilters" class="tag-filters"></div>
        <button id="closeTagPopup" class="close-popup-btn">Done</button>
      </div>
    </div>
  `;
  const section = document.querySelector('.Posts-Section');
  if (section) {
    const h2 = section.querySelector('h2');
    if (h2) h2.after(container);
  }
  const input = document.getElementById('postSearchInput');
  input.addEventListener('input', () => filterAndRender(activeFilterTag));
  
  const filterBtn = document.getElementById('postFilterBtn');
  const popup = document.getElementById('postTagPopup');
  filterBtn.onclick = () => {
    updateTagFilters(activeFilterTag);
    popup.classList.add('active');
    document.body.style.overflow = 'hidden';
  };
  const closePopup = () => {
    popup.classList.remove('active');
    document.body.style.overflow = '';
  };
  document.getElementById('closeTagPopup').onclick = closePopup;
  popup.onclick = (e) => { if (e.target === popup) closePopup(); };
}

function filterAndRender(tag) {
  activeFilterTag = tag;
  const query = document.getElementById('postSearchInput').value.toLowerCase();
  const list = document.getElementById('postsList');
  const status = document.getElementById('postsStatus');
  const filtered = allPosts.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(query) || p.excerpt.toLowerCase().includes(query);
    const matchesTag = activeFilterTag ? p.tags.includes(activeFilterTag) : true;
    return matchesSearch && matchesTag;
  });
  renderPosts(filtered, list, status, 100);
  
  const filterBtn = document.getElementById('postFilterBtn');
  if (activeFilterTag) {
    filterBtn.classList.add('filtering');
    filterBtn.textContent = `Tag: ${activeFilterTag}`;
  } else {
    filterBtn.classList.remove('filtering');
    filterBtn.textContent = 'Filters';
  }
}

function updateTagFilters(activeTag) {
  const tagContainer = document.getElementById('postTagFilters');
  const allTags = [...new Set(allPosts.flatMap(p => p.tags))];
  tagContainer.innerHTML = '';
  
  const allBtn = document.createElement('button');
  allBtn.className = `tag-btn ${!activeTag ? 'active' : ''}`;
  allBtn.textContent = 'All Posts';
  allBtn.onclick = () => { filterAndRender(null); updateTagFilters(null); };
  tagContainer.appendChild(allBtn);

  allTags.forEach(tag => {
    const btn = document.createElement('button');
    btn.className = `tag-btn ${tag === activeTag ? 'active' : ''}`;
    btn.textContent = tag;
    btn.onclick = () => { filterAndRender(tag); updateTagFilters(tag); };
    tagContainer.appendChild(btn);
  });
}

// ── Related Posts ────────────────────────────────────────────────────────────

function getRelatedPosts(currentPost) {
  if (!currentPost.tags.length) return [];
  return allPosts
    .filter(p => p.slug !== currentPost.slug)
    .map(p => {
      const commonTags = p.tags.filter(t => currentPost.tags.includes(t));
      return { ...p, score: commonTags.length };
    })
    .filter(p => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

// ── Styles ───────────────────────────────────────────────────────────────────

if (!document.getElementById('postCustomStyles')) {
  const style = document.createElement('style');
  style.id = 'postCustomStyles';
  style.textContent = `
    .project-fullscreen-overlay { background: rgba(18, 18, 18, 0.98) !important; }
    .project-fullscreen-body a { color: #007bff !important; text-decoration: underline; }
    .project-fullscreen-body a:hover { color: #0056b3 !important; }
    .project-fullscreen-link-btn {
      background: transparent !important; border: 1.5px solid currentColor !important;
      color: inherit !important; padding: 8px 16px !important; font-family: monospace !important;
      font-size: 14px !important; letter-spacing: 2px !important; cursor: pointer !important;
      display: flex !important; align-items: center !important; gap: 10px !important;
      transition: all 0.2s ease !important; text-transform: uppercase !important;
    }
    .project-fullscreen-link-btn:hover { background: rgba(128, 128, 128, 0.1) !important; }
    @media (prefers-color-scheme: light) {
      .project-fullscreen-overlay { background: rgba(255, 255, 255, 0.98) !important; }
      .project-fullscreen-link-btn { border-color: #333 !important; color: #333 !important; }
    }
    .light-mode .project-fullscreen-overlay { background: rgba(255, 255, 255, 0.98) !important; }
    .light-mode .project-fullscreen-link-btn { border-color: #333 !important; color: #333 !important; }
    
    .search-container { margin: 20px 0; }
    .search-bar-wrapper { display: flex; gap: 10px; align-items: center; }
    .search-bar-wrapper input {
      flex: 1; padding: 10px; background: transparent; border: 1.5px solid #333;
      color: inherit; font-family: inherit; border-radius: 0;
    }
    .dark-mode .search-bar-wrapper input { border-color: #555; }
    .filter-toggle-btn {
      background: transparent; border: 1.5px solid #333; color: inherit;
      padding: 10px 15px; border-radius: 0; cursor: pointer; transition: all 0.2s;
      font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em;
    }
    .dark-mode .filter-toggle-btn { border-color: #555; }
    .filter-toggle-btn.filtering { border-color: #007bff; color: #007bff; }
    
    .tag-popup {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: transparent; display: none; align-items: center;
      justify-content: center; z-index: 2000; pointer-events: none;
    }
    .tag-popup.active { display: flex; }
    .tag-popup-content {
      background: rgb(237, 231, 220); padding: 40px; border: 1.5px solid #333;
      max-width: 500px; width: 90%; text-align: center;
      pointer-events: auto; box-shadow: 0 20px 50px rgba(0,0,0,0.3);
    }
    .dark-mode .tag-popup-content { background: #1a1a1a; border-color: #555; }
    .tag-popup-content h4 { margin-bottom: 25px; font-size: 20px; text-transform: uppercase; letter-spacing: 0.05em; }
    .tag-filters { display: flex; gap: 10px; margin: 20px 0; flex-wrap: wrap; justify-content: center; }
    .tag-btn {
      background: transparent; border: 1.5px solid #333; color: inherit; padding: 8px 16px;
      border-radius: 0; cursor: pointer; font-size: 12px; transition: all 0.2s;
      text-transform: uppercase; font-weight: 600;
    }
    .dark-mode .tag-btn { border-color: #555; }
    .tag-btn.active { background: #333; color: rgb(237, 231, 220); }
    .dark-mode .tag-btn.active { background: #ededed; color: #1a1a1a; border-color: #ededed; }
    .close-popup-btn {
      background: #333; color: rgb(237, 231, 220); border: none; padding: 12px 30px;
      cursor: pointer; margin-top: 20px; text-transform: uppercase; font-weight: 600;
      letter-spacing: 0.05em;
    }
    .dark-mode .close-popup-btn { background: #ededed; color: #1a1a1a; }
    
    .related-posts { margin-top: 40px; border-top: 1px solid #333; padding-top: 20px; }
    .related-posts h4 { margin-bottom: 15px; font-size: 18px; }
    .related-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; }
    .related-card {
      background: rgba(128,128,128,0.05); padding: 15px; border-radius: 0;
      cursor: pointer; transition: transform 0.2s; border: 1.5px solid #333;
    }
    .dark-mode .related-card { border-color: #555; }
    .related-card:hover { transform: translateY(-3px); background: rgba(128,128,128,0.1); }
    
    .reading-progress-container {
      position: fixed; top: 0; left: 0; width: 100%; height: 3px;
      background: rgba(0,0,0,0.1); z-index: 1001;
    }
    .project-fullscreen-content { position: relative; }
    #readingProgressBar { width: 0%; height: 100%; background: #007bff; transition: width 0.1s ease; }
    
    .error-notice {
      padding: 20px;
      background: rgba(255, 0, 0, 0.1);
      border: 1px solid #ff0000;
      color: #ff0000;
      margin: 20px 0;
      font-family: monospace;
      font-size: 14px;
    }
  `;
  document.head.appendChild(style);
}

// ── Rendering ────────────────────────────────────────────────────────────────

function renderPosts(posts, list, status, visibleCount = 3) {
  if (!list) return;
  list.innerHTML = '';

  if (!document.getElementById('postFullscreenOverlay')) {
    const ov = document.createElement('div');
    ov.id = 'postFullscreenOverlay';
    ov.className = 'project-fullscreen-overlay';
    ov.innerHTML = `
      <div class="reading-progress-container"><div id="readingProgressBar"></div></div>
      <div class="project-fullscreen-content">
        <button class="project-fullscreen-close" id="postFullscreenClose" aria-label="Close">✕</button>
        <div class="project-fullscreen-type"     id="postFullscreenDate"></div>
        <h2 class="project-fullscreen-title"     id="postFullscreenTitle"></h2>
        <div class="project-fullscreen-body"     id="postFullscreenBody"></div>
        <div class="project-fullscreen-link-container" id="postFullscreenLinkContainer"></div>
        <div id="relatedPostsContainer"></div>
        <div id="mostRecentContainer"></div>
      </div>`;
    document.body.appendChild(ov);
    document.getElementById('postFullscreenClose').onclick = closePostOverlay;
    ov.onclick = e => { if (e.target === ov) closePostOverlay(); };
    
    const content = ov.querySelector('.project-fullscreen-content');
    content.onscroll = () => {
      const winScroll = content.scrollTop;
      const height = content.scrollHeight - content.clientHeight;
      const scrolled = (winScroll / height) * 100;
      document.getElementById('readingProgressBar').style.width = scrolled + "%";
    };
  }

  const fragment = document.createDocumentFragment();
  let currentGroup = null;

  posts.slice(0, visibleCount).forEach(post => {
    const group = groupLabel(post.date);
    if (group !== currentGroup) {
      currentGroup = group;
      const lbl = document.createElement('div');
      lbl.className = 'date-group-label';
      lbl.textContent = group;
      fragment.appendChild(lbl);
    }

    const card = document.createElement('div');
    card.className = 'post-card';
    card.innerHTML = `
      <div class="post-header">
        <div class="post-header-left">
          <div class="post-title">${esc(post.title)} <span class="post-date">• ${fmtShort(post.date)}</span></div>
          <div class="post-excerpt-preview">${esc(truncate(post.excerpt, 80))}</div>
        </div>
        <span class="post-arrow">▼</span>
      </div>
      <div class="post-body">
        <div class="post-body-inner">
          <p>${esc(truncate(post.excerpt, 160))}</p>
          <button class="read-full-doc-btn">Read full post →</button>
        </div>
      </div>`;

    card.querySelector('.post-header').onclick = () => {
      const open = card.classList.contains('open');
      document.querySelectorAll('.post-card.open').forEach(c => c.classList.remove('open'));
      if (!open) card.classList.add('open');
    };
    card.querySelector('.read-full-doc-btn').onclick = e => { e.stopPropagation(); openPostOverlay(post); };
    fragment.appendChild(card);
  });

  if (posts.length > visibleCount) {
    const wrap = document.createElement('div');
    wrap.className = 'show-more-container';
    const btn = document.createElement('button');
    btn.className = 'show-more-btn';
    btn.textContent = 'Show more';
    btn.onclick = () => renderPosts(posts, list, status, visibleCount + 5);
    wrap.appendChild(btn);
    fragment.appendChild(wrap);
  }

  list.appendChild(fragment);
  if (status) status.textContent = '';
}

function openPostOverlay(post) {
  const ov = document.getElementById('postFullscreenOverlay');
  if (!ov) return;

  let metaText = fmtFull(post.date);
  if (post.author) metaText += ` • By ${post.author}`;
  metaText += ` • ${post.readingTime}`;
  document.getElementById('postFullscreenDate').textContent = metaText;
  document.getElementById('postFullscreenTitle').textContent = post.title;
  document.getElementById('postFullscreenBody').innerHTML = post.bodyHtml;

  if (window.Prism) Prism.highlightAllUnder(document.getElementById('postFullscreenBody'));

  const linkContainer = document.getElementById('postFullscreenLinkContainer');
  linkContainer.innerHTML = '';
  const shareBtn = document.createElement('button');
  shareBtn.className = 'project-fullscreen-link-btn';
  shareBtn.innerHTML = '<span>🔗</span> SHARE POST';
  shareBtn.onclick = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('post', post.slug);
    navigator.clipboard.writeText(url.toString());
    shareBtn.innerHTML = '<span>✅</span> Copied!';
    setTimeout(() => { shareBtn.innerHTML = '<span>🔗</span> SHARE POST'; }, 2000);
  };
  linkContainer.appendChild(shareBtn);

  const related = getRelatedPosts(post);
  const relContainer = document.getElementById('relatedPostsContainer');
  if (related.length) {
    relContainer.innerHTML = `<div class="related-posts"><h4>Related Posts</h4><div class="related-grid">${related.map(r => `<div class="related-card" onclick="event.stopPropagation(); openPostOverlayBySlug('${r.slug}')"><h5>${esc(r.title)}</h5><p>${fmtShort(r.date)}</p></div>`).join('')}</div></div>`;
  } else {
    relContainer.innerHTML = `<div class="related-posts"><h4>Related Posts</h4><p style="color: #888; font-style: italic;">No more related posts</p></div>`;
  }

  const recent = allPosts.filter(p => p.slug !== post.slug).slice(0, 3);
  const recentContainer = document.getElementById('mostRecentContainer');
  if (recent.length) {
    recentContainer.innerHTML = `<div class="related-posts" style="margin-top: 20px; border-top: none;"><h4>Most Recent</h4><div class="related-grid">${recent.map(r => `<div class="related-card" onclick="event.stopPropagation(); openPostOverlayBySlug('${r.slug}')"><h5>${esc(r.title)}</h5><p>${fmtShort(r.date)}</p></div>`).join('')}</div></div>`;
  } else {
    recentContainer.innerHTML = '';
  }

  ov.classList.add('active');
  document.body.style.overflow = 'hidden';
  ov.querySelector('.project-fullscreen-content').scrollTop = 0;
}

function openPostOverlayBySlug(slug) {
  const post = allPosts.find(p => p.slug === slug);
  if (post) openPostOverlay(post);
}

function closePostOverlay() {
  const ov = document.getElementById('postFullscreenOverlay');
  if (ov) ov.classList.remove('active');
  document.body.style.overflow = '';
}

function handleSharedPostLink(posts) {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('post');
  if (slug) {
    const post = posts.find(p => p.slug === slug);
    if (post) openPostOverlay(post);
  }
}

function setupRSSFeed(posts) {
  const rssLink = document.getElementById('rssLink');
  if (!rssLink) return;
  const xml = generateRSS(posts);
  const blob = new Blob([xml], { type: 'application/rss+xml' });
  rssLink.href = URL.createObjectURL(blob);
}

function generateRSS(posts) {
  const baseUrl = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '');
  let items = '';
  posts.slice(0, 10).forEach(p => {
    items += `<item><title>${escXML(p.title)}</title><link>${baseUrl}?post=${p.slug}</link><guid>${baseUrl}?post=${p.slug}</guid><pubDate>${new Date(p.date).toUTCString()}</pubDate><description>${escXML(p.excerpt)}</description></item>`;
  });
  return `<?xml version="1.0" encoding="UTF-8" ?><rss version="2.0"><channel><title>My Blog</title><link>${baseUrl}</link><description>Latest blog posts</description>${items}</channel></rss>`;
}

function parseDate(s) {
  if (!s) return null;
  let dateStr = String(s);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) dateStr += 'T00:00:00';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function fmtShort(s) {
  const d = parseDate(s);
  return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : s;
}

function fmtFull(s) {
  const d = parseDate(s);
  return d ? d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : s;
}

function groupLabel(s) {
  const d = parseDate(s);
  return d ? d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : (s || 'Undated');
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escXML(s) { return esc(s).replace(/'/g, '&apos;'); }

function truncate(text, max) {
  if (!text || text.length <= max) return text || '';
  const cut = text.lastIndexOf(' ', max);
  return text.slice(0, cut > 0 ? cut : max);
}
