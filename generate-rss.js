const fs = require('fs');
const path = require('path');

const postsDir = path.join(__dirname, 'posts');
const indexJsonPath = path.join(postsDir, 'index.json');
const rssPath = path.join(__dirname, 'rss.xml');

// Helper to parse frontmatter manually to avoid dependencies
function parseFrontmatter(mdContent) {
  const fmMatch = mdContent.match(/^---\r?\n([\s\S]+?)\r?\n---[ \t]*\r?\n?/);
  if (!fmMatch) return { metadata: {}, content: mdContent };
  
  const metadata = {};
  fmMatch[1].split('\n').forEach(line => {
    const colon = line.indexOf(':');
    if (colon > 0) {
      const key = line.slice(0, colon).trim();
      let value = line.slice(colon + 1).trim();
      // Remove surrounding quotes if present
      value = value.replace(/^['"]|['"]$/g, '');
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

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
}

function run() {
  console.log('Generating posts/index.json and rss.xml...');
  
  if (!fs.existsSync(postsDir)) {
    console.error('Posts directory does not exist!');
    process.exit(1);
  }

  const files = fs.readdirSync(postsDir);
  const mdFiles = files.filter(f => f.endsWith('.md'));
  
  const posts = [];
  
  for (const filename of mdFiles) {
    const filePath = path.join(postsDir, filename);
    const mdContent = fs.readFileSync(filePath, 'utf8');
    const { metadata, content } = parseFrontmatter(mdContent);
    
    const slug = filename.replace(/\.md$/, '');
    const cleanText = cleanMarkdown(content);
    
    const title = metadata.title || slug.replace(/-/g, ' ');
    const dateStr = metadata.date || new Date().toISOString().slice(0, 10);
    const excerpt = metadata.excerpt || (cleanText.slice(0, 180) + '...');
    const author = metadata.author || '';
    
    // Parse date for sorting
    let ds = dateStr;
    if (/^\d{4}-\d{2}-\d{2}$/.test(ds)) ds += 'T00:00:00';
    const parsedDate = new Date(ds);
    const finalDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
    
    posts.push({
      filename,
      slug,
      title,
      dateStr,
      parsedDate: finalDate,
      excerpt,
      author
    });
  }
  
  // Sort posts from newest to oldest
  posts.sort((a, b) => b.parsedDate - a.parsedDate);
  
  // 1. Write posts/index.json
  const indexJsonContent = JSON.stringify(posts.map(p => p.filename), null, 2);
  fs.writeFileSync(indexJsonPath, indexJsonContent + '\n', 'utf8');
  console.log(`Updated ${indexJsonPath} with ${posts.length} posts.`);
  
  // 2. Generate rss.xml
  const siteUrl = 'https://hugoalmeid4.github.io';
  const lastBuildDate = new Date().toUTCString();
  
  let rssXml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>Hralmeida</title>
  <link>${siteUrl}</link>
  <description>Hralmeida's personal website and blog.</description>
  <language>en-us</language>
  <lastBuildDate>${lastBuildDate}</lastBuildDate>
  <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml" />
`;

  for (const post of posts) {
    const postUrl = `${siteUrl}/?post=${post.slug}`;
    const pubDate = post.parsedDate.toUTCString();
    
    rssXml += `  <item>
    <title>${escapeXml(post.title)}</title>
    <link>${postUrl}</link>
    <guid>${postUrl}</guid>
    <pubDate>${pubDate}</pubDate>
    <description>${escapeXml(post.excerpt)}</description>
  </item>
`;
  }

  rssXml += `</channel>
</rss>
`;

  fs.writeFileSync(rssPath, rssXml, 'utf8');
  console.log(`Generated ${rssPath} successfully.`);
}

run();
