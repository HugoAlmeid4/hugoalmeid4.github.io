#!/usr/bin/env node
// scripts/translate-content.mjs
// ──────────────────────────────────────────────────────────────────────────
// Translate the small per-page data JSON files (bio.json, cv.json, now.json),
// gallery/index.json, and cert name frontmatter into Portuguese (pt) and
// Spanish (es) using the unofficial Google Translate endpoint that posts.js
// also uses at runtime. Run once after editing the English source; no
// rebuild step is needed at runtime.
//
// What gets translated: human-readable text fields (paragraphs, headlines,
// skill descriptions, project descriptions, interest strings, block intros,
// reading list items, gallery item titles / alts / targets / notes, cert
// frontmatter `name:` / `issuer:` / `bio:` values).
//
// What gets skipped:
//   - URLs, dates, credential IDs (non-translatable strings)
//   - Brand / proper-noun arrays (skill chip items like "Python", "Siril",
//     "Stellarium", "DeepSkyStacker", "HTML", etc.) — translating these
//     produces wrong results (e.g. "Python" → "Pitão").
//   - Emoji icons ("🐙", "🦊", "✉️").
//
// Output: leaves the original English values intact and converts each
// text-bearing field to an object { en, pt, es }.
//
// Usage:  node scripts/translate-content.mjs
// ──────────────────────────────────────────────────────────────────────────

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'data');

const BRAND_WORDS = new Set([
  'python', 'html', 'css', 'git', 'markdown', 'linux',
  'siril', 'stellarium', 'deepskystacker', 'gimp',
  'english', 'portuguese', 'spanish', 'hindi', 'mandarin', 'chinese',
  '中文', 'lilex', 'json', 'md', 'pdf'
]);

/* INVARIANT (set LANG_KEYS):
   Every translated field must end up as a flat { en, pt, es } object with
   STRING leaves. The enrich() / enrichGallery() / translateCertMd()
   functions below GUARD against ever wrapping an existing translation
   object in another translation layer — that's how an earlier version of
   this script inflated data/bio.json from a few KB to 180+ MB.

   If you change the shape recognition here, also re-validate:
     `node scripts/repair-translation-corruption.mjs` (dry-run)
   and skim `git diff data/`. */
const LANGS = ['en', 'pt', 'es', 'hi', 'zh'];
const LANG_KEYS = new Set(LANGS);
function isTLObject(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const keys = Object.keys(v);
  if (!keys.length || keys.length > LANGS.length) return false;
  return keys.every((k) => LANG_KEYS.has(k));
}

function isBrand(str) {
  if (!str) return false;
  const cleaned = String(str).trim().toLowerCase();
  return BRAND_WORDS.has(cleaned);
}

/* Add 'hi' to a 3-key { en, pt, es } translation object — or pass through
   unchanged if it's already a 4- or 5-key object that has 'hi'. Used during
   the migration from 3-language to 4-language data files: if a value is
   already a complete translation object, we keep its en/pt/es intact and
   ADD 'hi' by translating the 'en' string.

   Returns the same object reference if no extension is needed (already
   has 'hi', translation failed, or 'en' isn't a string). Never recurses
   into a translation wrapper — that was the bug that ballooned bio.json. */
async function ensureHindi(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return v;
  if (!isTLObject(v)) return v;
  if (typeof v.hi === 'string') return v;
  var enVal = v.en;
  if (typeof enVal !== 'string') return v;
  const hi = await translateText(enVal, 'hi');
  if (hi === enVal) return v;
  var out = {};
  for (const k of Object.keys(v)) out[k] = v[k];
  out.hi = hi;
  return out;
}

/* Add 'zh' (Mandarin Chinese) to a translation object that has 'en'
   but lacks 'zh'. Companion to ensureHindi(); requires the object to
   already have a 'hi' suffix because both extenders run in the same
   migration pass and we want 'hi' added first.

   If the object lacks 'hi', passes it through unconditionally so the
   outer pipeline can re-process it. (If we returned a partial 5-key
   object missing 'hi', isTLObject would still match but the caller
   wouldn't know it's incomplete.) */
