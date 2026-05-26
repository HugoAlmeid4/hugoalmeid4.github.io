// ─── CONFIG ──────────────────────────────────────────────────────────────────
// Paste your Google Sheets published CSV URLs here.
// How to get them:
//   1. Open your Google Sheet(s)
//   2. File → Share → Publish to web
//   3. Select your sheet, choose "Comma-separated values (.csv)"
//   4. Click Publish, copy the URL and paste them below
//
// ─── CAPTURE LOG — Google Sheets Structure ───────────────────────────────────
//   Row 1 must be HEADERS (case-insensitive). Use these column names:
//
//   | Target       | Type    | Integration | Bortle   | Status    | URL (optional)         |
//   |--------------|---------|-------------|----------|-----------|------------------------|
//   | M31 Androme… | Galaxy  | 12h 45m     | Class 4  | Completed | https://link-to-image  |
//   | M42 Orion…   | Nebula  | 6h 15m      | Class 5  | Completed | https://link-to-image  |
//   | NGC 2237     | Nebula  | 8h 30m      | Class 4  | Processing|                        |
//   | M51 Whirl…   | Galaxy  | --          | Class 3  | Planned   |                        |
//
//   ⚠ No mount or scope columns needed — keep it simple!
//   Status values: "Completed"/"Done"  •  "Processing"/"Ongoing"  •  "Planned" (or anything else)
//
// ─── PROJECTS & STUDIES — Google Sheets Structure ────────────────────────────
//   Row 1 must be HEADERS (case-insensitive). Use these column names:
//
//   | Title              | Type            | Description                           | URL (optional)        |
//   |--------------------|-----------------|---------------------------------------|-----------------------|
//   | SNR Optimization…  | Technical Study | This technical study explores math…    | https://github.com/…  |
//   | Stacking Compar…   | Project         | A comparison of DeepSkyStacker vs…    | https://docs.google…  |
//
//   Title    → Project name (matched by: "title" or "name")
//   Type     → Category label (matched by: "type" or "category")
//   Description → Full documentation text (matched by: "description", "desc", "body", or "excerpt")
//   URL      → Link to full external docs (matched by: "url" or "link")
//
// ─────────────────────────────────────────────────────────────────────────────
const LOG_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ4ufwf_c_1HweBqBvURm7PQdODICq6KI1wfvYWTH4E386CfGVnmyDQFdmrxhVNh1xMevlWBlFOO7u9/pub?output=csv";
const PROJECTS_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRk6_z0V6gvkwjF_5IXYAUB33aLZUIynTI6m00vqHH0ynoMhPMthznGFH2rsiiTU7-oyw40YGR2WakC/pub?output=csv";
// ─────────────────────────────────────────────────────────────────────────────

const LOG_CACHE_KEY = "projects_cache";
const PROJ_CACHE_KEY = "projects_list_cache";
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours caching layer

document.addEventListener('DOMContentLoaded', () => {
  loadProjectsList();
  loadCaptureLog();
});

// ── Google Sheets Projects List Loader ───────────────────────────────────────

async function loadProjectsList() {
  const container = document.getElementById('projectsList');
  const status = document.getElementById('projectsStatus');

  if (!container) return;

  const demoProjects = [
    {
      title: "SNR Optimization Study",
      type: "Technical Study",
      description: "This technical study explores mathematical frameworks and practical workflows to maximize the Signal-to-Noise Ratio (SNR) in deep sky sub-exposures. Focusing on light-polluted suburban environments, it documents stacking efficiency, dark current profiling, and noise propagation in post-processing tools like PixInsight.",
      url: "https://github.com/HugoAlmeid4"
    }
  ];

  // If URL is default, load fallback demo projects instantly
  if (PROJECTS_SHEET_CSV_URL === "YOUR_GOOGLE_SHEETS_CSV_URL_HERE") {
    renderProjects(demoProjects, container, status);
    return;
  }

  // 1. LocalStorage check for Projects
  try {
    const cache = JSON.parse(localStorage.getItem(PROJ_CACHE_KEY));
    if (cache && cache.timestamp && (Date.now() - cache.timestamp < CACHE_EXPIRY) && Array.isArray(cache.data)) {
      renderProjects(cache.data, container, status);
      fetchProjectsAndCache(true); // Silent background sync
      return;
    }
  } catch (e) {
    console.warn('Projects cache read error, fetching from network:', e);
  }

  // 2. Cache empty/expired: normal fetch
  fetchProjectsAndCache(false);
}

