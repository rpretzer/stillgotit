#!/usr/bin/env node
/**
 * Watch assets/images/_incoming_raw/ for new files and auto-commit/push
 * 
 * Usage: node scripts/watch-incoming-images.js
 * 
 * This script watches for new files in the incoming raw folder and
 * automatically commits and pushes them to trigger the image processing workflow.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WATCH_DIR = path.join(__dirname, '..', 'assets', 'images', '_incoming_raw');
const DEBOUNCE_MS = 5000; // Wait 5 seconds after last change before committing
const GIT_USER = 'Auto Image Watcher';
const GIT_EMAIL = 'auto-watcher@stillgotitcollective.com';

let changeTimeout = null;
let pendingFiles = new Set();

function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

function gitStatus() {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf-8', cwd: path.join(__dirname, '..') });
    return status.trim();
  } catch (error) {
    log(`Error checking git status: ${error.message}`);
    return '';
  }
}

function hasIncomingChanges() {
  const status = gitStatus();
  return status.includes('assets/images/_incoming_raw/');
}

function commitAndPush() {
  try {
    log('Detected changes in _incoming_raw/, committing...');
    
    // Configure git user for this commit
    execSync(`git config user.name "${GIT_USER}"`, { cwd: path.join(__dirname, '..') });
    execSync(`git config user.email "${GIT_EMAIL}"`, { cwd: path.join(__dirname, '..') });
    
    // Stage only incoming raw folder
    execSync('git add assets/images/_incoming_raw/', { 
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    });
    
    // Check if there are actually changes to commit
    const status = execSync('git status --porcelain assets/images/_incoming_raw/', { 
      encoding: 'utf-8',
      cwd: path.join(__dirname, '..')
    });
    
    if (!status.trim()) {
      log('No changes to commit');
      pendingFiles.clear();
      return;
    }
    
    // Get list of new files for commit message
    const newFiles = Array.from(pendingFiles).slice(0, 5); // Show first 5
    const fileList = newFiles.length > 5 
      ? `${newFiles.join(', ')} and ${pendingFiles.size - 5} more`
      : newFiles.join(', ');
    
    // Commit
    const commitMessage = `chore(images): add new images to processing queue\n\nAdded: ${fileList}`;
    execSync(`git commit -m "${commitMessage}"`, { 
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    });
    
    log('Committed changes, pushing to remote...');
    
    // Push
    execSync('git push origin main', { 
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    });
    
    log(`✅ Successfully pushed ${pendingFiles.size} new image(s) to trigger processing workflow`);
    pendingFiles.clear();
    
  } catch (error) {
    log(`❌ Error committing/pushing: ${error.message}`);
    if (error.stdout) log(`stdout: ${error.stdout}`);
    if (error.stderr) log(`stderr: ${error.stderr}`);
  }
}

function handleChange(filePath) {
  const fileName = path.basename(filePath);
  pendingFiles.add(fileName);
  log(`Detected change: ${fileName}`);
  
  // Clear existing timeout
  if (changeTimeout) {
    clearTimeout(changeTimeout);
  }
  
  // Set new timeout to debounce rapid changes
  changeTimeout = setTimeout(() => {
    if (hasIncomingChanges()) {
      commitAndPush();
    } else {
      log('No git changes detected, skipping commit');
      pendingFiles.clear();
    }
  }, DEBOUNCE_MS);
}

function startWatching() {
  if (!fs.existsSync(WATCH_DIR)) {
    log(`Creating watch directory: ${WATCH_DIR}`);
    fs.mkdirSync(WATCH_DIR, { recursive: true });
  }
  
  log(`👀 Watching ${WATCH_DIR} for new images...`);
  log('Press Ctrl+C to stop');
  log('');
  
  // Watch for file additions
  fs.watch(WATCH_DIR, { recursive: true }, (eventType, filename) => {
    if (!filename) return;
    
    // Only handle new files (not deletions or modifications of existing files)
    if (eventType === 'rename') {
      const fullPath = path.join(WATCH_DIR, filename);
      
      // Check if file actually exists (rename can be add or delete)
      fs.access(fullPath, fs.constants.F_OK, (err) => {
        if (!err) {
          // File exists, it's a new file
          handleChange(fullPath);
        }
      });
    }
  });
  
  // Also check for existing uncommitted files on startup
  if (hasIncomingChanges()) {
    log('Found existing uncommitted changes, committing now...');
    setTimeout(() => commitAndPush(), 2000);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('\n👋 Stopping watcher...');
  if (changeTimeout) {
    clearTimeout(changeTimeout);
    // Commit any pending changes before exiting
    if (hasIncomingChanges()) {
      log('Committing pending changes before exit...');
      commitAndPush();
    }
  }
  process.exit(0);
});

// Start watching
startWatching();

