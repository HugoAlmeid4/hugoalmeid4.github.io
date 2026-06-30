const fs = require('fs').promises;
const path = require('path');

const certsDir = path.join(__dirname, 'certificates');
const indexPath = path.join(certsDir, 'index.json');

async function updateIndex() {
  try {
    // 1. Ensure the directory exists before scanning
    await fs.mkdir(certsDir, { recursive: true });

    // 2. Read directory entries directly
    const files = await fs.readdir(certsDir);

    // 3. Filter only markdown files
    const mdFiles = files.filter(file => file.endsWith('.md'));

    // 4. Atomic file write (non-blocking promise)
    await fs.writeFile(indexPath, JSON.stringify(mdFiles, null, 2), 'utf8');
    
    console.log(`[Success] index.json updated with ${mdFiles.length} certificates.`);
  } catch (err) {
    console.error(`[Error] Failed to update certificate index: ${err.message}`);
  }
}

updateIndex();