#!/usr/bin/env node
// scripts/cache-bust.mjs
// ──────────────────────────────────────────────────────────────────────────
// Bump cache-buster versions in HTML files AND the service worker in one
// shot, so they stay in lockstep on every deploy.
//
// Why: GitHub Pages serves static assets with long cache lifetimes. Without
// version pins, hard-refresh is the only way to see updates. With `?v=N`
// in the URL, the browser re-fetches when the number changes.
//
// What this script touches:
//   1. *.html in repo root        — bumps `?v=N` in <link>/<script> URLs
//   2. sw.js                      — bumps `CACHE_VERSION` (e.g. v3 → v4)
//                                    AND every `?v=N` inside PRECACHE
//
// Without bumping sw.js alongside the HTML, the service worker's precache
// would serve stale `./style.css` while HTML now asks for `./style.css?v=2`.
// We refuse to silently half-update — if the CACHE_VERSION line doesn't
// match the expected pattern, the script throws and aborts. This is the only
// way to guarantee the two stay in lockstep.
//
// Usage (from the repo root):
//   node scripts/cache-bust.mjs
//
// Safe to run multiple times — each run increments by 1. No deps; Node 14+.
// ──────────────────────────────────────────────────────────────────────────

import { readFile, writeFile, readdir } from 'node:fs/promises';

const ROOT = process.cwd();

const HTML_FILES = (await readdir(ROOT))
  .filter((name) => name.endsWith('.html'))
  .sort();

const SW_FILE = 'sw.js';

// Line-anchored so a future comment like `// const CACHE_VERSION = ...` can't
// false-match. Matches `const CACHE_VERSION = 'hralmeida-v3';` with optional
// trailing semicolon and trailing whitespace.
const SW_VERSION_LINE_RE = /^const CACHE_VERSION\s*=\s*'hralmeida-v(\d+)'\s*;?\s*$/m;
const VERSION_RE = /\?v=(\d+)/g;
// Same-origin asset href/src in HTML. Skips cross-origin URLs (CDN, fonts,
// giscus) because those manage their own caching — the bump step below
// wouldn't touch them anyway since they have no ?v=.
// Negative lookbehind rejects attribute names preceded by a letter or hyphen,
// so `data-href="X.css"` or `data-src="X.js"` don't false-positive.
const HTML_ASSET_URL_RE = /(?<![a-zA-Z-])(?:href|src)=["']([^"']+\.(?:css|js))["']/g;

async function bumpHtmlFile(file) {
  const before = await readFile(file, 'utf8');

  // Pre-flight: every local CSS/JS href/src in this HTML must already carry
  // ?v=N — otherwise the bump step below has nothing to increment and the
  // asset is stuck on the (uncache-busted) original URL forever.
  const offendingLines = before.split('\n')
    .map((line, i) => ({ line, i: i + 1 }))
    .filter(({ line }) => {
      const matches = [...line.matchAll(HTML_ASSET_URL_RE)];
      return matches.some((m) => {
        const url = m[1];
        const isCrossOrigin = /^https?:\/\//.test(url) || /^\/\//.test(url);
        const isVersioned = /\?v=\d+/.test(url);
        return !isCrossOrigin && !isVersioned;
      });
    });
  if (offendingLines.length > 0) {
    const sample = offendingLines.slice(0, 5)
      .map(({ i, line }) => `\n  line ${i}: ${line.trim()}`)
      .join('');
    const more = offendingLines.length > 5 ? `\n  ...and ${offendingLines.length - 5} more` : '';
    throw new Error(
      `${file}: ${offendingLines.length} local CSS/JS asset reference${offendingLines.length === 1 ? '' : 's'} without ?v=N. ` +
      `Add ?v=1 to each href/src (e.g. href="style.css?v=1") and rerun. Offending lines:${sample}${more}`
    );
  }

  const after = before.replace(VERSION_RE, (_, n) => `?v=${Number(n) + 1}`);
  if (before === after) return 0;
  await writeFile(file, after, 'utf8');
  return (before.match(/\?v=\d+/g) || []).length;
}

