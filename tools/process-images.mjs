import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const ROOT = new URL('..', import.meta.url);
const IN_DIR = path.resolve(ROOT.pathname, 'assets/images/_incoming_raw');
const OUT_FULL = path.resolve(ROOT.pathname, 'assets/images/uploads/gallery/full');
const OUT_THUMB = path.resolve(ROOT.pathname, 'assets/images/uploads/gallery/thumb');
const MANIFEST = path.resolve(ROOT.pathname, 'assets/images/uploads/gallery/manifest.json');

const SUPPORTED = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff', '.avif']);

function hashBuffer(buf) {
  return crypto.createHash('sha1').update(buf).digest('hex').slice(0, 10);
}

function safeBase(name) {
  return name
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80) || 'image';
}

async function ensureEmptyDir(dir) {
  await fs.mkdir(dir, { recursive: true });
  const entries = await fs.readdir(dir).catch(() => []);
  await Promise.all(entries.map((e) => fs.rm(path.join(dir, e), { recursive: true, force: true })));
}

async function main() {
  await fs.mkdir(IN_DIR, { recursive: true });
  // IMPORTANT:
  // Do NOT wipe output dirs. This script should be safe to run repeatedly and
  // must not delete previously-generated images referenced by content.
  await fs.mkdir(OUT_FULL, { recursive: true });
  await fs.mkdir(OUT_THUMB, { recursive: true });

  const files = (await fs.readdir(IN_DIR)).filter((f) => SUPPORTED.has(path.extname(f).toLowerCase()));

  const manifest = {
    generatedAt: new Date().toISOString(),
    inputDir: 'assets/images/_incoming_raw',
    output: {
      fullDir: 'assets/images/uploads/gallery/full',
      thumbDir: 'assets/images/uploads/gallery/thumb'
    },
    items: []
  };

  for (const filename of files) {
    const inPath = path.join(IN_DIR, filename);
    const buf = await fs.readFile(inPath);
    const h = hashBuffer(buf);
    const base = safeBase(filename);

    const fullName = `${base}-${h}-full.webp`;
    const thumbName = `${base}-${h}-thumb.webp`;

    const fullOut = path.join(OUT_FULL, fullName);
    const thumbOut = path.join(OUT_THUMB, thumbName);

    // Full: max width 1600, keep aspect, don't enlarge
    await sharp(buf)
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(fullOut);

    // Thumb: 600x600 crop (center)
    await sharp(buf)
      .rotate()
      .resize({ width: 600, height: 600, fit: 'cover' })
      .webp({ quality: 78 })
      .toFile(thumbOut);

    manifest.items.push({
      source: `assets/images/_incoming_raw/${filename}`,
      full: `assets/images/uploads/gallery/full/${fullName}`,
      thumb: `assets/images/uploads/gallery/thumb/${thumbName}`
    });
  }

  await fs.writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  console.log(`Processed ${files.length} image(s).`);
  console.log(`Wrote manifest: ${MANIFEST}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