async function fetchProjectsAndCache(isSilent) {
  try {
    const res = await fetch(PROJECTS_SHEET_CSV_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const rows = parseCSV(text);

    if (rows.length < 2) {
      if (!isSilent) {
        const status = document.getElementById('projectsStatus');
        if (status) status.textContent = 'No projects found in sheet.';
      }
      return;
    }

    const headers = rows[0].map(h => h.toLowerCase().trim());
    const idx = {
      title: headers.findIndex(h => h.includes('title') || h.includes('name')),
      type: headers.findIndex(h => h.includes('type') || h.includes('category')),
      description: headers.findIndex(h => h.includes('description') || h.includes('desc') || h.includes('body') || h.includes('excerpt')),
      url: headers.findIndex(h => h.includes('url') || h.includes('link')),
    };

    const projects = rows.slice(1)
      .filter(r => r.some(c => c.trim()))
      .map(r => ({
        title: idx.title >= 0 ? r[idx.title] : r[0] || '',
        type: idx.type >= 0 ? r[idx.type] : r[1] || 'Project',
        description: idx.description >= 0 ? r[idx.description] : r[2] || '',
        url: idx.url >= 0 ? r[idx.url] : '',
      }));

    // Cache to localStorage
    try {
      localStorage.setItem(PROJ_CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        data: projects
      }));
    } catch (e) {
      console.warn('Could not save projects cache to localStorage:', e);
    }

    // Render cards to container if not a background update
    if (!isSilent) {
      const container = document.getElementById('projectsList');
      const status = document.getElementById('projectsStatus');
      renderProjects(projects, container, status);
    }

  } catch (e) {
    console.error('Fetch projects error:', e);
    if (!isSilent) {
      const status = document.getElementById('projectsStatus');
      if (status) status.textContent = 'Could not load projects. Check sheet settings.';
    }
  }
}

function renderProjects(projects, container, statusEl) {
  container.innerHTML = '';

  // Create fullscreen overlay (singleton)
  if (!document.getElementById('projectFullscreenOverlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'projectFullscreenOverlay';
    overlay.className = 'project-fullscreen-overlay';
    overlay.innerHTML = `
      <div class="project-fullscreen-content">
        <button class="project-fullscreen-close" id="projectFullscreenClose" aria-label="Close">✕</button>
        <div class="project-fullscreen-type" id="projectFullscreenType"></div>
        <h2 class="project-fullscreen-title" id="projectFullscreenTitle"></h2>
        <div class="project-fullscreen-body" id="projectFullscreenBody"></div>
        <div class="project-fullscreen-link-container" id="projectFullscreenLinkContainer"></div>
      </div>`;
    document.body.appendChild(overlay);

    // Close overlay handlers
    document.getElementById('projectFullscreenClose').addEventListener('click', closeProjectOverlay);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeProjectOverlay();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeProjectOverlay();
    });
  }

  projects.forEach((proj) => {
    const card = document.createElement('div');
    card.className = 'post-card';

    // Truncate description for preview (show first ~80 chars + "...")
    const previewText = truncateText(proj.description, 80);
    const hasMore = proj.description.length > 80;

    card.innerHTML = `
      <div class="post-header">
        <div class="post-header-left">
          <div class="post-title">
            ${esc(proj.title)}
            <span class="post-date">• ${esc(proj.type)}</span>
          </div>
          <div class="post-excerpt-preview">${esc(previewText)}${hasMore ? '<span class="ellipsis-dots">...</span>' : ''}</div>
        </div>
        <span class="post-arrow">▼</span>
      </div>
      <div class="post-body">
        <div class="post-body-inner">
          <p>${esc(truncateText(proj.description, 160))}${proj.description.length > 160 ? '...' : ''}</p>
          <button class="read-full-doc-btn" data-project-idx="${projects.indexOf(proj)}">Read full documentation →</button>
        </div>
      </div>`;

    // Toggle collapsible block
    card.querySelector('.post-header').addEventListener('click', () => {
      const isOpen = card.classList.contains('open');
      document.querySelectorAll('#projectsList .post-card.open').forEach(c => c.classList.remove('open'));
      if (!isOpen) {
        card.classList.add('open');
        setTimeout(() => {
          card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
      }
    });

    // "Read full documentation" button opens fullscreen overlay
    card.querySelector('.read-full-doc-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openProjectOverlay(proj);
    });

    container.appendChild(card);
  });

  if (statusEl) {
    statusEl.textContent = `${projects.length} project${projects.length !== 1 ? 's' : ''}`;
    statusEl.style.display = 'block';
  }
}

