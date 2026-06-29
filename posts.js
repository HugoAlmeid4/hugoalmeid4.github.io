// ─── CONFIG ──────────────────────────────────────────────────────────────────
// Local blog posts – reads posts/index.json then fetches each .md file.
// ─────────────────────────────────────────────────────────────────────────────

let allPosts = [];
let activeFilterTags = [];
let currentLanguage = 'en';
let translatedCache = {};
let translatedTagsCache = {};
let searchDebounceTimer = null;

async function getTranslatedTag(tag, targetLang) {
  if (targetLang === 'en' || !tag) return tag;
  const cacheKey = `${tag}_${targetLang}`;
  if (translatedTagsCache[cacheKey]) return translatedTagsCache[cacheKey];
  const translated = await translateText(tag, targetLang);
  translatedTagsCache[cacheKey] = translated;
  return translated;
}

// ── Translation strings for UI ───────────────────────────────────────────────
const translations = {
  en: {
    loadingPosts: 'Loading posts...',
    noPostsFound: 'No valid posts found.',
    errorLoading: 'Error loading posts. Check if posts/index.json exists.',
    jekyllError: 'If you are on GitHub Pages, make sure to add a .nojekyll file to your root folder.',
    searchPlaceholder: 'Search posts...',
    filterBtn: 'Filters',
    filterByTags: 'Filter by Tags',
    allPosts: 'All Posts',
    done: 'Done',
    relatedPosts: 'Related Posts',
    noMoreRelated: 'No more related posts',
    mostRecent: 'Most Recent',
    sharePost: 'SHARE POST',
    copied: 'Copied!',
    minRead: 'min read',
    readFullPost: 'Read full post →',
    showMore: 'Show more',
    translating: 'Translating...',
    accuracyWarningTitle: 'Translation Accuracy',
    accuracyWarningText: 'Please note that translations are automatically generated and may not be 100% accurate compared to the original English content.',
    gotIt: 'Got it',
    viewAllArchive: 'View Archive',
    backToHome: 'Back to Home',
    archiveTitle: 'Post Archive'
  },
  pt: {
    loadingPosts: 'A carregar posts...',
    noPostsFound: 'Nenhum post válido encontrado.',
    errorLoading: 'Erro ao carregar posts. Verifique se posts/index.json existe.',
    jekyllError: 'Se estiver no GitHub Pages, certifique-se de adicionar um ficheiro .nojekyll na pasta raiz.',
    searchPlaceholder: 'Pesquisar posts...',
    filterBtn: 'Filtros',
    filterByTags: 'Filtrar por Tags',
    allPosts: 'Todos os Posts',
    done: 'Concluído',
    relatedPosts: 'Posts Relacionados',
    noMoreRelated: 'Nenhum post relacionado',
    mostRecent: 'Mais Recentes',
    sharePost: 'PARTILHAR POST',
    copied: 'Copiado!',
    minRead: 'min de leitura',
    readFullPost: 'Ler post completo →',
    showMore: 'Mostrar mais',
    translating: 'A traduzir...',
    accuracyWarningTitle: 'Precisão da Tradução',
    accuracyWarningText: 'Por favor, note que as traduções são geradas automaticamente e podem não ser 100% precisas em comparação com o conteúdo original em inglês.',
    gotIt: 'Entendi',
    viewAllArchive: 'Ver Arquivo',
    backToHome: 'Voltar ao Início',
    archiveTitle: 'Arquivo de Posts'
  },
  es: {
    loadingPosts: 'Cargando posts...',
    noPostsFound: 'No se encontraron posts válidos.',
    errorLoading: 'Error al cargar posts. Verifica si posts/index.json existe.',
    jekyllError: 'Si estás en GitHub Pages, asegúrate de agregar un archivo .nojekyll en la barra raíz.',
    searchPlaceholder: 'Buscar posts...',
    filterBtn: 'Filtros',
    filterByTags: 'Filtrar por Etiquetas',
    allPosts: 'Todos los Posts',
    done: 'Hecho',
    relatedPosts: 'Posts Relacionados',
    noMoreRelated: 'No hay posts relacionados',
    mostRecent: 'Más Recientes',
    sharePost: 'COMPARTIR POST',
    copied: '¡Copiado!',
    minRead: 'min de lectura',
    readFullPost: 'Leer post completo →',
    showMore: 'Mostrar más',
    translating: 'Traduciendo...',
    accuracyWarningTitle: 'Precisión de la Traducción',
    accuracyWarningText: 'Ten en cuenta que las traducciones se generan automáticamente y pueden no ser 100% precisas en comparación com el contenido original en inglés.',
    gotIt: 'Entendido',
    viewAllArchive: 'Ver Archivo',
    backToHome: 'Voltar ao Início',
    archiveTitle: 'Arquivo de Posts'
  }
};

function t(key) {
  return (translations[currentLanguage] && translations[currentLanguage][key]) || translations['en'][key] || key;
}

document.addEventListener('DOMContentLoaded', () => {
  const savedLang = localStorage.getItem('blogLanguage');
  if (savedLang && translations[savedLang]) currentLanguage = savedLang;
  loadPosts();
  setupLanguageSwitcher();
});

function setupLanguageSwitcher(containerId = 'languageSwitcher') {
  const target = document.getElementById(containerId) || document.querySelector('.Posts-Section');
  if (!target) return;

  const langHTML = `
    <div class="language-switcher">
      <button class="lang-btn lang-btn-en ${currentLanguage === 'en' ? 'active' : ''}" onclick="changeLanguage('en')">EN</button>
      <button class="lang-btn lang-btn-pt ${currentLanguage === 'pt' ? 'active' : ''}" onclick="changeLanguage('pt')">PT</button>
      <button class="lang-btn lang-btn-es ${currentLanguage === 'es' ? 'active' : ''}" onclick="changeLanguage('es')">ES</button>
    </div>
  `;

  if (containerId === 'languageSwitcher') {
    const h2 = target.querySelector('h2');
    if (h2) {
      const existing = target.querySelector('.language-switcher');
      if (existing) existing.remove();
      const div = document.createElement('div');
      div.innerHTML = langHTML;
      h2.before(div.firstElementChild);
    }
  } else {
    target.innerHTML = langHTML;
  }
}

async function changeLanguage(lang) {
  if (currentLanguage === lang) return;
  if (lang !== 'en' && !localStorage.getItem('translationWarningSeen')) {
    showTranslationWarning(lang);
    return;
  }
  await executeLanguageChange(lang);
}

