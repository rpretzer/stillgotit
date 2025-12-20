#!/usr/bin/env node
/**
 * Generate media index for Decap CMS Media Library
 * Scans assets/images/uploads/ and creates a JSON index of all images
 * 
 * Usage: node scripts/generate-media-index.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADS_DIR = path.join(__dirname, '..', 'assets', 'images', 'uploads');
const OUTPUT_FILE = path.join(__dirname, '..', 'content', 'media-index.json');
const PUBLIC_BASE = '/assets/images/uploads';
const SITE_URL = 'https://stillgotitcollective.com';

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'];

function getAllImageFiles(dir, basePath = '') {
  const files = [];
  
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.join(basePath, entry.name).replace(/\\/g, '/');
      
      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        files.push(...getAllImageFiles(fullPath, relativePath));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (IMAGE_EXTENSIONS.includes(ext)) {
          files.push({
            name: entry.name,
            path: relativePath,
            url: `${SITE_URL}${PUBLIC_BASE}/${relativePath}`,
            preview: `${PUBLIC_BASE}/${relativePath}`
          });
        }
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error.message);
  }
  
  return files;
}

function generateMediaIndex() {
  console.log('Scanning for images in:', UPLOADS_DIR);
  
  if (!fs.existsSync(UPLOADS_DIR)) {
    console.error(`Uploads directory not found: ${UPLOADS_DIR}`);
    process.exit(1);
  }
  
  const images = getAllImageFiles(UPLOADS_DIR);
  console.log(`Found ${images.length} image files`);
  
  // Sort by path for consistent ordering
  images.sort((a, b) => a.path.localeCompare(b.path));
  
  const output = {
    files: images
  };
  
  // Ensure content directory exists
  const contentDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(contentDir)) {
    fs.mkdirSync(contentDir, { recursive: true });
  }
  
  // Write JSON file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(`✅ Generated media index: ${OUTPUT_FILE}`);
  console.log(`   Total images: ${images.length}`);
}

generateMediaIndex();

