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
});

function getLanguageName(code) {
  const map = {
    en: 'English',
    pt: 'Português',
    es: 'Español'
  };
  return map[code] || code.toUpperCase();
}

function setupLanguageSwitcher(containerId = 'languageSwitcher') {
  const target = document.getElementById(containerId) || (containerId === 'languageSwitcher' ? document.querySelector('.Posts-Section') : null);
  if (!target) return;

  const langHTML = `
    <div class="language-switcher-dropdown">
      <button class="lang-menu-toggle" type="button" aria-haspopup="menu" aria-expanded="false">
        <span class="lang-current-short">${currentLanguage.toUpperCase()}</span>
        <span class="lang-current-full">${getLanguageName(currentLanguage)}</span>
        <span class="lang-caret">▾</span>
      </button>
      <div class="lang-menu" role="menu">
        <button class="lang-menu-option ${currentLanguage === 'en' ? 'active' : ''}" data-lang="en" type="button" role="menuitem">English</button>
        <button class="lang-menu-option ${currentLanguage === 'pt' ? 'active' : ''}" data-lang="pt" type="button" role="menuitem">Português</button>
        <button class="lang-menu-option ${currentLanguage === 'es' ? 'active' : ''}" data-lang="es" type="button" role="menuitem">Español</button>
      </div>
    </div>
  `;

  if (containerId === 'languageSwitcher' && target.id !== 'languageSwitcher') {
    const existing = target.querySelector('.language-switcher-dropdown');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.innerHTML = langHTML;
    const firstChild = div.firstElementChild;
    if (firstChild) {
      const h2 = target.querySelector('h2');
      if (h2) h2.before(firstChild);
      else target.appendChild(firstChild);
    }
  } else {
    target.innerHTML = langHTML;
  }

  const dropdown = target.querySelector('.language-switcher-dropdown');
  if (!dropdown) return;

  const toggle = dropdown.querySelector('.lang-menu-toggle');
  const menu = dropdown.querySelector('.lang-menu');
  if (!toggle || !menu) return;

  if (!window.__langSwitcherBound) {
    document.addEventListener('click', () => {
      document.querySelectorAll('.language-switcher-dropdown.open').forEach(item => {
        item.classList.remove('open');
        const button = item.querySelector('.lang-menu-toggle');
        if (button) button.setAttribute('aria-expanded', 'false');
      });
    });
    window.__langSwitcherBound = true;
  }

  toggle.addEventListener('click', event => {
    event.stopPropagation();
    const isOpen = dropdown.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });

  dropdown.querySelectorAll('.lang-menu-option').forEach(option => {
    option.addEventListener('click', async event => {
      event.stopPropagation();
      dropdown.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      const lang = option.getAttribute('data-lang');
      if (lang && lang !== currentLanguage) {
        await changeLanguage(lang);
      }
    });
  });
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

  setupLanguageSwitcher('languageSwitcher');
  setupLanguageSwitcher('overlayLangSwitcher');

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

  await Promise.all([
    filterAndRender(true),
    renderArchiveList(true)
  ]);

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
          // Accept both `draft: true` and `draft: "true"` so editors writing
          // markdown by hand (with quotes) still work in the CMS.
          draft: metadata.draft === true || metadata.draft === 'true',
          bodyHtml,
          filename
        };
      } catch { return null; }
    });

    const results = await Promise.all(postPromises);
    const seenSlugs = new Set();
    // Drafts are hidden by default. Add `?preview=drafts` to the URL to see
    // them with a DRAFT badge — useful when authoring new content.
    const previewDrafts = new URLSearchParams(window.location.search).get('preview') === 'drafts';

    // Keep a separate list of all loaded posts for search/archive, but only
    // expose non-draft posts as the public list by default.
    const visibleResults = results
      .filter(p => {
        if (!p || seenSlugs.has(p.slug)) return false;
        if (p.draft && !previewDrafts) return false;
        seenSlugs.add(p.slug);
        return true;
      })
      .sort((a, b) => parseDate(b.date) - parseDate(a.date));

    allPosts = visibleResults;
    showDraftPreviewBanner(previewDrafts);
    // Don't pollute the cache while previewing drafts — the public cache
    // should never contain unpublished posts.
    if (!previewDrafts) {
      localStorage.setItem('posts_cache', JSON.stringify({ data: allPosts }));
    } else {
      localStorage.removeItem('posts_cache');
    }

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
      <button id="openSearchPopup" class="search-icon-btn" type="button" aria-label="Open search">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 3a7.5 7.5 0 015.93 12.09l4.74 4.74a1 1 0 01-1.42 1.42l-4.74-4.74A7.5 7.5 0 1110.5 3zm0 2a5.5 5.5 0 100 11 5.5 5.5 0 000-11z"/></svg>
      </button>
      <button id="postFilterBtn" class="filter-toggle-btn">${t('filterBtn')}</button>
      <div id="languageSwitcher" class="language-switcher-container"></div>
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

  // Ensure the search popup is appended to the document body so it sizes to viewport,
  // not constrained by posts column width or transformed parents.
  if (!document.getElementById('searchPopup')) {
    const popup = document.createElement('div');
    popup.id = 'searchPopup';
    popup.className = 'search-popup';
    popup.setAttribute('aria-hidden', 'true');
    popup.innerHTML = `
      <div class="search-popup-content">
        <h3>${t('searchPlaceholder')}</h3>
        <input id="popupSearchInput" type="text" placeholder="${t('searchPlaceholder')}" aria-label="Search posts">
        <button id="searchPopupDoneBtn" class="filter-toggle-btn">${t('done')}</button>
      </div>
    `;
    document.body.appendChild(popup);
  }

  setupLanguageSwitcher('languageSwitcher');

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

  const openSearchPopupBtn = document.getElementById('openSearchPopup');
  const searchPopupDoneBtn = document.getElementById('searchPopupDoneBtn');
  const searchPopup = document.getElementById('searchPopup');
  const popupSearchInput = document.getElementById('popupSearchInput');

  if (openSearchPopupBtn && searchPopupDoneBtn && searchPopup && popupSearchInput) {
    openSearchPopupBtn.addEventListener('click', () => {
      searchPopup.classList.add('active');
      searchPopup.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      setTimeout(() => popupSearchInput.focus(), 100);
    });

    searchPopupDoneBtn.addEventListener('click', () => {
      searchPopup.classList.remove('active');
      searchPopup.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (!popupSearchInput.value.trim()) {
        openSearchPopupBtn.classList.remove('active-text');
      }
    });

    searchPopup.addEventListener('click', e => {
      if (e.target === searchPopup) {
        searchPopupDoneBtn.click();
      }
    });

    popupSearchInput.addEventListener('input', () => {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => filterAndRender(), 150);
      if (popupSearchInput.value.trim()) {
        openSearchPopupBtn.classList.add('active-text');
      } else {
        openSearchPopupBtn.classList.remove('active-text');
      }
    });
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

