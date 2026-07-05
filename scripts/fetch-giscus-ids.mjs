#!/usr/bin/env node
// scripts/fetch-giscus-ids.mjs
//
// One-shot helper: reads GitHub Discussion categories on
// HugoAlmeid4/hugoalmeid4.github.io using your PAT, lists them, lets you
// pick one, and patches giscus-config.js in place. Token never leaves your
// terminal.
//
// Usage (from repo root, alongside giscus-config.js):
//
//   GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxx node scripts/fetch-giscus-ids.mjs
//
// or just:
//
//   node scripts/fetch-giscus-ids.mjs   (will prompt for token)
//
// Token scope: classic PAT with `repo` scope is fine. For fine-grained PATs,
// you need: Discussions: Read + Metadata: Read on the same repo.
// Your Sveltia CMS Contents:RW PAT typically works because GraphQL read
// access for repo metadata + discussions is implicit under classic `repo`,
// but fine-grained token users may need to add Discussions: Read.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const REPO = 'HugoAlmeid4/hugoalmeid4.github.io';
const CONFIG = 'giscus-config.js';

const QUERY = `
query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    discussionCategories(first: 20) {
      nodes { id name }
    }
  }
}
`.trim();

async function prompt(q) {
  const rl = createInterface({ input, output });
  try {
    return (await rl.question(q)).trim();
  } finally {
    rl.close();
  }
}

async function fetchCategories(token) {
  const [owner, name] = REPO.split('/');
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'fetch-giscus-ids'
    },
    body: JSON.stringify({ query: QUERY, variables: { owner, name } })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  if (json.errors) {
    throw new Error('GraphQL errors: ' + JSON.stringify(json.errors));
  }
  if (json.message) {
    // E.g. "Bad credentials" comes through as { message, documentation_url }
    throw new Error(`GitHub error: ${json.message}`);
  }
  return json.data?.repository?.discussionCategories?.nodes ?? [];
}

async function main() {
  let token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
  if (!token) {
    token = await prompt('GitHub PAT (read access to discussions): ');
  }
  if (!token) {
    console.error('No token. Set GITHUB_TOKEN env var or paste when prompted.');
    process.exit(1);
  }

  if (!existsSync(CONFIG)) {
    console.error(`${CONFIG} not found. Run this from the repo root.`);
    process.exit(1);
  }

  console.log(`\nFetching categories on ${REPO}…\n`);
  const cats = await fetchCategories(token);
  if (cats.length === 0) {
    console.error(
      'Repo has no Discussion categories.\n' +
      'Create one first: github.com/HugoAlmeid4/hugoalmeid4.github.io\n' +
      'Settings → Features → Discussions → "Set up categories" → save.'
    );
    process.exit(1);
  }

  cats.forEach((c, i) => console.log(`  [${i + 1}] ${c.name}    ${c.id}`));
  const ans = await prompt('\nPick a category number: ');
  const idx = parseInt(ans, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx >= cats.length) {
    console.error('Invalid selection.');
    process.exit(1);
  }
  const chosen = cats[idx];

  let cfg = readFileSync(CONFIG, 'utf8');
  cfg = cfg
    .replace(
      /(window\.GISCUS_CATEGORY\s*=\s*)['"][^'"]*['"]/,
      `$1'${chosen.name}'`
    )
    .replace(
      /(window\.GISCUS_CATEGORY_ID\s*=\s*)['"][^'"]*['"]/,
      `$1'${chosen.id}'`
    );

  writeFileSync(CONFIG, cfg, 'utf8');
  console.log(`\n${CONFIG} patched.`);
  console.log(`  GISCUS_CATEGORY    = '${chosen.name}'`);
  console.log(`  GISCUS_CATEGORY_ID = '${chosen.id}'`);
  console.log('\nNext: git add giscus-config.js && git commit && git push.');
  console.log('Then hard-reload the live site — comments are live.');
}

main().catch((err) => {
  console.error('\n' + (err.message || err));
  process.exit(1);
});