async function executeLanguageChange(lang) {
  currentLanguage = lang;
  localStorage.setItem('blogLanguage', lang);

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.trim().toLowerCase() === lang);
  });

  const searchInput = document.getElementById('postSearchInput');
  if (searchInput) searchInput.placeholder = t('searchPlaceholder');

  const popupTitle = document.querySelector('#postTagPopup h4');
  const popupCloseBtn = document.getElementById('closeTagPopup');
  if (popupTitle) popupTitle.textContent = t('filterByTags');
  if (popupCloseBtn) popupCloseBtn.textContent = t('done');

  const archiveTitle = document.getElementById('archiveTitle');
  if (archiveTitle) archiveTitle.textContent = t('archiveTitle');
  const backBtn = document.getElementById('backToHomeBtn');
  if (backBtn) backBtn.textContent = `← ${t('backToHome')}`;
  const archiveBtn = document.getElementById('archiveBtn');
  if (archiveBtn) archiveBtn.textContent = t('viewAllArchive');

  await filterAndRender();

  const params = new URLSearchParams(window.location.search);
  const openPostSlug = params.get('post');
  if (openPostSlug) {
    const post = allPosts.find(p => p.slug === openPostSlug);
    if (post) openPostOverlay(post);
  }
}

function showTranslationWarning(targetLang) {
  const overlay = document.createElement('div');
  overlay.id = 'translationWarningOverlay';
  overlay.className = 'tag-popup';
  overlay.style.zIndex = '5000';
  overlay.innerHTML = `
    <div class="tag-popup-content" style="max-width:400px;">
      <h4 style="margin-bottom:15px;">${t('accuracyWarningTitle')}</h4>
      <p style="font-size:14px;line-height:1.6;margin-bottom:25px;opacity:0.8;">${t('accuracyWarningText')}</p>
      <button class="close-popup-btn" id="confirmWarningBtn">${t('gotIt')}</button>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('active'));
  document.body.style.overflow = 'hidden';

  document.getElementById('confirmWarningBtn').onclick = () => {
    localStorage.setItem('translationWarningSeen', 'true');
    overlay.classList.remove('active');
    setTimeout(() => {
      overlay.remove();
      document.body.style.overflow = '';
      executeLanguageChange(targetLang);
    }, 300);
  };
}

// ── Translation Logic ────────────────────────────────────────────────────────

async function translateText(text, targetLang) {
  if (targetLang === 'en' || !text.trim()) return text;
  const targetCode = targetLang === 'pt' ? 'pt-PT' : targetLang;
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetCode}&dt=t&q=${encodeURIComponent(text)}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return (data && data[0]) ? data[0].map(x => x[0]).join('') : text;
  } catch { return text; }
}

async function translateHtml(html, targetLang) {
  if (targetLang === 'en' || !html.trim()) return html;
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  const textNodes = [];
  function findTextNodes(node) {
    if (node.nodeType === 3 && node.textContent.trim().length > 1) {
      textNodes.push(node);
    } else {
      for (const child of node.childNodes) {
        const n = child.nodeName;
        if (n !== 'CODE' && n !== 'PRE' && n !== 'SCRIPT' && n !== 'STYLE') findTextNodes(child);
      }
    }
  }
  findTextNodes(tempDiv);
  const CHUNK_SIZE = 15;
  for (let i = 0; i < textNodes.length; i += CHUNK_SIZE) {
    const chunk = textNodes.slice(i, i + CHUNK_SIZE);
    await Promise.all(chunk.map(async node => { node.textContent = await translateText(node.textContent, targetLang); }));
  }
  return tempDiv.innerHTML;
}

async function getTranslatedPost(post, targetLang) {
  if (targetLang === 'en') return post;
  const cacheKey = `${post.slug}_${targetLang}`;
  if (translatedCache[cacheKey]) return { ...post, ...translatedCache[cacheKey] };
  const [translatedTitle, translatedExcerpt] = await Promise.all([
    translateText(post.title, targetLang),
    translateText(post.excerpt, targetLang)
  ]);
  translatedCache[cacheKey] = { title: translatedTitle, excerpt: translatedExcerpt, bodyHtml: post.bodyHtml };
  return { ...post, ...translatedCache[cacheKey] };
}

// ── Core Functions ───────────────────────────────────────────────────────────

async function loadPosts() {
  const list = document.getElementById('postsList');
  const status = document.getElementById('postsStatus');
  if (status) status.textContent = t('loadingPosts');
  injectSearchUI();
  injectArchiveUI();

  try {
    const res = await fetch('posts/index.json');
    if (!res.ok) throw new Error('Could not find posts/index.json');
    const fileList = await res.json();
    const uniqueFileList = [...new Set(fileList)];

    const postPromises = uniqueFileList.map(async filename => {
      try {
        const r = await fetch(`posts/${filename}`);
        if (!r.ok) return null;
        const mdText = await r.text();
        const { metadata, content } = parseFrontmatter(mdText);
        const bodyHtml = parseMarkdown(content);
        const slug = filename.replace(/\.md$/, '');
        const cleanText = content
          .replace(/!\[\[.*?\]\]/g, '')
          .replace(/!\[.*?\]\(.*?\)/g, '')
          .replace(/[#*`_|~>]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        const mins = Math.ceil(cleanText.split(/\s+/).length / 200);
        return {
          slug,
          title: metadata.title || slug.replace(/-/g, ' '),
          date: metadata.date || new Date().toISOString().slice(0, 10),
          excerpt: metadata.excerpt || (cleanText.slice(0, 180) + '...'),
          readingTime: `${mins} min read`,
          author: metadata.author || '',
          tags: metadata.tags ? metadata.tags.split(',').map(s => s.trim()) : [],
          bodyHtml,
          filename
        };
      } catch { return null; }
    });

    const results = await Promise.all(postPromises);
    const seenSlugs = new Set();
    allPosts = results
      .filter(p => {
        if (!p || seenSlugs.has(p.slug)) return false;
        seenSlugs.add(p.slug);
        return true;
      })
      .sort((a, b) => parseDate(b.date) - parseDate(a.date));

    localStorage.setItem('posts_cache', JSON.stringify({ data: allPosts }));
    setupRSSFeed(allPosts);
    renderPosts(allPosts, list, status);
    handleSharedPostLink(allPosts);
  } catch (err) {
    console.error('Error loading posts:', err);
    if (status) status.textContent = `${t('errorLoading')} ${t('jekyllError')}`;
  }
}