// ── Fullscreen Overlay Controls ──────────────────────────────────────────────

function openProjectOverlay(proj) {
  const overlay = document.getElementById('projectFullscreenOverlay');
  document.getElementById('projectFullscreenType').textContent = proj.type;
  document.getElementById('projectFullscreenTitle').textContent = proj.title;
  document.getElementById('projectFullscreenBody').innerHTML = `<p>${esc(proj.description)}</p>`;

  const linkContainer = document.getElementById('projectFullscreenLinkContainer');
  if (proj.url) {
    linkContainer.innerHTML = `<a class="project-fullscreen-link" href="${esc(proj.url)}" target="_blank" rel="noopener">View external documentation →</a>`;
  } else {
    linkContainer.innerHTML = '';
  }

  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeProjectOverlay() {
  const overlay = document.getElementById('projectFullscreenOverlay');
  if (!overlay) return;
  overlay.classList.remove('active');
  document.body.style.overflow = '';
}

function truncateText(text, maxLen) {
  if (!text || text.length <= maxLen) return text;
  // Cut at last space before maxLen to avoid mid-word truncation
  const cut = text.lastIndexOf(' ', maxLen);
  return text.substring(0, cut > 0 ? cut : maxLen);
}

// ── Google Sheets Data Loader (Capture Log) ──────────────────────────────────

async function loadCaptureLog() {
  const tbody = document.getElementById('dataLogBody');
  const status = document.getElementById('dataLogStatus');

  if (!tbody) return;

  const demoData = [
    {
      target: "M31 Andromeda Galaxy",
      type: "Galaxy",
      integration: "12h 45m",
      bortle: "Class 4",
      status: "Completed",
      url: "https://github.com/HugoAlmeid4"
    },
    {
      target: "M42 Orion Nebula",
      type: "Nebula",
      integration: "6h 15m",
      bortle: "Class 5",
      status: "Completed",
      url: "https://github.com/HugoAlmeid4"
    },
    {
      target: "NGC 2237 Rosette Nebula",
      type: "Nebula",
      integration: "8h 30m",
      bortle: "Class 4",
      status: "Processing",
      url: ""
    },
    {
      target: "M51 Whirlpool Galaxy",
      type: "Galaxy",
      integration: "--",
      bortle: "Class 3",
      status: "Planned",
      url: ""
    }
  ];

  // Show demo/fallback log if URL is still default
  if (LOG_SHEET_CSV_URL === "YOUR_GOOGLE_SHEETS_CSV_URL_HERE") {
    renderTable(demoData, tbody, status);
    return;
  }

  // 1. LocalStorage check for Capture Log
  try {
    const cache = JSON.parse(localStorage.getItem(LOG_CACHE_KEY));
    if (cache && cache.timestamp && (Date.now() - cache.timestamp < CACHE_EXPIRY) && Array.isArray(cache.data)) {
      renderTable(cache.data, tbody, status);
      fetchLogAndCache(true); // Silent background sync
      return;
    }
  } catch (e) {
    console.warn('Logs cache parse error, fetching from network:', e);
  }

  // 2. Cache empty or expired
  fetchLogAndCache(false);
}

async function fetchLogAndCache(isSilent) {
  try {
    const res = await fetch(LOG_SHEET_CSV_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const rows = parseCSV(text);

    if (rows.length < 2) {
      if (!isSilent) {
        const status = document.getElementById('dataLogStatus');
        if (status) status.textContent = 'No capture log entries found.';
      }
      return;
    }

    const headers = rows[0].map(h => h.toLowerCase().trim());
    const idx = {
      target: headers.findIndex(h => h.includes('target')),
      type: headers.findIndex(h => h.includes('type')),
      integration: headers.findIndex(h => h.includes('integration') || h.includes('time') || h.includes('duration')),
      bortle: headers.findIndex(h => h.includes('bortle') || h.includes('scale')),
      status: headers.findIndex(h => h.includes('status') || h.includes('state')),
      url: headers.findIndex(h => h.includes('url') || h.includes('link')),
    };

    const entries = rows.slice(1)
      .filter(r => r.some(c => c.trim()))
      .map(r => ({
        target: idx.target >= 0 ? r[idx.target] : r[0] || '',
        type: idx.type >= 0 ? r[idx.type] : r[1] || '',
        integration: idx.integration >= 0 ? r[idx.integration] : r[2] || '',
        bortle: idx.bortle >= 0 ? r[idx.bortle] : r[3] || '',
        status: idx.status >= 0 ? r[idx.status] : r[4] || '',
        url: idx.url >= 0 ? r[idx.url] : '',
      }));

    // Cache updated log entries
    try {
      localStorage.setItem(LOG_CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        data: entries
      }));
    } catch (e) {
      console.warn('Could not save projects log cache:', e);
    }

    // Render table only if it's NOT a silent background update
    if (!isSilent) {
      const tbody = document.getElementById('dataLogBody');
      const status = document.getElementById('dataLogStatus');
      renderTable(entries, tbody, status);
    }

  } catch (e) {
    console.error('Fetch error:', e);
    if (!isSilent) {
      const status = document.getElementById('dataLogStatus');
      if (status) status.textContent = 'Could not load capture log. Check Google Sheet published CSV settings.';
    }
  }
}