async function renderArchiveList(showLoading = false) {
  const ov = document.getElementById('postArchiveOverlay');
  const list = document.getElementById('archiveList');
  if (!ov || !list || !ov.classList.contains('active')) return;

  if (showLoading) {
    list.innerHTML = `
      <div class="archive-item" style="pointer-events:none; opacity:0.75;">
        <span class="archive-date">…</span>
        <span class="archive-post-title">${t('translating')}</span>
      </div>
    `;
  } else {
    list.innerHTML = '';
  }
  const fragment = document.createDocumentFragment();
  const translatedPosts = await Promise.all(allPosts.map(post => getTranslatedPost(post, currentLanguage)));

  translatedPosts.forEach(post => {
    const item = document.createElement('div');
    item.className = 'archive-item scroll-reveal';
    item.innerHTML = `<span class="archive-date">${fmtShort(post.date)}</span><span class="archive-post-title">${esc(post.title)}</span>`;
    item.onclick = () => { closeArchive(); openPostOverlay(post); };
    fragment.appendChild(item);
  });

  // Remove any prior loading placeholder before finalizing the archive list
  list.innerHTML = '';
  list.appendChild(fragment);
  setTimeout(() => handleScrollReveal(ov), 100);
}

async function openArchive() {
  const ov = document.getElementById('postArchiveOverlay');
  if (!ov) return;
  ov.classList.add('active');
  document.body.style.overflow = 'hidden';
  await renderArchiveList(true);
}