function parseFrontmatter(mdContent) {
  const fmMatch = mdContent.match(/^---\r?\n([\s\S]+?)\r?\n---[ \t]*\r?\n?/);
  if (!fmMatch) return { metadata: {}, content: mdContent };
  const metadata = {};
  fmMatch[1].split('\n').forEach(line => {
    const colon = line.indexOf(':');
    if (colon > 0) metadata[line.slice(0, colon).trim()] = line.slice(colon + 1).trim().replace(/^['"]|['"]$/g, '');
  });
  return { metadata, content: mdContent.slice(fmMatch[0].length) };
}

function parseMarkdown(md) { return linkifyRawUrls(parseLines(md.split('\n'))); }

function parseLines(lines) {
  const out = [];
  let inUL = false, inCodeBlock = false, codeLang = '', codeLines = [];
  let tableHeaderCells = null, tableRowsBuffer = [];

  const flushTable = () => {
    if (tableHeaderCells) out.push(renderTable(tableHeaderCells, tableRowsBuffer));
    tableHeaderCells = null;
    tableRowsBuffer = [];
  };
  const flushList = () => {
    if (inUL) { out.push('</ul>'); inUL = false; }
  };

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      flushList(); flushTable();
      if (inCodeBlock) {
        inCodeBlock = false;
        out.push(`<pre><code class="language-${codeLang}">${esc(codeLines.join('\n'))}</code></pre>`);
        codeLines = [];
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
      if (cells.every(c => /^:?-+:?$/.test(c))) continue;
      if (tableHeaderCells === null) tableHeaderCells = cells;
      else tableRowsBuffer.push(cells);
      continue;
    }
    if (tableHeaderCells !== null) flushTable();
    if (trimmed === '') { flushList(); continue; }

    const hMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (hMatch) { flushList(); out.push(`<h${hMatch[1].length}>${parseInline(hMatch[2])}</h${hMatch[1].length}>`); continue; }

    const liMatch = line.match(/^[ \t]*[-*+]\s+(.*)/);
    if (liMatch) {
      if (!inUL) { out.push('<ul>'); inUL = true; }
      out.push(`<li>${parseInline(liMatch[1])}</li>`);
      continue;
    }
    flushList();
    out.push(`<p class="scroll-reveal">${parseInline(line)}</p>`);
  }
  flushList(); flushTable();
  return out.join('\n');
}

function renderTable(headers, rows) {
  let h = '<div class="data-log-container scroll-reveal"><table class="data-log-table"><thead><tr>';
  headers.forEach(c => { h += `<th>${parseInline(c)}</th>`; });
  h += '</tr></thead><tbody>';
  rows.forEach(row => { h += '<tr>'; row.forEach(c => { h += `<td>${parseInline(c)}</td>`; }); h += '</tr>'; });
  return h + '</tbody></table></div>';
}

function parseInline(text) {
  const placeholders = [];
  text = text.replace(/`([^`]+)`/g, (_, code) => {
    const id = `\uFFFC${placeholders.length}\uFFFC`;
    placeholders.push(`<code>${esc(code)}</code>`);
    return id;
  });
  text = text.replace(/!\[\[([^\]|]+?)\|([^\]|]+?)\]\]/g, (match, light, dark) => {
    if (/^\d+$/.test(dark.trim())) return match;
    const id = `\uFFFC${placeholders.length}\uFFFC`;
    const enc = s => s.trim().startsWith('http') ? s.trim() : `posts/${s.trim()}`;
    const lSrc = enc(light).split('/').map((s, i) => i === 0 ? s : encodeURIComponent(s)).join('/');
    const dSrc = enc(dark).split('/').map((s, i) => i === 0 ? s : encodeURIComponent(s)).join('/');
    placeholders.push(`<picture class="theme-aware-img scroll-reveal"><source srcset="${dSrc}" media="(prefers-color-scheme: dark)"><img src="${lSrc}" class="zoomable-img" style="max-width:100%;height:auto;display:inline-block;vertical-align:middle;margin:6px 4px;cursor:zoom-in;"></picture>`);
    return id;
  });
  text = text.replace(/!\[\[([^\]|]+?)(?:\|(\d+))?\]\]/g, (_, fname, w) => {
    const id = `\uFFFC${placeholders.length}\uFFFC`;
    const src = /^https?:\/\//.test(fname.trim()) ? fname.trim() : `posts/${fname.trim()}`;
    const enc = src.split('/').map((s, i) => i === 0 ? s : encodeURIComponent(s)).join('/');
    const dims = w
      ? `style="max-width:min(100%, ${w}px);width:100%;height:auto;display:inline-block;vertical-align:middle;margin:6px 4px;cursor:zoom-in;"`
      : `style="max-width:100%;height:auto;display:inline-block;vertical-align:middle;margin:6px 4px;cursor:zoom-in;"`;
    placeholders.push(`<img src="${enc}" class="zoomable-img scroll-reveal" ${dims} alt="${esc(fname.trim())}">`);
    return id;
  });
  text = text.replace(/!\[([^\]) ]*)\]\(([^)]+)\)/g, (_, alt, url) => {
    const id = `\uFFFC${placeholders.length}\uFFFC`;
    const src = /^https?:\/\//.test(url.trim()) || url.trim().startsWith('/') ? url.trim() : `posts/${url.trim()}`;
    const enc = src.split('/').map((s, i) => i === 0 ? s : encodeURIComponent(s)).join('/');
    placeholders.push(`<img src="${enc}" class="zoomable-img scroll-reveal" style="max-width:100%;height:auto;display:inline-block;vertical-align:middle;margin:6px 4px;cursor:zoom-in;" alt="${esc(alt)}">`);
    return id;
  });
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+(?:\([^\s)]*\)[^\s)]*)*)\)/g, (_, linkText, url) => {
    const id = `\uFFFC${placeholders.length}\uFFFC`;
    placeholders.push(`<a href="${url}" target="_blank" rel="noopener">${parseInlineRecursive(linkText)}</a>`);
    return id;
  });
  text = text.replace(/(^|[^\w])(\*\*|__)(?=\S)(.+?)(?<=\S)\2(?=[^\w]|$)/g, '$1<strong>$3</strong>');
  text = text.replace(/(^|[^\w])(\*|_)(?=\S)(.+?)(?<=\S)\2(?=[^\w]|$)/g, '$1<em>$3</em>');
  for (let i = 0; i < placeholders.length; i++) text = text.split(`\uFFFC${i}\uFFFC`).join(placeholders[i]);
  return text;
}

function parseInlineRecursive(text) {
  text = text.replace(/(^|[^\w])(\*\*|__)(?=\S)(.+?)(?<=\S)\2(?=[^\w]|$)/g, '$1<strong>$3</strong>');
  text = text.replace(/(^|[^\w])(\*|_)(?=\S)(.+?)(?<=\S)\2(?=[^\w]|$)/g, '$1<em>$3</em>');
  return text.replace(/`([^`]+)`/g, '<code>$1</code>');
}

function linkifyRawUrls(html) {
  return html.replace(
    /(<a\s[^>]+>[\s\S]*?<\/a>)|(<img\s[^>]+>)|(https?:\/\/[^\s<"']+(?:\([^\s<"']*\)[^\s<"']*)*)/g,
    (m, aTag, imgTag, url) => {
      if (aTag || imgTag) return m;
      const clean = url.replace(/[.,;:!?)]+$/, '');
      return `<a href="${clean}" target="_blank" rel="noopener">${clean}</a>${url.slice(clean.length)}`;
    }
  );
}

// ── UI Components ────────────────────────────────────────────────────────────

