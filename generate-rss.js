const fs = require('fs');
const path = require('path');

const postsDir = path.join(__dirname, 'posts');
const indexJsonPath = path.join(postsDir, 'index.json');
const rssPath = path.join(__dirname, 'rss.xml');
const siteUrl = 'https://hugoalmeid4.github.io';

function parseFrontmatter(mdContent) {
  const fmMatch = mdContent.match(/^---\r?\n([\s\S]+?)\r?\n---[ \t]*\r?\n?/);
  if (!fmMatch) return { metadata: {}, content: mdContent };
  const metadata = {};
  fmMatch[1].split('\n').forEach(line => {
    const colon = line.indexOf(':');
    if (colon > 0) {
      const key = line.slice(0, colon).trim();
      let value = line.slice(colon + 1).trim().replace(/^['"]|['"]$/g, '');
      metadata[key] = value;
    }
  });
  return { metadata, content: mdContent.slice(fmMatch[0].length) };
}

function cleanMarkdown(content) {
  return content
    .replace(/!\[\[.*?\]\]/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/[#*`_|~>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeXml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function run() {
  console.log('Scanning posts/...');
  const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.md'));

  const posts = files.map(filename => {
    const raw = fs.readFileSync(path.join(postsDir, filename), 'utf8');
    const { metadata, content } = parseFrontmatter(raw);
    const slug = filename.replace(/\.md$/, '');
    const cleanText = cleanMarkdown(content);
    const title = metadata.title || slug.replace(/-/g, ' ');
    const dateStr = metadata.date || new Date().toISOString().slice(0, 10);
    let ds = dateStr;
    if (/^\d{4}-\d{2}-\d{2}$/.test(ds)) ds += 'T00:00:00';
    const parsedDate = new Date(ds);
    const finalDate = isNaN(parsedDate) ? new Date() : parsedDate;
    const excerpt = metadata.excerpt || (cleanText.slice(0, 180) + '...');
    return { filename, slug, title, dateStr, parsedDate: finalDate, excerpt, author: metadata.author || '' };
  }).sort((a, b) => b.parsedDate - a.parsedDate);

  // Write posts/index.json (newest first)
  fs.writeFileSync(indexJsonPath, JSON.stringify(posts.map(p => p.filename), null, 2) + '\n', 'utf8');
  console.log(`posts/index.json updated with ${posts.length} posts.`);

  // Write rss.xml
  let rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Hralmeida</title>
    <link>${siteUrl}</link>
    <description>Hralmeida's personal website and blog.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml"/>
`;
  for (const p of posts) {
    rss += `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${siteUrl}/?post=${p.slug}</link>
      <guid isPermaLink="true">${siteUrl}/?post=${p.slug}</guid>
      <pubDate>${p.parsedDate.toUTCString()}</pubDate>
      <description>${escapeXml(p.excerpt)}</description>
    </item>
`;
  }
  rss += `  </channel>
</rss>
`;
  fs.writeFileSync(rssPath, rss, 'utf8');
  console.log(`rss.xml updated.`);
}

run();