async function ensureMandarin(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return v;
  if (!isTLObject(v)) return v;
  if (typeof v.hi !== 'string') return v;
  if (typeof v.zh === 'string') return v;
  var enVal = v.en;
  if (typeof enVal !== 'string') return v;
  const zh = await translateText(enVal, 'zh');
  if (zh === enVal) return v;
  var out = {};
  for (const k of Object.keys(v)) out[k] = v[k];
  out.zh = zh;
  return out;
}

const cache = new Map();

async function translateText(text, targetLang) {
  if (!text || typeof text !== 'string') return text;
  const trimmed = text.trim();
  if (!trimmed) return text;
  if (isBrand(trimmed)) return text;

  const cacheKey = `${text}__${targetLang}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const targetCode = targetLang === 'pt' ? 'pt-PT' : (targetLang === 'zh' ? 'zh-CN' : targetLang);
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetCode}&dt=t&q=${encodeURIComponent(text)}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    const translated = (data && data[0]) ? data[0].map(x => x[0]).join('') : text;
    cache.set(cacheKey, translated);
    return translated;
  } catch (e) {
    console.warn(`  ! translate failed for "${text.substring(0, 40)}…" [${targetLang}]: ${e.message}`);
    return text;
  }
}

function looksLikeText(s) {
  if (typeof s !== 'string') return false;
  if (s.length < 2) return false;
  if (/^https?:\/\//i.test(s)) return false;
  if (/^#?\/?[a-z0-9_/-]+\.(html|md|json|pdf|jpg|png|webp)/i.test(s)) return false;
  if (/^[a-f0-9-]{8,}$/i.test(s)) return false;
  return true;
}

async function enrich(node, path = []) {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      node[i] = await enrich(node[i], [...path, String(i)]);
    }
    return node;
  }
  if (node && typeof node === 'object') {
    /* GUARD: if the node itself is already a { en, pt, es } translation
       wrapper, leave it untouched. Walking into it would re-translate
       each string and wrap again — the bug that ballooned bio.json. */
    if (isTLObject(node)) return node;

    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (typeof v === 'string' && looksLikeText(v)) {
        if (/^(url|file|credential_url|credential_id|datetime|date)$/i.test(k)) {
          out[k] = v;
          continue;
        }
        const pt = await translateText(v, 'pt');
        const es = await translateText(v, 'es');
        const hi = await translateText(v, 'hi');
        const zh = await translateText(v, 'zh');
        out[k] = (pt === v && es === v && hi === v && zh === v) ? v : { en: v, pt, es, hi, zh };
      } else if (v && typeof v === 'object') {
        if (isTLObject(v)) {
          /* Already a translation object — extend it with 'hi' and 'zh'
             if missing (in that order: ensureHindi first, then ensureMandarin
             which requires 'hi' to be present), otherwise pass through.
             We never recurse into a translation wrapper (corruption guard). */
          const hiAdded = await ensureHindi(v);
          out[k] = await ensureMandarin(hiAdded);
        } else {
          out[k] = await enrich(v, [...path, k]);
        }
      } else {
        out[k] = v;
      }
    }
    return out;
  }
  return node;
}

const FILES = ['bio.json', 'cv.json', 'now.json'];
const GALLERY_PATH = join(ROOT, 'gallery', 'index.json');
const GALLERY_FIELDS = new Set(['title', 'alt', 'target', 'notes']);

async function enrichGallery(node) {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) node[i] = await enrichGallery(node[i]);
    return node;
  }
  if (node && typeof node === 'object') {
    /* Same guard as enrich(): leaves already-translated values alone. */
    if (isTLObject(node)) return node;

    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (typeof v === 'string' && GALLERY_FIELDS.has(k) && looksLikeText(v)) {
        const pt = await translateText(v, 'pt');
        const es = await translateText(v, 'es');
        const hi = await translateText(v, 'hi');
        const zh = await translateText(v, 'zh');
        out[k] = (pt === v && es === v && hi === v && zh === v) ? v : { en: v, pt, es, hi, zh };
      } else if (v && typeof v === 'object') {
        if (isTLObject(v)) {
          /* Same migration pass order as enrich(): hi first, then zh.
             ensureMandarin requires 'hi' to be present to act. */
          const hiAdded = await ensureHindi(v);
          out[k] = await ensureMandarin(hiAdded);
        } else {
          out[k] = await enrichGallery(v);
        }
      } else {
        out[k] = v;
      }
    }
    return out;
  }
  return node;
}

/* Walk certificates/*.md. For each, find the frontmatter and convert any
   `name:`, `issuer:`, `bio:` plain-string values to a JSON object literal
   of shape { en, pt, es }. The certs page's parseFrontmatter() detects
   JSON-shaped values and feeds them to i18n.localize(). */
const CERT_MD_FIELDS = ['name', 'issuer', 'bio'];

async function translateCertMd(mdText) {
  const m = mdText.match(/^---\r?\n([\s\S]+?)(?:\r?\n---[ \t]*(?:\r?\n?|\s*$)|---[ \t]*$)/m);
  if (!m) return mdText;
  const fmBody = m[1];
  const rest = mdText.slice(m[0].length);
  const lines = fmBody.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const colon = line.indexOf(':');
    if (colon <= 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const val = line.slice(colon + 1).trim().replace(/^['"]|['"]$/g, '');
    if (CERT_MD_FIELDS.indexOf(key) < 0) continue;
    if (!val) continue;
    if (val.charAt(0) === '{') {
      /* Already a JSON-stringified translation object. Try to extend it
         with 'hi' / 'zh' if missing — same path as the data-file migration. */
      try {
        const obj = JSON.parse(val);
        if (obj && typeof obj === 'object' && !Array.isArray(obj) && isTLObject(obj)) {
          if (typeof obj.hi !== 'string' && typeof obj.en === 'string') {
            const hi = await translateText(obj.en, 'hi');
            if (hi !== obj.en) obj.hi = hi;
          }
          if (typeof obj.hi === 'string' && typeof obj.zh !== 'string' && typeof obj.en === 'string') {
            const zh = await translateText(obj.en, 'zh');
            if (zh !== obj.en) obj.zh = zh;
          }
          lines[i] = key + ': ' + JSON.stringify(obj);
        }
      } catch (e) { /* malformed JSON, leave the line alone */ }
      continue;
    }
    const pt = await translateText(val, 'pt');
    const es = await translateText(val, 'es');
    const hi = await translateText(val, 'hi');
    const zh = await translateText(val, 'zh');
    if (pt === val && es === val && hi === val && zh === val) continue;
    lines[i] = key + ': ' + JSON.stringify({ en: val, pt, es, hi, zh });
  }
  return '---\n' + lines.join('\n') + '---' + rest;
}

async function translateCertsDir() {
  let files;
  try {
    files = await (await import('node:fs/promises')).readdir(join(ROOT, 'certificates'));
  } catch (e) { return; }
  if (!Array.isArray(files)) return;
  for (const f of files) {
    if (!f.toLowerCase().endsWith('.md')) continue;
    const p = join(ROOT, 'certificates', f);
    const md = await readFile(p, 'utf8');
    const translated = await translateCertMd(md);
    if (translated !== md) {
      await writeFile(p, translated, 'utf8');
      console.log(`  ✓ ${f}`);
    }
  }
}

for (const file of FILES) {
  const path = join(DATA_DIR, file);
  const before = JSON.parse(await readFile(path, 'utf8'));
  console.log(`• ${file} — translating…`);
  const after = await enrich(before);
  await writeFile(path, JSON.stringify(after, null, 2) + '\n', 'utf8');
  console.log(`  ✓ wrote ${path}`);
}

try {
  const before = JSON.parse(await readFile(GALLERY_PATH, 'utf8'));
  console.log('• gallery/index.json — translating…');
  const after = await enrichGallery(before);
  await writeFile(GALLERY_PATH, JSON.stringify(after, null, 2) + '\n', 'utf8');
  console.log(`  ✓ wrote ${GALLERY_PATH}`);
} catch (e) {
  console.warn(`! skip gallery/index.json: ${e.message}`);
}

console.log('• certificates/*.md — translating name frontmatter…');
await translateCertsDir();

console.log('');
console.log('Done. Review the diff with `git diff data/ gallery/ certificates/`.');