async function bumpSwFile(file) {
  const before = await readFile(file, 'utf8');

  // 0. Pre-flight: PRECACHE entries for same-origin CSS/JS must include
  //    `?v=N`, otherwise the cache-bust bump below leaves them stale forever
  //    (no number to increment). Catch this before we touch anything.
  const unversionedAsset = before.match(/'\.\/[a-zA-Z0-9._-]+\.(?:css|js)'/g);
  if (unversionedAsset) {
    // Find the lines containing those unversioned entries so the error is
    // actionable (line numbers, not just filenames).
    const offendingLines = before.split('\n')
      .map((line, i) => ({ line, i: i + 1 }))
      .filter(({ line }) => /'\.\/[a-zA-Z0-9._-]+\.(?:css|js)'/.test(line) && !/\?v=\d+/.test(line));
    const sample = offendingLines.slice(0, 5)
      .map(({ i, line }) => `\n  line ${i}: ${line.trim()}`)
      .join('');
    const more = offendingLines.length > 5 ? `\n  ...and ${offendingLines.length - 5} more` : '';
    throw new Error(
      `${file}: ${offendingLines.length} PRECACHE entr${offendingLines.length === 1 ? 'y' : 'ies'} for local CSS/JS without ?v=N. ` +
      `Add ?v=1 to each (e.g. './style.css?v=1') and rerun. Offending lines:${sample}${more}`
    );
  }

  // 1. Bump CACHE_VERSION. Fail loud if the regex doesn't match — silently
  //    bumping PRECACHE URLs while leaving CACHE_VERSION stale would produce
  //    a confusing half-update.
  const versionMatch = before.match(SW_VERSION_LINE_RE);
  if (!versionMatch) {
    throw new Error(
      `${file}: could not find a line matching 'const CACHE_VERSION = \\'hralmeida-vN\\';'. ` +
      `Either the line is missing, formatted differently, or this script's regex needs updating. ` +
      `Refusing to half-update.`
    );
  }
  const newVersion = Number(versionMatch[1]) + 1;
  let after = before.replace(SW_VERSION_LINE_RE, (line) =>
    line.replace(`'hralmeida-v${versionMatch[1]}'`, `'hralmeida-v${newVersion}'`)
  );

  // 2. Bump every ?v=N inside (PRECACHE entries today; future-proof for
  //    any other ?v=N the file might end up with).
  const precacheCount = (after.match(/\?v=\d+/g) || []).length;
  after = after.replace(VERSION_RE, (_, n) => `?v=${Number(n) + 1}`);

  await writeFile(file, after, 'utf8');
  return { version: true, urls: precacheCount };
}

let totalBumped = 0;
const reports = [];

for (const file of HTML_FILES) {
  const count = await bumpHtmlFile(file);
  if (count > 0) {
    reports.push(`  ${file.padEnd(20)} ${count} URL${count === 1 ? '' : 's'} bumped`);
    totalBumped += count;
  }
}

const swResult = await bumpSwFile(SW_FILE);
if (swResult.version) {
  reports.push(
    `  ${SW_FILE.padEnd(20)} CACHE_VERSION + ${swResult.urls} PRECACHE URL${swResult.urls === 1 ? '' : 's'} bumped`
  );
  totalBumped += 1;
}

if (totalBumped === 0) {
  console.log('No cache-busters found. Nothing to do.');
  console.log('');
  console.log('Tip: if this is a fresh checkout, add ?v=1 to your <link> and');
  console.log('    <script> URLs in HTML files by hand, then rerun this script.');
  process.exit(0);
}

console.log(`✓ Bumped cache-busters in ${reports.length} file${reports.length === 1 ? '' : 's'}:`);
for (const line of reports) console.log(line);
console.log('');
console.log('Next: review the diff, then');
console.log('  git add .');
console.log('  git commit -m "Bump asset cache version"');
console.log('  git push');