// ── Rendering Table (High-performance single DOM paint) ─────────────────────

function renderTable(entries, tbody, statusEl) {
  tbody.innerHTML = entries.map(entry => {
    const statusText = entry.status.trim().toLowerCase();
    let statusClass = 'status-planned';
    
    if (statusText === 'completed' || statusText === 'done') {
      statusClass = 'status-completed';
    } else if (statusText === 'processing' || statusText === 'ongoing') {
      statusClass = 'status-processing';
    }

    const targetCellHtml = entry.url 
      ? `<a href="${esc(entry.url)}" target="_blank" rel="noopener" class="target-link">${esc(entry.target)}</a>`
      : esc(entry.target);

    return `
      <tr>
        <td>${targetCellHtml}</td>
        <td>${esc(entry.type)}</td>
        <td>${esc(entry.integration)}</td>
        <td>${esc(entry.bortle)}</td>
        <td><span class="status-badge ${statusClass}">${esc(entry.status)}</span></td>
      </tr>
    `;
  }).join('');

  if (statusEl) {
    statusEl.textContent = `${entries.length} targets logged`;
    statusEl.style.display = 'block';
  }
}

// ── CSV Parser ───────────────────────────────────────────────────────────────

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

// ── Utilities ────────────────────────────────────────────────────────────────

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
