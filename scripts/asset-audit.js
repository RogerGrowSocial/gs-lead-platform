#!/usr/bin/env node
/**
 * Asset audit: collect asset paths from layouts + routes, check existence in public/
 * Output: MISSING vs OK, plus case-mismatch hints.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');

// Normalize: strip query string, ensure leading slash for pathname
function normalizePath(href) {
  if (!href || typeof href !== 'string') return null;
  const p = href.replace(/\?.*$/, '').trim();
  if (!p.startsWith('/')) return null;
  return p;
}

// Collect paths from file content (link href, script src, img src)
function extractPaths(content) {
  const paths = new Set();
  const reLink = /<link[^>]+href=["']([^"']+)["']/gi;
  const reScript = /<script[^>]+src=["']([^"']+)["']/gi;
  const reImg = /<img[^>]+src=["']([^"']+)["']/gi;
  for (const re of [reLink, reScript, reImg]) {
    let m;
    while ((m = re.exec(content)) !== null) {
      const u = m[1];
      if (u.startsWith('/') && !u.startsWith('//') && !u.startsWith('http')) {
        paths.add(normalizePath(u));
      }
    }
  }
  return [...paths].filter(Boolean);
}

// Known asset paths from routes (stylesheets + scripts)
const ROUTE_ASSETS = [
  '/css/admin/dashboard.css',
  '/css/opportunities.css',
  '/css/admin/users.css',
  '/css/admin/adminSettings.css',
  '/css/admin/adminPayments.css',
  '/css/admin/payments-table.css',
  '/css/admin/tickets.css',
  '/css/admin/users.css',
  '/css/admin/employee-detail.css',
  '/css/admin/ticket-detail.js',
  '/css/admin/employees-drawer.css',
  '/css/admin/customers.css',
  '/css/admin/service-detail.css',
  '/js/admin/ticket-detail.js',
  '/js/admin/employeesDrawer.js',
  '/js/admin/employees.js',
  '/js/admin/employee-detail.js',
  '/js/admin/service-detail.js',
].map(p => (p.endsWith('.js') ? p.replace('/css/', '/js/') : p));

// Fix: ticket-detail is script not css
const ROUTE_ASSETS_FIXED = [
  '/css/admin/dashboard.css',
  '/css/opportunities.css',
  '/css/admin/users.css',
  '/css/admin/adminSettings.css',
  '/css/admin/adminPayments.css',
  '/css/admin/payments-table.css',
  '/css/admin/tickets.css',
  '/css/admin/employee-detail.css',
  '/css/admin/employees-drawer.css',
  '/css/admin/customers.css',
  '/css/admin/service-detail.css',
  '/js/admin/ticket-detail.js',
  '/js/admin/employeesDrawer.js',
  '/js/admin/employees.js',
  '/js/admin/employee-detail.js',
  '/js/admin/service-detail.js',
];

// Sounds referenced in main.js
const SOUNDS = [
  '/sounds/notification-success.mp3',
  '/sounds/notification-error.mp3',
  '/sounds/notification-warning.mp3',
  '/sounds/notification-info.mp3',
];

function getAllPaths() {
  const paths = new Set();

  const adminEjs = path.join(ROOT, 'views/layouts/admin.ejs');
  const dashboardEjs = path.join(ROOT, 'views/layouts/dashboard.ejs');
  for (const f of [adminEjs, dashboardEjs]) {
    if (fs.existsSync(f)) {
      const content = fs.readFileSync(f, 'utf8');
      extractPaths(content).forEach(p => paths.add(p));
    }
  }

  ROUTE_ASSETS_FIXED.forEach(p => paths.add(p));
  SOUNDS.forEach(p => paths.add(p));
  return [...paths].filter(Boolean).sort();
}

function pathToPublic(assetPath) {
  const relative = assetPath.replace(/^\//, '');
  return path.join(PUBLIC, relative);
}

function findCaseMismatch(assetPath) {
  const rel = assetPath.replace(/^\//, '');
  const parts = rel.split('/');
  let dir = PUBLIC;
  const suggested = [];
  for (let i = 0; i < parts.length; i++) {
    const name = parts[i];
    if (!fs.existsSync(dir)) return null;
    const entries = fs.readdirSync(dir);
    const lower = name.toLowerCase();
    const found = entries.find(e => e.toLowerCase() === lower);
    if (!found) return null;
    suggested.push(found);
    if (found !== name) {
      const rest = parts.slice(i + 1);
      return '/' + path.join(...suggested, ...rest).replace(/\\/g, '/');
    }
    dir = path.join(dir, found);
  }
  return null;
}

function run() {
  const allPaths = getAllPaths();
  const missing = [];
  const ok = [];
  const caseHints = [];

  for (const p of allPaths) {
    const filePath = pathToPublic(p);
    if (fs.existsSync(filePath)) {
      ok.push(p);
    } else {
      missing.push(p);
      const hint = findCaseMismatch(p);
      if (hint) caseHints.push({ requested: p, hint: '/' + hint });
    }
  }

  console.log('=== ASSET AUDIT REPORT ===\n');
  console.log('OK (' + ok.length + '):');
  ok.forEach(p => console.log('  ' + p));
  console.log('\nMISSING (' + missing.length + '):');
  missing.forEach(p => console.log('  ' + p));
  if (caseHints.length > 0) {
    console.log('\nCASE MISMATCH HINTS (requested -> try):');
    caseHints.forEach(({ requested, hint }) => console.log('  ' + requested + ' -> ' + hint));
  }
  console.log('\n=== END REPORT ===');
  process.exit(missing.length > 0 ? 1 : 0);
}

run();