function injectSearchUI() {
  if (document.getElementById('postSearchContainer')) return;
  const container = document.createElement('div');
  container.id = 'postSearchContainer';
  container.className = 'search-container';
  container.innerHTML = `
    <div class="search-bar-wrapper">
      <input type="text" id="postSearchInput" placeholder="${t('searchPlaceholder')}" aria-label="Search posts">
      <button id="postFilterBtn" class="filter-toggle-btn">${t('filterBtn')}</button>
      <button id="archiveBtn" class="filter-toggle-btn archive-toggle-btn">${t('viewAllArchive')}</button>
    </div>
    <div id="postTagPopup" class="tag-popup">
      <div class="tag-popup-content">
        <h4>${t('filterByTags')}</h4>
        <div id="postTagFilters" class="tag-filters"></div>
        <button id="closeTagPopup" class="close-popup-btn">${t('done')}</button>
      </div>
    </div>
  `;

  const section = document.querySelector('.Posts-Section');
  if (section) {
    const h2 = section.querySelector('h2');
    if (h2) h2.after(container);
  }

  const searchInput = document.getElementById('postSearchInput');
  if (searchInput) {
    searchInput.addEventListener('focus', () => {
      if (window.innerWidth <= 768) {
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
    searchInput.addEventListener('input', () => {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => filterAndRender(), 150);
    });
  }

  const filterBtn = document.getElementById('postFilterBtn');
  if (filterBtn) {
    filterBtn.onclick = () => {
      updateTagFilters();
      const popup = document.getElementById('postTagPopup');
      if (popup) {
        popup.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    };
  }

  const closeBtn = document.getElementById('closeTagPopup');
  if (closeBtn) closeBtn.onclick = closeTagPopup;

  const popup = document.getElementById('postTagPopup');
  if (popup) {
    popup.addEventListener('click', e => {
      if (e.target === popup) closeTagPopup();
    });
  }

  const archiveBtn = document.getElementById('archiveBtn');
  if (archiveBtn) archiveBtn.onclick = () => openArchive();
}

function closeTagPopup() {
  const popup = document.getElementById('postTagPopup');
  if (popup) popup.classList.remove('active');
  document.body.style.overflow = '';
}

function injectArchiveUI() {
  if (document.getElementById('postArchiveOverlay')) return;
  const ov = document.createElement('div');
  ov.id = 'postArchiveOverlay';
  ov.className = 'archive-overlay';
  ov.innerHTML = `
    <div class="archive-content">
      <div class="archive-header">
        <button id="backToHomeBtn" class="back-btn">← ${t('backToHome')}</button>
        <h2 id="archiveTitle">${t('archiveTitle')}</h2>
      </div>
      <div id="archiveList" class="archive-list"></div>
    </div>
  `;
  document.body.appendChild(ov);
  const backBtn = document.getElementById('backToHomeBtn');
  if (backBtn) backBtn.onclick = closeArchive;
}

function openArchive() {
  const ov = document.getElementById('postArchiveOverlay');
  const list = document.getElementById('archiveList');
  if (!ov || !list) return;
  list.innerHTML = '';
  const fragment = document.createDocumentFragment();
  allPosts.forEach(post => {
    const item = document.createElement('div');
    item.className = 'archive-item scroll-reveal';
    item.innerHTML = `<span class="archive-date">${fmtShort(post.date)}</span><span class="archive-post-title">${esc(post.title)}</span>`;
    item.onclick = () => { closeArchive(); openPostOverlay(post); };
    fragment.appendChild(item);
  });
  list.appendChild(fragment);
  ov.classList.add('active');
  document.body.style.overflow = 'hidden';
  setTimeout(() => handleScrollReveal(ov), 100);
}

function closeArchive() {
  const ov = document.getElementById('postArchiveOverlay');
  if (ov) ov.classList.remove('active');
  document.body.style.overflow = '';
}

async function filterAndRender() {
  const searchInput = document.getElementById('postSearchInput');
  const query = searchInput ? searchInput.value.toLowerCase() : '';
  const list = document.getElementById('postsList');
  const status = document.getElementById('postsStatus');

  const filtered = allPosts.filter(p => {
    const matchesSearch = !query || p.title.toLowerCase().includes(query) || p.excerpt.toLowerCase().includes(query);
    const matchesTags = activeFilterTags.length === 0 || activeFilterTags.every(tag => p.tags.includes(tag));
    return matchesSearch && matchesTags;
  });

  renderPosts(filtered, list, status, 100);

  const filterBtn = document.getElementById('postFilterBtn');
  if (filterBtn) {
    if (activeFilterTags.length > 0) {
      filterBtn.classList.add('filtering');
      filterBtn.textContent = `Tags (${activeFilterTags.length})`;
    } else {
      filterBtn.classList.remove('filtering');
      filterBtn.textContent = t('filterBtn');
    }
  }
}

async function updateTagFilters() {
  const tagContainer = document.getElementById('postTagFilters');
  if (!tagContainer) return;
  const allTags = [...new Set(allPosts.flatMap(p => p.tags))];
  tagContainer.innerHTML = '';

  const fragment = document.createDocumentFragment();

  const allBtn = document.createElement('button');
  allBtn.className = `tag-btn ${activeFilterTags.length === 0 ? 'active' : ''}`;
  allBtn.textContent = t('allPosts');
  allBtn.onclick = (e) => {
    e.stopPropagation();
    activeFilterTags = [];
    filterAndRender();
    updateTagFilters();
  };
  fragment.appendChild(allBtn);

  for (const tag of allTags) {
    const btn = document.createElement('button');
    const isActive = activeFilterTags.includes(tag);
    btn.className = `tag-btn ${isActive ? 'active' : ''}`;
    btn.textContent = await getTranslatedTag(tag, currentLanguage);
    btn.onclick = (e) => {
      e.stopPropagation();
      if (activeFilterTags.includes(tag)) {
        activeFilterTags = activeFilterTags.filter(t => t !== tag);
      } else {
        activeFilterTags.push(tag);
      }
      filterAndRender();
      updateTagFilters();
    };
    fragment.appendChild(btn);
  }

  tagContainer.appendChild(fragment);
}

function getRelatedPosts(currentPost) {
  if (!currentPost.tags.length) return [];
  return allPosts
    .filter(p => p.slug !== currentPost.slug)
    .map(p => ({ ...p, score: p.tags.filter(tag => currentPost.tags.includes(tag)).length }))
    .filter(p => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

async function renderPosts(posts, list, status, visibleCount = 3) {
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
        <div id="overlayLangSwitcher"></div>
        <div class="project-fullscreen-type" id="postFullscreenDate"></div>
        <h2 class="project-fullscreen-title" id="postFullscreenTitle"></h2>
        <div class="project-fullscreen-body" id="postFullscreenBody"></div>
        <div id="translationLoader" class="translation-loader" style="display:none;">
          <div class="spinner"></div>
          <p id="translationLoaderText"></p>
        </div>
        <div class="project-fullscreen-link-container" id="postFullscreenLinkContainer"></div>
        <div class="post-newsletter-container">
          <h4>Subscribe to the Newsletter</h4>
          <p>Get notified when new astrophotography captures or articles are published.</p>
          <form action="https://api.follow.it/subscription-form/VU1HMHpxOXhQM3hCL3pTYzhOVDlySHBJVnNGUlMwRDE3NHVmaFV2elBxS0VMSTJJaTdqcTFVbzV5NHVFcFlFUllMTUsxdFJQQ0FmWTBxcnZadDhQRkw3bmgrdmpMM041Q1c5Y3VLVVM4RUljT3JiOWl2MkZxUXdiOG9EUDROcWl8ZnFCemxZNDlNRnJRQ2VMRWh4UE1sYW8rMXZZMzd4TEc5YW5FUjBMRmVqND0=/8" method="post" target="_blank" class="newsletter-form">
            <input type="email" name="email" placeholder="email@example.com" required aria-label="Email address">
            <button type="submit" class="newsletter-btn">Subscribe</button>
          </form>
        </div>
        <div id="relatedPostsContainer"></div>
        <div id="mostRecentContainer"></div>
      </div>
    `;
    document.body.appendChild(ov);
    const closeBtn = document.getElementById('postFullscreenClose');
    if (closeBtn) closeBtn.onclick = e => { e.preventDefault(); e.stopPropagation(); closePostOverlay(); };
    ov.onclick = e => { if (e.target === ov) closePostOverlay(); };
    const content = ov.querySelector('.project-fullscreen-content');
    if (content) {
      let ticking = false;
      content.onscroll = () => {
        if (!ticking) {
          window.requestAnimationFrame(() => {
            const bar = document.getElementById('readingProgressBar');
            if (bar) bar.style.width = (content.scrollTop / (content.scrollHeight - content.clientHeight)) * 100 + '%';
            handleScrollReveal(content);
            ticking = false;
          });
          ticking = true;
        }
      };
    }
  }

  const fragment = document.createDocumentFragment();
  let currentGroup = null;

  for (const post of posts.slice(0, visibleCount)) {
    const tp = await getTranslatedPost(post, currentLanguage);
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
          <div class="post-title">${esc(tp.title)} <span class="post-date">• ${fmtShort(post.date)}</span></div>
          <div class="post-excerpt-preview">${esc(truncate(tp.excerpt, 80))}</div>
        </div>
        <span class="post-arrow">▼</span>
      </div>
      <div class="post-body">
        <div class="post-body-inner">
          <p>${esc(truncate(tp.excerpt, 160))}</p>
          <button class="read-full-doc-btn">${t('readFullPost')}</button>
        </div>
      </div>
    `;
    const header = card.querySelector('.post-header');
    if (header) {
      header.onclick = () => {
        const open = card.classList.contains('open');
        document.querySelectorAll('.post-card.open').forEach(c => c.classList.remove('open'));
        if (!open) card.classList.add('open');
      };
    }
    const readBtn = card.querySelector('.read-full-doc-btn');
    if (readBtn) readBtn.onclick = e => { e.stopPropagation(); openPostOverlay(post); };
    fragment.appendChild(card);
  }

  if (posts.length > visibleCount) {
    const btn = document.createElement('button');
    btn.className = 'show-more-btn';
    btn.textContent = t('showMore');
    btn.onclick = () => renderPosts(posts, list, status, visibleCount + 5);
    const wrap = document.createElement('div');
    wrap.className = 'show-more-container';
    wrap.appendChild(btn);
    fragment.appendChild(wrap);
  }

  list.appendChild(fragment);
  if (status) status.textContent = posts.length === 0 ? t('noPostsFound') : '';
}

function handleScrollReveal(container) {
  const elements = container.querySelectorAll('.scroll-reveal:not(.active)');
  const triggerBottom = container.clientHeight * 0.95;
  const containerRect = container.getBoundingClientRect();
  elements.forEach(el => {
    if (el.getBoundingClientRect().top - containerRect.top < triggerBottom) {
      el.classList.add('active');
    }
  });
}

function setupRollerScroll(containerEl) {
  const roller = containerEl.querySelector('.recent-posts-roller');
  const leftArrow = containerEl.querySelector('.roller-arrow-left');
  const rightArrow = containerEl.querySelector('.roller-arrow-right');
  if (!roller || !leftArrow || !rightArrow) return;

  const getScrollAmount = () => {
    const card = roller.querySelector('.recent-post-card');
    return card ? card.offsetWidth + 16 : roller.clientWidth / 3;
  };

  leftArrow.onclick = e => { e.stopPropagation(); roller.scrollBy({ left: -getScrollAmount(), behavior: 'smooth' }); };
  rightArrow.onclick = e => { e.stopPropagation(); roller.scrollBy({ left: getScrollAmount(), behavior: 'smooth' }); };
}

async function openPostOverlay(post) {
  const ov = document.getElementById('postFullscreenOverlay');
  if (!ov) return;

  const url = new URL(window.location.href);
  url.searchParams.set('post', post.slug);
  window.history.replaceState({}, '', url);

  setupLanguageSwitcher('overlayLangSwitcher');

  const titleEl = document.getElementById('postFullscreenTitle');
  const bodyEl = document.getElementById('postFullscreenBody');
  const dateEl = document.getElementById('postFullscreenDate');
  const loader = document.getElementById('translationLoader');
  const loaderText = document.getElementById('translationLoaderText');

  if (dateEl) dateEl.textContent = `${fmtFull(post.date)}${post.author ? ' • By ' + post.author : ''} • ${post.readingTime}`;

  const tp = await getTranslatedPost(post, currentLanguage);
  if (titleEl) titleEl.textContent = tp.title;
  if (bodyEl) bodyEl.innerHTML = tp.bodyHtml;

  ov.classList.add('active');
  document.body.style.overflow = 'hidden';

  const content = ov.querySelector('.project-fullscreen-content');
  if (content) content.scrollTop = 0;

  const cacheKey = `${post.slug}_${currentLanguage}`;
  if (currentLanguage !== 'en' && (!translatedCache[cacheKey] || translatedCache[cacheKey].bodyHtml === post.bodyHtml)) {
    if (loader) loader.style.display = 'flex';
    if (loaderText) loaderText.textContent = t('translating');
    if (bodyEl) bodyEl.style.opacity = '0';
    const translatedBody = await translateHtml(post.bodyHtml, currentLanguage);
    translatedCache[cacheKey].bodyHtml = translatedBody;
    if (bodyEl) {
      bodyEl.innerHTML = translatedBody;
      bodyEl.style.opacity = '1';
    }
    if (loader) loader.style.display = 'none';
  } else {
    if (loader) loader.style.display = 'none';
    if (bodyEl) bodyEl.style.opacity = '1';
  }

  setupImageZoom();
  if (window.Prism) Prism.highlightAllUnder(bodyEl);

  const linkContainer = document.getElementById('postFullscreenLinkContainer');
  if (linkContainer) {
    linkContainer.innerHTML = '';
    const shareBtn = document.createElement('button');
    shareBtn.className = 'project-fullscreen-link-btn share-btn-animated';
    shareBtn.innerHTML = `<span>🔗</span> ${t('sharePost')}`;
    shareBtn.onclick = () => {
      navigator.clipboard.writeText(window.location.href);
      shareBtn.classList.add('clicked');
      shareBtn.innerHTML = `<span>✅</span> ${t('copied')}`;
      setTimeout(() => {
        shareBtn.classList.remove('clicked');
        shareBtn.innerHTML = `<span>🔗</span> ${t('sharePost')}`;
      }, 2000);
    };
    linkContainer.appendChild(shareBtn);
  }

  const related = getRelatedPosts(post);
  const relatedCards = await Promise.all(related.map(async r => {
    const rtp = await getTranslatedPost(r, currentLanguage);
    return `<div class="related-card" onclick="event.stopPropagation();openPostOverlayBySlug('${r.slug}')"><h5>${esc(rtp.title)}</h5><p>${fmtShort(r.date)}</p></div>`;
  }));
  const relContainer = document.getElementById('relatedPostsContainer');
  if (relContainer) {
    relContainer.innerHTML = `
      <div class="related-posts">
        <h4>${t('relatedPosts')}</h4>
        <div class="related-grid">
          ${relatedCards.length ? relatedCards.join('') : `<p style="color:#888;font-style:italic;">${t('noMoreRelated')}</p>`}
        </div>
      </div>
    `;
  }

  const recent = allPosts.filter(p => p.slug !== post.slug);
  const recentCards = await Promise.all(recent.map(async r => {
    const rtp = await getTranslatedPost(r, currentLanguage);
    return `
      <div class="recent-post-card" onclick="event.stopPropagation();openPostOverlayBySlug('${r.slug}')">
        <div class="recent-card-header">
          <span class="recent-card-date">${fmtShort(r.date)}</span>
          <h5 class="recent-card-title">${esc(rtp.title)}</h5>
        </div>
        <p class="recent-card-excerpt">${esc(truncate(rtp.excerpt, 100))}</p>
      </div>
    `;
  }));

  const showArrows = recent.length > 3;
  const recentContainer = document.getElementById('mostRecentContainer');
  if (recentContainer) {
    recentContainer.innerHTML = recent.length ? `
      <div class="related-posts" style="margin-top:20px;border-top:none;">
        <h4>${t('mostRecent')}</h4>
        <div class="recent-posts-roller-container ${showArrows ? 'has-arrows' : ''}">
          ${showArrows ? `<button class="roller-arrow roller-arrow-left" aria-label="Previous posts">◀</button>` : ''}
          <div class="recent-posts-roller">${recentCards.join('')}</div>
          ${showArrows ? `<button class="roller-arrow roller-arrow-right" aria-label="Next posts">▶</button>` : ''}
        </div>
      </div>
    ` : '';
    if (showArrows) setupRollerScroll(recentContainer);
  }

  setTimeout(() => handleScrollReveal(ov.querySelector('.project-fullscreen-content')), 100);
}

function closePostOverlay() {
  const ov = document.getElementById('postFullscreenOverlay');
  if (ov) ov.classList.remove('active');
  document.body.style.overflow = '';
  const url = new URL(window.location.href);
  url.searchParams.delete('post');
  window.history.replaceState({}, '', url);
}

function openPostOverlayBySlug(slug) {
  const post = allPosts.find(p => p.slug === slug);
  if (post) openPostOverlay(post);
}

function handleSharedPostLink(posts) {
  const slug = new URLSearchParams(window.location.search).get('post');
  if (slug) {
    const post = posts.find(p => p.slug === slug);
    if (post) openPostOverlay(post);
  }
}

function setupRSSFeed(posts) {
  const rssLink = document.getElementById('rssLink');
  if (!rssLink) return;
  rssLink.href = 'rss.xml';
}

function parseDate(s) {
  if (!s) return null;
  let ds = String(s);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ds)) ds += 'T00:00:00';
  const d = new Date(ds);
  return isNaN(d.getTime()) ? null : d;
}
function fmtShort(s) { const d = parseDate(s); return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : s; }
function fmtFull(s) { const d = parseDate(s); return d ? d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : s; }
function groupLabel(s) { const d = parseDate(s); return d ? d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : (s || 'Undated'); }
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function truncate(text, max) { if (!text || text.length <= max) return text || ''; const cut = text.lastIndexOf(' ', max); return text.slice(0, cut > 0 ? cut : max); }

function setupImageZoom() {
  document.querySelectorAll('.zoomable-img').forEach(img => {
    img.addEventListener('click', e => { e.stopPropagation(); openImageZoom(img.src, img.alt); });
  });
}
function openImageZoom(src, alt) {
  const modal = document.createElement('div');
  modal.className = 'image-zoom-modal';
  modal.innerHTML = `<div class="image-zoom-container"><button class="image-zoom-close">✕</button><img src="${src}" alt="${alt}" class="image-zoom-full"></div>`;
  document.body.appendChild(modal);
  const closeBtn = modal.querySelector('.image-zoom-close');
  if (closeBtn) closeBtn.onclick = () => modal.remove();
  modal.onclick = e => { if (e.target === modal) modal.remove(); };
}

if (!document.getElementById('postCustomStyles')) {
  const style = document.createElement('style');
  style.id = 'postCustomStyles';
  style.textContent = `
    html, body { overflow-x: hidden !important; width: 100% !important; position: relative !important; margin: 0 !important; padding: 0 !important; scroll-behavior: smooth; }

    .project-fullscreen-close, .image-zoom-close {
      position: fixed !important; top: 20px !important; right: 20px !important; z-index: 1100 !important;
      background: transparent !important; color: black !important; border: 1.5px solid black !important;
      width: 40px !important; height: 40px !important; border-radius: 0 !important; cursor: pointer !important;
      font-size: 18px !important; display: flex !important; align-items: center !important; justify-content: center !important;
      transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease !important;
      font-family: 'Lilex', monospace !important;
    }
    .project-fullscreen-close:hover, .image-zoom-close:hover { background: black !important; color: white !important; transform: scale(1.05) !important; }

    .language-switcher { display: flex; gap: 8px; margin-bottom: 20px; justify-content: center; position: relative; z-index: 100; }
    .lang-btn {
      background: transparent; border: 1.5px solid #333; color: inherit;
      padding: 6px 12px; border-radius: 0; cursor: pointer; font-weight: 600;
      font-size: 11px; letter-spacing: 0.05em;
      transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
      text-transform: uppercase; position: relative; z-index: 101; font-family: 'Lilex', monospace;
    }
    .dark-mode .lang-btn { border-color: #555; }
    .lang-btn:not(.active):hover { background: #333; color: #fff; border-color: #333; transform: scale(1.04); }
    .dark-mode .lang-btn:not(.active):hover { background: #ededed; color: #1a1a1a; border-color: #ededed; transform: scale(1.04); }
    .lang-btn.active { background: #ededed !important; color: #1a1a1a !important; border-color: #ededed !important; transform: scale(1.05); }
    .dark-mode .lang-btn.active { background: #333 !important; color: #ededed !important; border-color: #333 !important; transform: scale(1.05); }

    .image-zoom-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.95); display: flex; align-items: center; justify-content: center; z-index: 3000; animation: fadeIn 0.3s ease; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .image-zoom-container { position: relative; max-width: 95vw; max-height: 95vh; display: flex; align-items: center; justify-content: center; animation: zoomIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
    @keyframes zoomIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    .image-zoom-full { max-width: 100%; max-height: 100%; object-fit: contain; }

    .project-fullscreen-overlay {
      background: rgba(255,255,255,0.98) !important; width: 100% !important; height: 100% !important;
      position: fixed !important; top: 0 !important; left: 0 !important; z-index: 1000 !important;
      overflow-y: auto !important; overflow-x: hidden !important;
      transition: transform 0.4s cubic-bezier(0.19, 1, 0.22, 1), opacity 0.4s ease;
      transform: translateY(100%); opacity: 0; will-change: transform, opacity;
    }
    .project-fullscreen-overlay.active { transform: translateY(0); opacity: 1; }
    .project-fullscreen-content {
      width: 100% !important; max-width: 100% !important; padding: 60px 20px !important;
      box-sizing: border-box !important; position: relative !important; min-height: 100% !important;
      overflow-x: hidden !important;
    }

    .scroll-reveal { opacity: 0; transform: translateY(20px); transition: opacity 0.6s cubic-bezier(0.23, 1, 0.32, 1), transform 0.6s cubic-bezier(0.23, 1, 0.32, 1); will-change: opacity, transform; }
    .scroll-reveal.active { opacity: 1; transform: translateY(0); }

    .project-fullscreen-body { width: 100% !important; max-width: 800px !important; margin: 0 auto !important; transition: opacity 0.3s ease-in-out; overflow-wrap: break-word !important; word-wrap: break-word !important; }
    .project-fullscreen-body a { color: #0056b3 !important; text-decoration: underline !important; }

    .translation-loader { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; gap: 20px; z-index: 10; pointer-events: none; }
    .spinner { width: 50px; height: 50px; border: 2px solid rgba(0,0,0,0.05); border-top-color: #333; border-radius: 0; animation: spin 0.7s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .search-container { margin: 20px 0; max-width: 100% !important; box-sizing: border-box !important; }
    .search-bar-wrapper { display: flex; gap: 10px; align-items: center; max-width: 100% !important; }
    .search-bar-wrapper input {
      flex: 1; padding: 10px; background: transparent; border: 1.5px solid #333;
      color: inherit; font-family: 'Lilex', monospace; border-radius: 0; min-width: 0 !important;
      transition: border-color 0.15s ease;
    }
    .search-bar-wrapper input:focus { border-color: #ededed; outline: none; }

    .filter-toggle-btn {
      background: transparent; border: 1.5px solid #333; color: inherit;
      padding: 10px 15px; border-radius: 0; cursor: pointer;
      transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease, transform 0.15s ease;
      font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em;
      white-space: nowrap; font-family: 'Lilex', monospace;
    }
    .filter-toggle-btn:hover { background: #333; color: #fff; border-color: #333; transform: scale(1.03); }
    .dark-mode .filter-toggle-btn { border-color: #555; }
    .dark-mode .filter-toggle-btn:hover { background: #ededed; color: #1a1a1a; border-color: #ededed; transform: scale(1.03); }
    .filter-toggle-btn.filtering { background: #333; color: #fff; border-color: #333; }
    .dark-mode .filter-toggle-btn.filtering { background: #ededed; color: #1a1a1a; border-color: #ededed; }

    .tag-popup {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: transparent; backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px);
      display: flex; align-items: center; justify-content: center; z-index: 2000;
      pointer-events: none; opacity: 0; visibility: hidden;
      transition: opacity 0.25s ease-in-out, visibility 0.25s ease-in-out;
    }
    .tag-popup.active { pointer-events: auto; opacity: 1; visibility: visible; }
    .tag-popup-content {
      background: rgb(237, 231, 220); padding: 35px; border: 1.5px solid #333;
      max-width: 500px; width: 90%; text-align: center;
      box-shadow: 0 30px 70px rgba(0,0,0,0.25), 0 10px 20px rgba(0,0,0,0.15);
      transform: translateY(30px) scale(0.95);
      transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease;
      box-sizing: border-box !important; color: #333; border-color: #333;
    }
    .tag-popup.active .tag-popup-content { transform: translateY(0) scale(1); }

    .tag-filters { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin: 24px 0 28px 0; padding: 0; width: 100%; box-sizing: border-box; }
    .tag-btn {
      background: transparent; border: 1.5px solid #333; color: inherit;
      padding: 8px 14px; border-radius: 0; cursor: pointer; font-weight: 600;
      font-size: 11px; letter-spacing: 0.05em;
      transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
      text-transform: uppercase; font-family: 'Lilex', monospace; margin: 0 !important;
    }
    .tag-btn:hover { background: rgba(0,0,0,0.08); transform: scale(1.03); }
    .tag-btn.active { background: #333 !important; color: #fff !important; border-color: #333 !important; transform: scale(1.03); }
    .dark-mode .tag-btn { border-color: #555; }
    .dark-mode .tag-btn:hover { background: rgba(255,255,255,0.08); }
    .dark-mode .tag-btn.active { background: #ededed !important; color: #1a1a1a !important; border-color: #ededed !important; }

    .share-btn-animated { position: relative; overflow: hidden; transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important; }
    .share-btn-animated.clicked { background: white !important; color: black !important; transform: scale(0.95); }
    .share-btn-animated:active { transform: scale(0.9); }

    .project-fullscreen-link-btn {
      background: transparent !important; border: 1.5px solid #333 !important; color: #333 !important;
      padding: 8px 16px !important; font-family: 'Lilex', monospace !important; font-size: 14px !important;
      letter-spacing: 2px !important; cursor: pointer !important; display: flex !important;
      align-items: center !important; gap: 10px !important;
      transition: background 0.2s ease, color 0.2s ease, transform 0.15s ease !important;
      text-transform: uppercase !important; margin: 40px auto !important;
      width: fit-content !important; max-width: 100% !important; box-sizing: border-box !important; border-radius: 0 !important;
    }
    .project-fullscreen-link-btn:hover { background: #333 !important; color: #fff !important; transform: scale(1.03) !important; }

    .close-popup-btn {
      background: transparent; border: 1.5px solid #333; color: inherit;
      padding: 8px 20px; border-radius: 0; cursor: pointer; font-family: 'Lilex', monospace;
      font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;
      transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease; margin-top: 5px;
    }
    .close-popup-btn:hover { background: #333; color: #fff; transform: scale(1.03); }

    .dark-mode .project-fullscreen-overlay { background: rgba(18,18,18,0.98) !important; }
    .dark-mode .project-fullscreen-close, .dark-mode .image-zoom-close { color: white !important; border-color: white !important; }
    .dark-mode .project-fullscreen-close:hover, .dark-mode .image-zoom-close:hover { background: white !important; color: black !important; }
    .dark-mode .project-fullscreen-body a { color: #66b3ff !important; }
    .dark-mode .spinner { border-top-color: #fff; border-bottom-color: rgba(255,255,255,0.05); }
    .dark-mode .tag-popup-content { background: #1a1a1a; border-color: #555; color: #fff; box-shadow: 0 40px 90px rgba(0,0,0,0.65), 0 15px 30px rgba(0,0,0,0.45); }
    .dark-mode .project-fullscreen-link-btn { border-color: currentColor !important; color: inherit !important; }
    .dark-mode .project-fullscreen-link-btn:hover { background: #ededed !important; color: #1a1a1a !important; }
    .dark-mode .close-popup-btn { border-color: #555; }
    .dark-mode .close-popup-btn:hover { background: #ededed; color: #1a1a1a; border-color: #ededed; }

    .recent-posts-roller-container { position: relative; display: flex; align-items: center; width: 100%; margin-top: 15px; transition: padding 0.25s ease; }
    .recent-posts-roller-container.has-arrows { padding: 0 45px; }
    .recent-posts-roller { display: flex; flex-direction: row; gap: 16px; overflow-x: auto; scroll-behavior: smooth; width: 100%; scrollbar-width: none; padding: 5px 0; }
    .recent-posts-roller::-webkit-scrollbar { display: none; }
    .recent-post-card {
      flex: 0 0 calc(33.333% - 11px); min-width: 240px; border: 1.5px solid #333;
      background: rgb(237, 231, 220); padding: 16px; cursor: pointer;
      display: flex; flex-direction: column; justify-content: space-between;
      transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
      box-sizing: border-box; text-align: left; will-change: transform, box-shadow;
    }
    .dark-mode .recent-post-card { background: #1a1a1a; border-color: #555; color: #ededed; }
    .recent-post-card:hover { background: #e0d8c8; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    .dark-mode .recent-post-card:hover { background: #2a2a2a; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
    .recent-card-header { margin-bottom: 12px; }
    .recent-card-date { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 4px; }
    .dark-mode .recent-card-date { color: #aaa; }
    .recent-card-title { font-size: 13px; font-weight: 700; line-height: 1.4; margin: 0; color: #111; }
    .dark-mode .recent-card-title { color: #ededed; }
    .recent-card-excerpt { font-size: 11px; line-height: 1.5; color: #555; margin: 0; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
    .dark-mode .recent-card-excerpt { color: #ccc; }

    .roller-arrow {
      position: absolute; top: 50%; transform: translateY(-50%);
      background: rgb(237, 231, 220); border: 1.5px solid #333; color: #333;
      width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;
      cursor: pointer; z-index: 10; font-size: 12px;
      transition: background 0.15s ease, color 0.15s ease; user-select: none;
    }
    .dark-mode .roller-arrow { background: #1a1a1a; border-color: #555; color: #ededed; }
    .roller-arrow:hover { background: #333; color: rgb(237, 231, 220); }
    .dark-mode .roller-arrow:hover { background: #ededed; color: #1a1a1a; }
    .roller-arrow-left { left: 0; }
    .roller-arrow-right { right: 0; }

    .archive-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgb(237, 231, 220); z-index: 2500; transform: translateX(100%); transition: transform 0.4s cubic-bezier(0.19, 1, 0.22, 1); overflow-y: auto; padding: 40px 20px; box-sizing: border-box; }
    .dark-mode .archive-overlay { background: #121212; color: #ededed; }
    .archive-overlay.active { transform: translateX(0); }
    .archive-content { max-width: 800px; margin: 0 auto; }
    .archive-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 40px; border-bottom: 1.5px solid #333; padding-bottom: 20px; }
    .dark-mode .archive-header { border-color: #555; }
    .back-btn {
      background: transparent; border: 1.5px solid #333; color: inherit;
      padding: 8px 16px; cursor: pointer; font-family: 'Lilex', monospace; font-size: 12px;
      text-transform: uppercase;
      transition: background 0.2s ease, color 0.2s ease, transform 0.15s ease;
    }
    .back-btn:hover { background: #333; color: #fff; transform: scale(1.03); }
    .dark-mode .back-btn { border-color: #555; }
    .dark-mode .back-btn:hover { background: #ededed; color: #121212; }
    .archive-list { display: flex; flex-direction: column; gap: 15px; }
    .archive-item { display: flex; align-items: center; gap: 20px; padding: 15px; border: 1.5px solid transparent; cursor: pointer; transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease; border-bottom: 1px solid rgba(0,0,0,0.05); }
    .archive-item:hover { border-color: #333; background: rgba(0,0,0,0.02); transform: translateX(5px); }
    .dark-mode .archive-item:hover { border-color: #555; background: rgba(255,255,255,0.02); }
    .archive-date { font-family: 'Lilex', monospace; font-size: 12px; color: #666; min-width: 100px; }
    .archive-post-title { font-weight: 600; font-size: 16px; }
    .archive-toggle-btn { margin-left: auto; }

    @media (max-width: 768px) {
      .project-fullscreen-content { padding: 80px 15px 20px !important; width: 100% !important; overflow-x: hidden !important; }
      .project-fullscreen-title { font-size: 28px !important; line-height: 1.2 !important; width: 100% !important; }
      .project-fullscreen-body { font-size: 16px !important; width: 100% !important; padding: 0 !important; }
      .search-bar-wrapper { flex-direction: column; width: 100% !important; }
      .search-bar-wrapper input, .filter-toggle-btn { width: 100% !important; box-sizing: border-box !important; }
      .project-fullscreen-close, .image-zoom-close { top: 15px !important; right: 15px !important; width: 35px !important; height: 35px !important; font-size: 16px !important; }
      .tag-popup-content { padding: 25px 20px !important; width: 95% !important; }
      .recent-post-card { flex: 0 0 calc(50% - 8px); }
      .archive-header { flex-direction: column; gap: 20px; align-items: flex-start; }
      .archive-item { flex-direction: column; align-items: flex-start; gap: 5px; }
    }
    @media (max-width: 480px) {
      .recent-post-card { flex: 0 0 100%; }
    }
  `;
  document.head.appendChild(style);
}
