#!/usr/bin/env node
// scripts/repair-translation-corruption.mjs
// ────────────────────────────────────────────────────────────────────────
// Repair data/*.json files corrupted by the recursive-nesting bug in
// scripts/translate-content.mjs. That bug caused each subsequent run to
// wrap existing { en, pt, es } values in another { en, pt, es } layer,
// growing files from a few KB to 100+ MB after only a handful of runs.
//
// The repair walks the JSON tree and treats every object whose keys are a
// subset of { en, pt, es } as a translation-shaped wrapper. Each language
// is drilled down to its deepest surviving string, then re-assembled into
// a single canonical { en, pt, es } object so consumers (i18n.localize(),
// bio.js pickString, etc.) see the shape they expect.
//
// Safe to run repeatedly: collapsing a clean file is a no-op.
//
// Usage:  node scripts/repair-translation-corruption.mjs [--dry]
// ────────────────────────────────────────────────────────────────────────
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT     = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'data');

const LANGS = ['en', 'pt', 'es'];
const LANG_SET = new Set(LANGS);

const DRY = process.argv.includes('--dry');

function isTLObject(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const keys = Object.keys(v);
  if (!keys.length) return false;
  if (keys.length > LANGS.length) return false;
  return keys.every((k) => LANG_SET.has(k));
}

/* Drill down the requested locale, then collapse whatever is left. */
function drill(v, lang) {
  while (v && typeof v === 'object' && !Array.isArray(v)) {
    if (isTLObject(v) && Object.prototype.hasOwnProperty.call(v, lang)) {
      v = v[lang];
    } else {
      break;
    }
  }
  return collapse(v);
}

/* Recurse into arrays, recurse into generic objects, collapse TL wrappers. */
function collapse(v) {
  if (v == null) return v;
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(collapse);
  if (typeof v !== 'object') return v;

  if (isTLObject(v)) {
    const out = {};
    for (const lang of LANGS) {
      if (Object.prototype.hasOwnProperty.call(v, lang)) {
        out[lang] = drill(v[lang], lang);
      }
    }
    /* If every layer collapses to the same string (corruption grouped
       identical translations), keep the object shape so consumers can
       still localize — don't accidentally simplify to a plain string. */
    return out;
  }

  const out = {};
  for (const [k, val] of Object.entries(v)) out[k] = collapse(val);
  return out;
}

async function repair(file) {
  const path = join(DATA_DIR, file);
  const text = await readFile(path, 'utf8');
  const before = JSON.parse(text);
  const after  = collapse(before);

  /* Quick shape diff just for logging. */
  function shape(v, depth = 0) {
    if (v == null) return 'null';
    if (typeof v === 'string') return `str(${v.length})`;
    if (Array.isArray(v)) return `arr(${v.length})`;
    if (typeof v === 'object') {
      if (depth > 5) return 'obj(...)';
      const ks = Object.keys(v);
      const isTL = ks.length && ks.every((k) => LANG_SET.has(k));
      if (isTL && ks.includes('en')) {
        return `TL{${ks.map((k) => `${k}:${typeof v[k]}`).join(' ')}}`;
      }
      return 'obj{' + ks.slice(0, 4).map((k) => `${k}:${shape(v[k], depth + 1)}`).join(' ') + '}';
    }
    return typeof v;
  }
  console.log(`• ${file}`);
  console.log(`  before.bio: ${shape(before.bio)}`);
  console.log(`  after.bio:  ${shape(after.bio)}`);

  /* JSON.stringify(2) gives a smaller, parse-clean output than the
     corrupted file's deeply nested mass. */
  const out = JSON.stringify(after, null, 2) + '\n';
  const beforeBytes = Buffer.byteLength(text, 'utf8');
  const afterBytes  = Buffer.byteLength(out, 'utf8');
  console.log(`  size: ${(beforeBytes / 1048576).toFixed(2)} MB → ${(afterBytes / 1024).toFixed(1)} KB`);

  if (!DRY) {
    await writeFile(path, out, 'utf8');
    console.log(`  ✓ wrote ${path}`);
  } else {
    console.log(`  (dry) skipped write`);
  }
}

const files = ['bio.json', 'cv.json', 'now.json'];
for (const f of files) {
  try {
    await repair(f);
  } catch (e) {
    console.error(`  ✗ ${f}: ${e.message}`);
  }
}
console.log('Repair complete. Review the diff with `git diff data/`.');
