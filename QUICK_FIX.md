# Quick Fix for Startup Issue

## The Problem
`npm run dev` hangs with no output, but `node server.js` works fine.

## Immediate Solution

**Option 1: Use npm start (no auto-reload)**
```bash
npm start
```
This bypasses nodemon and should start immediately.

**Option 2: Fix nodemon output buffering**
The nodemon config has been updated. Try:
```bash
npm run dev
```

If it still hangs, try:
```bash
npx nodemon --no-stdin server.js
```

## Root Cause
The issue appears to be nodemon buffering output or having issues with the watch configuration on macOS. The server code itself works fine (as proven by `node server.js` working).

## Permanent Fix
If nodemon continues to have issues, consider:
1. Using `npm start` for production-like testing
2. Using a different file watcher like `node-dev` or `tsx watch`
3. Investigating nodemon's `legacyWatch` setting for macOS compatibility
