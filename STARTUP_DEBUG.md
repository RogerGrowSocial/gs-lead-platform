# Server Startup Debugging Guide

## Current Status
The server is experiencing slow startup times. This document tracks the fixes applied and debugging steps.

## Fixes Applied

1. ✅ **Made Prisma lazy** - PrismaClient now only connects when first used
2. ✅ **Made billing cron non-blocking** - Moved to start after server listens
3. ✅ **Added retry logic for ECANCELED errors** - Handles Node.js 22/macOS file system issues
4. ✅ **Added detailed timing logs** - Shows exactly where time is spent

## How to Debug

When you run `npm run dev`, watch the console output. You should see:

1. Module loading times (routes, middleware, etc.)
2. Route registration time
3. Server listen time

**If it hangs, note the LAST message you see** - that tells us where it's stuck.

## Common Bottlenecks

1. **routes/api.js** - This file is 11,456 lines. Parsing it can take 2-5 seconds but shouldn't hang forever.
2. **Database connections** - Prisma and Supabase clients (now lazy-loaded)
3. **Network timeouts** - If database isn't reachable (now has timeouts)

## Next Steps

If startup is still slow:
1. Check the last log message before it hangs
2. Note the timing - how long does each step take?
3. Check if database is reachable: `ping your-database-host`
4. Try starting with minimal routes to isolate the issue

## Quick Test

To test if it's routes/api.js causing the issue, temporarily comment out:
```javascript
const apiRoutes = requireWithRetry("./routes/api")
app.use("/api", apiRoutes)
```

If server starts quickly without it, then routes/api.js or its dependencies are the issue.