function closeArchive() {
  const ov = document.getElementById('postArchiveOverlay');
  if (ov) ov.classList.remove('active');
  document.body.style.overflow = '';
}

async function filterAndRender(showLoading = false) {
  const searchInput = document.getElementById('postSearchInput');
  const popupSearchInput = document.getElementById('popupSearchInput');
  const activeSearchInput = (searchInput && window.getComputedStyle(searchInput).display !== 'none')
    ? searchInput
    : popupSearchInput || searchInput;
  const query = activeSearchInput ? activeSearchInput.value.toLowerCase() : '';
  const list = document.getElementById('postsList');
  const status = document.getElementById('postsStatus');

  // First filter by tags
  const tagFiltered = allPosts.filter(p => {
    const matchesTags = activeFilterTags.length === 0 || activeFilterTags.every(tag => p.tags.includes(tag));
    return matchesTags;
  });

  // If there is a search query, filter by title/excerpt. For non-English languages,
  // translate titles/excerpts first so the user's query (in the selected language)
  // is matched against translated text.
  let finalFiltered = tagFiltered;
  if (query) {
    const q = query;
    if (currentLanguage === 'en') {
      finalFiltered = tagFiltered.filter(p => p.title.toLowerCase().includes(q) || p.excerpt.toLowerCase().includes(q));
    } else {
      const translatedList = await Promise.all(tagFiltered.map(p => getTranslatedPost(p, currentLanguage)));
      finalFiltered = tagFiltered.filter((p, idx) => {
        const tp = translatedList[idx];
        const titleMatch = tp.title && tp.title.toLowerCase().includes(q);
        const excerptMatch = tp.excerpt && tp.excerpt.toLowerCase().includes(q);
        return titleMatch || excerptMatch;
      });
    }
  }

  await renderPosts(finalFiltered, list, status, 100, showLoading);

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

async function renderPosts(posts, list, status, visibleCount = 3, showLoading = false) {
  if (!list) return;

  if (showLoading) {
    list.innerHTML = `
      <div class="post-card skeleton-card">
        <div class="post-header">
          <div class="post-header-left" style="width: 100%;">
            <div class="skeleton-line" style="margin-bottom: 8px; max-width: 180px;"></div>
            <div class="skeleton-line short"></div>
          </div>
        </div>
      </div>
      <div class="posts-status">${t('translating')}</div>
    `;
    if (status) status.textContent = t('translating');
  } else {
    list.innerHTML = '';
  }

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
        <div id="relatedPostsContainer"></div>
        <div id="mostRecentContainer"></div>
        <div id="giscusContainer" class="giscus-comments"></div>
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
    if (post.draft) card.classList.add('post-card-draft');
    const draftBadge = post.draft ? '<span class="post-draft-badge">DRAFT</span>' : '';
    card.innerHTML = `
      <div class="post-header">
        <div class="post-header-left">
          <div class="post-title">${esc(tp.title)} ${draftBadge} <span class="post-date">• ${fmtShort(post.date)}</span><span class="post-reading-time"> • ${esc(post.readingTime)}</span></div>
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

  // Remove any prior loading placeholder before finalizing the list
  list.innerHTML = '';
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

  if (dateEl) dateEl.textContent = `${fmtFull(post.date)}${post.author ? ' • By ' + post.author : ''} • ${post.readingTime}` + (post.draft ? ' • DRAFT' : '');

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
  loadGiscusForPost(post);
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

function showDraftPreviewBanner(active) {
  if (!document.body) return;
  let banner = document.getElementById('draftPreviewBanner');
  if (!active) {
    if (banner) banner.remove();
    return;
  }
  if (banner) return;
  banner = document.createElement('div');
  banner.id = 'draftPreviewBanner';
  banner.className = 'draft-preview-banner';
  banner.innerHTML = '<span>Showing drafts — remove <code>?preview=drafts</code> from the URL to hide drafts.</span>';
  // Insert at the top of .Medium-Path so it's visible above posts.
  const main = document.querySelector('.Medium-Path') || document.body;
  main.insertBefore(banner, main.firstChild);
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

// ── Giscus comments (loaded into #giscusContainer inside the post overlay) ─
// Reads window globals set by giscus-config.js. If REPO_ID / CATEGORY_ID are
// blank (site owner hasn't enabled GitHub Discussions yet, or hasn't visited
// giscus.app), a setup hint replaces the widget so the page still works.
function loadGiscusForPost(post) {
  const container = document.getElementById('giscusContainer');
  if (!container) return;
  // Always wipe stale widget state — opening a different post on the same
  // page session should not show comments mapped to the previous slug.
  container.innerHTML = '';

  const repoId      = window.GISCUS_REPO_ID;
  const categoryId  = window.GISCUS_CATEGORY_ID;
  const repo        = window.GISCUS_REPO || 'HugoAlmeid4/hugoalmeid4.github.io';
  const category    = window.GISCUS_CATEGORY || 'General';

  if (!repoId || !categoryId) {
    container.innerHTML = `
      <div class="giscus-setup-hint">
        <h3>💬 Comments</h3>
        <p>This post would show reader comments via
          <a href="https://giscus.app" target="_blank" rel="noopener">giscus</a>
          — backed by GitHub Discussions, no separate database.</p>
        <p>To enable, the site owner must:</p>
        <ol>
          <li>Enable GitHub Discussions on <code>${repo}</code> (Settings → Features → Discussions).</li>
          <li>Visit <a href="https://giscus.app" target="_blank" rel="noopener">giscus.app</a> and generate a snippet for <code>${repo}</code>.</li>
          <li>Copy <code>data-repo-id</code> and <code>data-category-id</code> into <code>giscus-config.js</code> and reload.</li>
        </ol>
      </div>`;
    return;
  }

  // Mapping: pulled from giscus-config.js. 'pathname' uses the current URL's
  // pathname; 'specific' pairs with data-term = post.slug for per-post threads.
  // data-term is only meaningful when mapping is 'specific'.
  const mapping = window.GISCUS_MAPPING || 'pathname';
  const script = document.createElement('script');
  script.src = 'https://giscus.app/client.js';
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.setAttribute('data-repo',              repo);
  script.setAttribute('data-repo-id',           repoId);
  script.setAttribute('data-category',          category);
  script.setAttribute('data-category-id',       categoryId);
  script.setAttribute('data-mapping',           mapping);
  if (mapping === 'specific') {
    script.setAttribute('data-term', post.slug || '');
  }
  script.setAttribute('data-strict',            window.GISCUS_STRICT            || '0');
  script.setAttribute('data-reactions-enabled', window.GISCUS_REACTIONS_ENABLED || '1');
  script.setAttribute('data-emit-metadata',     window.GISCUS_EMIT_METADATA    || '0');
  script.setAttribute('data-input-position',    window.GISCUS_INPUT_POSITION   || 'bottom');
  script.setAttribute('data-theme',             window.GISCUS_THEME            || 'preferred_color_scheme');
  script.setAttribute('data-lang',              window.GISCUS_LANG             || 'en');
  script.setAttribute('data-loading',           'lazy');
  container.appendChild(script);
}
