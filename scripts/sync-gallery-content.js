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

  // Manifest is the source of truth for what webps actually exist.
  // Build a set of valid src paths so we can prune stale gallery entries.
  const validSrcs = new Set(manifest.items.map(item => '/' + item.full));

  // Create a set of existing image src paths for quick lookup
  const existingSrcs = new Set(gallery.images.map(img => img.src));
  let addedCount = 0;

  const newItems = [];

  for (const item of manifest.items) {
    // Manifest paths are relative to root, e.g. "assets/images/..."
    // Gallery paths need leading slash, e.g. "/assets/images/..."
    const src = '/' + item.full;
    const thumb = '/' + item.thumb;

    if (!existingSrcs.has(src)) {
      const filename = path.basename(item.source, path.extname(item.source));
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

  // Sort new items descending by source filename (Z-A, numeric-aware)
  // so newer/higher-numbered files appear first.
  newItems.sort((a, b) => {
    const sourceA = String(a._source || '').toLowerCase();
    const sourceB = String(b._source || '').toLowerCase();
    return sourceB.localeCompare(sourceA, undefined, { numeric: true, sensitivity: 'base' });
  });

  newItems.forEach(item => delete item._source);

  // Prepend new items, then prune any entries not backed by the manifest.
  gallery.images = [...newItems, ...gallery.images];

  const beforeCount = gallery.images.length;
  gallery.images = gallery.images.filter(img => validSrcs.has(img.src));
  const prunedCount = beforeCount - gallery.images.length;

  if (addedCount > 0 || prunedCount > 0) {
    await fs.writeFile(GALLERY_CONTENT_PATH, JSON.stringify(gallery, null, 2) + '\n', 'utf8');
    console.log(`Synced gallery.json — added: ${addedCount}, pruned: ${prunedCount}.`);
  } else {
    console.log('No changes to gallery.json.');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
