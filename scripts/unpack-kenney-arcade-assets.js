#!/usr/bin/env node
/**
 * Unpack Kenney Conveyor Kit assets for Arcade Mode.
 * - Source zip: /assets/arcade/kenney_conveyor-kit.zip
 * - Destination: /public/arcade/kenney/conveyor-kit/
 * - Idempotent: re-run safely.
 */

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const projectRoot = path.join(__dirname, '..');
const zipPath = path.join(projectRoot, 'assets', 'arcade', 'kenney_conveyor-kit.zip');
const destDir = path.join(projectRoot, 'public', 'arcade', 'kenney', 'conveyor-kit');

function ensureDir(p) {
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
}

function main() {
  if (!fs.existsSync(zipPath)) {
    console.error(`❌ Zip not found at ${zipPath}`);
    console.error('Please place kenney_conveyor-kit.zip at /assets/arcade/ and re-run: npm run arcade:assets');
    process.exit(1);
  }

  ensureDir(destDir);

  const zip = new AdmZip(zipPath);
  zip.extractAllTo(destDir, true);

  console.log(`✅ Extracted Kenney Conveyor Kit to ${destDir}`);
}

main();

