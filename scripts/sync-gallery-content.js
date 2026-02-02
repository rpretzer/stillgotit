import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = new URL('..', import.meta.url);
const MANIFEST_PATH = path.resolve(ROOT.pathname, 'assets/images/uploads/gallery/manifest.json');
const GALLERY_CONTENT_PATH = path.resolve(ROOT.pathname, 'content/gallery.json');

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log('Syncing gallery content from manifest...');

  if (!await fileExists(MANIFEST_PATH)) {
    console.error('Manifest not found:', MANIFEST_PATH);
    process.exit(1);
  }

  const manifestContent = await fs.readFile(MANIFEST_PATH, 'utf8');
  const manifest = JSON.parse(manifestContent);
  
  let gallery = { images: [] };
  if (await fileExists(GALLERY_CONTENT_PATH)) {
    try {
      const galleryContent = await fs.readFile(GALLERY_CONTENT_PATH, 'utf8');
      gallery = JSON.parse(galleryContent);
    } catch (e) {
      console.warn('Could not parse existing gallery.json, starting fresh.', e);
    }
  }

  if (!Array.isArray(gallery.images)) {
    gallery.images = [];
  }

  // Create a set of existing image src paths for quick lookup
  const existingSrcs = new Set(gallery.images.map(img => img.src));
  let addedCount = 0;

  // Manifest items are sorted by source, but we might want new ones at the top?
  // The gallery.json order determines display order.
  // Usually, we want newer images at the top (beginning of the array).
  // The manifest is sorted by source filename.
  
  const newItems = [];

  for (const item of manifest.items) {
    // Manifest paths are relative to root, e.g. "assets/images/..."
    // Gallery paths need leading slash, e.g. "/assets/images/..."
    const src = '/' + item.full;
    const thumb = '/' + item.thumb;

    if (!existingSrcs.has(src)) {
      // derive a simple alt text from the source filename
      // item.source is relative path "assets/images/_incoming_raw/filename.jpg"
      // we want just "filename" (no ext)
      const filename = path.basename(item.source, path.extname(item.source));
      // replace dashes/underscores with spaces for better default alt
      const alt = filename.replace(/[-_]/g, ' ');

      newItems.push({
        src,
        thumb,
        alt,
        featured: false,
        _source: item.source // temporary for sorting
      });
      existingSrcs.add(src);
      addedCount++;
    }
  }

  if (addedCount > 0) {
    // Sort new items descending by source filename (Z-A)
    // This assumes newer files have "higher" filenames (e.g. 2026 vs 2025, or seq-10 vs seq-1)
    newItems.sort((a, b) => {
      const sourceA = String(a._source || '').toLowerCase();
      const sourceB = String(b._source || '').toLowerCase();
      return sourceB.localeCompare(sourceA, undefined, { numeric: true, sensitivity: 'base' });
    });

    // Cleanup temporary field
    newItems.forEach(item => delete item._source);

    // Prepend new items to the beginning of the list (newest first assumption)
    gallery.images = [...newItems, ...gallery.images];
    
    await fs.writeFile(GALLERY_CONTENT_PATH, JSON.stringify(gallery, null, 2) + '\n', 'utf8');
    console.log(`Successfully synced. Added ${addedCount} new images to gallery.json.`);
  } else {
    console.log('No new images to add to gallery.json.');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
