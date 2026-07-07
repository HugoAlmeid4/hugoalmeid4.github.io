#!/usr/bin/env node
// scripts/translate-content.mjs
// ──────────────────────────────────────────────────────────────────────────
// Translate the small per-page data JSON files (bio.json, cv.json, now.json)
// into Portuguese (pt) and Spanish (es) using the same unofficial Google
// Translate endpoint that posts.js uses at runtime. Run once after you edit
// the English source — no rebuild step needed at runtime.
//
// What gets translated: human-readable text fields (paragraphs, headlines,
// skill descriptions, project descriptions, interest strings, block intros,
// reading list items).
//
// What gets skipped:
//   - URLs, dates, credential IDs (non-translatable strings)
//   - Brand / proper-noun arrays (skill chip items like "Python", "Siril",
//     "Stellarium", "DeepSkyStacker", "HTML", etc.) — translating these
//     produces wrong results (e.g. "Python" → "Pitão").
//   - Emoji icons ("🐙", "🦊", "✉️").
//
// Output: leaves the original English values intact and augments each
// text-bearing field with `_pt` and `_es` siblings, OR replaces the field
// with an object { en, pt, es } if it's a single string.
//
// Usage:  node scripts/translate-content.mjs
// ──────────────────────────────────────────────────────────────────────────

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'data');

// Brand / software names we never want to translate — Google's API would
// otherwise produce wrong results like "Python" → "Píton".
const BRAND_WORDS = new Set([
  'python', 'html', 'css', 'git', 'markdown', 'linux',
  'siril', 'stellarium', 'deepskystacker', 'gimp',
  'english', 'portuguese', 'spanish',
  'lilex', 'json', 'md', 'pdf'
]);

function isBrand(str) {
  if (!str) return false;
  const cleaned = String(str).trim().toLowerCase();
  return BRAND_WORDS.has(cleaned);
}

// Cache: { inputText_targetLang: translatedText }. Run-time only — no
// persistence; the script is meant to be run on demand, output baked in.
const cache = new Map();

async function translateText(text, targetLang) {
  if (!text || typeof text !== 'string') return text;
  const trimmed = text.trim();
  if (!trimmed) return text;

  // Skip brand / proper-noun only strings entirely.
  if (isBrand(trimmed)) return text;

  const cacheKey = `${text}__${targetLang}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const targetCode = targetLang === 'pt' ? 'pt-PT' : targetLang;
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

// Decide whether a string value is "user-visible text" worth translating.
// Very short strings (<2 words) that look like URLs/IDs/keys are skipped.
function looksLikeText(s) {
  if (typeof s !== 'string') return false;
  if (s.length < 2) return false;
  if (/^https?:\/\//i.test(s)) return false;
  if (/^#?\/?[a-z0-9_/-]+\.(html|md|json|pdf|jpg|png|webp)/i.test(s)) return false;
  if (/^[a-f0-9-]{8,}$/i.test(s)) return false; // hex IDs
  return true;
}

// Recursively walk the data file, translating every string value. Mutates
// the object in place. Skips arrays of names like social labels where some
// items might be brands.
async function enrich(node, path = []) {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      node[i] = await enrich(node[i], [...path, String(i)]);
    }
    return node;
  }
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (typeof v === 'string' && looksLikeText(v)) {
        // Skip fields that are obviously non-text even if `looksLikeText`
        // returned true. (e.g. cert `file` and `credential_url`.)
        if (/^(url|file|credential_url|credential_id|datetime|date)$/i.test(k)) {
          out[k] = v;
          continue;
        }
        // Skip items inside known proper-noun arrays.
        if (path[0] === 'items' && k === 'item_unused') {
          // legacy guard — not actually hit, kept for clarity
          out[k] = v;
          continue;
        }
        const pt = await translateText(v, 'pt');
        const es = await translateText(v, 'es');
        if (pt === v && es === v) {
          // No translation needed (likely brand). Keep as plain string.
          out[k] = v;
        } else {
          out[k] = { en: v, pt, es };
        }
      } else if (v && typeof v === 'object') {
        out[k] = await enrich(v, [...path, k]);
      } else {
        out[k] = v;
      }
    }
    return out;
  }
  return node;
}

const FILES = ['bio.json', 'cv.json', 'now.json'];

for (const file of FILES) {
  const path = join(DATA_DIR, file);
  const before = JSON.parse(await readFile(path, 'utf8'));
  console.log(`• ${file} — translating…`);
  const after = await enrich(before);
  // Pretty 2-space indent keeps diffs readable.
  await writeFile(path, JSON.stringify(after, null, 2) + '\n', 'utf8');
  console.log(`  ✓ wrote ${path} (cache hits: ${cache.size})`);
}

console.log('');
console.log('Done. Reviews the diff with `git diff data/`.');
