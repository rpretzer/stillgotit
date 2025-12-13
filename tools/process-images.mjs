import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const ROOT = new URL('..', import.meta.url);
const DEFAULT_IN_DIR = path.resolve(ROOT.pathname, 'assets/images/_incoming_raw');
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

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function toPosixPath(p) {
  return p.split(path.sep).join('/');
}

async function walkFiles(rootDir) {
  const out = [];
  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        await walk(full);
      } else if (ent.isFile()) {
        out.push(full);
      }
    }
  }
  await walk(rootDir);
  return out;
}

function parseArgs(argv) {
  const args = {
    files: null,
    dryRun: false,
    help: false,
    input: null
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--input') {
      const next = argv[i + 1];
      if (!next || next.startsWith('-')) throw new Error('Expected a value after --input');
      args.input = next;
      i++;
    } else if (a.startsWith('--input=')) {
      args.input = a.slice('--input='.length);
    }
    else if (a === '--files') {
      const next = argv[i + 1];
      if (!next || next.startsWith('-')) throw new Error('Expected a value after --files');
      args.files = next.split(',').map((s) => s.trim()).filter(Boolean);
      i++;
    } else if (a.startsWith('--files=')) {
      const val = a.slice('--files='.length);
      args.files = val.split(',').map((s) => s.trim()).filter(Boolean);
    } else {
      throw new Error(`Unknown arg: ${a}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`
Usage:
  node tools/process-images.mjs [--input <dir>] [--files <a.jpg,b.png,...>] [--dry-run]

Notes:
  - Reads originals from: assets/images/_incoming_raw/ (default) or --input <dir>
  - Tip: to process existing Decap uploads, use --input assets/images/uploads
  - Writes full images to: assets/images/uploads/gallery/full/  (max width 1600)
  - Writes thumbs to:      assets/images/uploads/gallery/thumb/ (600x600 crop)
  - Writes/merges manifest: assets/images/uploads/gallery/manifest.json
  - Safe to run repeatedly: never deletes outputs; filenames include a content hash.
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const inDir = args.input
    ? (path.isAbsolute(args.input) ? args.input : path.resolve(ROOT.pathname, args.input))
    : DEFAULT_IN_DIR;

  await fs.mkdir(inDir, { recursive: true });
  // IMPORTANT:
  // Do NOT wipe output dirs. This script should be safe to run repeatedly and
  // must not delete previously-generated images referenced by content.
  await fs.mkdir(OUT_FULL, { recursive: true });
  await fs.mkdir(OUT_THUMB, { recursive: true });

  const allPaths = await walkFiles(inDir);
  const repoRoot = path.resolve(ROOT.pathname);
  const inDirRel = toPosixPath(path.relative(repoRoot, inDir));

  const isIgnored = (absPath) => {
    const rel = toPosixPath(path.relative(repoRoot, absPath));
    // Avoid re-processing our generated outputs if input is broad (e.g., uploads/)
    if (rel.startsWith('assets/images/uploads/gallery/')) return true;
    if (rel === 'assets/images/uploads/gallery/manifest.json') return true;
    return false;
  };

  const allIncoming = allPaths
    .filter((p) => !isIgnored(p))
    .filter((p) => SUPPORTED.has(path.extname(p).toLowerCase()));

  const files = args.files
    ? allIncoming.filter((abs) => {
      const relFromInput = toPosixPath(path.relative(inDir, abs));
      const base = path.basename(abs);
      return args.files.includes(relFromInput) || args.files.includes(base);
    })
    : allIncoming;

  // Load existing manifest (append-only). This avoids "overwriting old images"
  // in the manifest, and makes runs incremental.
  let existing = null;
  if (await fileExists(MANIFEST)) {
    try {
      existing = JSON.parse(await fs.readFile(MANIFEST, 'utf8'));
    } catch {
      existing = null;
    }
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    inputDir: 'assets/images/_incoming_raw',
    inputDirs: Array.isArray(existing?.inputDirs) ? existing.inputDirs : [],
    output: {
      fullDir: 'assets/images/uploads/gallery/full',
      thumbDir: 'assets/images/uploads/gallery/thumb'
    },
    items: Array.isArray(existing?.items) ? existing.items : []
  };

  if (inDirRel && !manifest.inputDirs.includes(inDirRel)) manifest.inputDirs.push(inDirRel);

  let generatedCount = 0;
  let skippedCount = 0;

  for (const filename of files) {
    const inPath = filename; // abs path
    const relSource = toPosixPath(path.relative(repoRoot, inPath));
    const buf = await fs.readFile(inPath);
    const h = hashBuffer(buf);
    const base = safeBase(path.basename(inPath));

    const fullName = `${base}-${h}-full.webp`;
    const thumbName = `${base}-${h}-thumb.webp`;

    const fullOut = path.join(OUT_FULL, fullName);
    const thumbOut = path.join(OUT_THUMB, thumbName);

    const alreadyInManifest = manifest.items.some((it) =>
      it?.source === relSource &&
      it?.hash === h &&
      it?.full === `assets/images/uploads/gallery/full/${fullName}` &&
      it?.thumb === `assets/images/uploads/gallery/thumb/${thumbName}`
    );

    const fullExists = await fileExists(fullOut);
    const thumbExists = await fileExists(thumbOut);

    if (!args.dryRun) {
      if (!fullExists) {
        // Full: max width 1600, keep aspect, don't enlarge
        await sharp(buf)
          .rotate()
          .resize({ width: 1600, withoutEnlargement: true })
          .webp({ quality: 82 })
          .toFile(fullOut);
        generatedCount++;
      } else {
        skippedCount++;
      }

      if (!thumbExists) {
        // Thumb: 600x600 crop (center)
        await sharp(buf)
          .rotate()
          .resize({ width: 600, height: 600, fit: 'cover' })
          .webp({ quality: 78 })
          .toFile(thumbOut);
        generatedCount++;
      } else {
        skippedCount++;
      }
    }

    if (!alreadyInManifest) {
      manifest.items.push({
        source: relSource,
        hash: h,
        full: `assets/images/uploads/gallery/full/${fullName}`,
        thumb: `assets/images/uploads/gallery/thumb/${thumbName}`,
        generatedAt: new Date().toISOString()
      });
    }
  }

  // Stable-ish output: newest last by default; just ensure deterministic order.
  manifest.items.sort((a, b) => {
    const as = String(a?.source || '');
    const bs = String(b?.source || '');
    if (as !== bs) return as.localeCompare(bs);
    const ah = String(a?.hash || '');
    const bh = String(b?.hash || '');
    return ah.localeCompare(bh);
  });

  if (!args.dryRun) {
    await fs.writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  }

  if (args.files) {
    // Best-effort: validate requested filenames exist in this input dir
    const present = new Set(files.map((abs) => path.basename(abs)).concat(files.map((abs) => toPosixPath(path.relative(inDir, abs)))));
    const missing = args.files.filter((f) => !present.has(f));
    if (missing.length) console.warn(`Warning: ${missing.length} requested file(s) not found under input dir (${inDirRel || inDir}): ${missing.join(', ')}`);
  }

  console.log(`Incoming images considered: ${files.length}`);
  console.log(`Outputs generated: ${generatedCount}${args.dryRun ? ' (dry-run: no files written)' : ''}`);
  console.log(`Outputs skipped (already existed): ${skippedCount}${args.dryRun ? ' (dry-run: existence checks still ran)' : ''}`);
  console.log(`Manifest: ${args.dryRun ? 'not written (dry-run)' : MANIFEST}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
